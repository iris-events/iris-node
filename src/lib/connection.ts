import * as amqplib from 'amqplib'
import _ from 'lodash'
import logger from '../logger'
import type * as interfaces from './connection.interfaces'
import * as constants from './constants'
import { asError } from './errors'
import * as helper from './helper'
import * as messageDecoratorUtils from './message.decorator_utils'
import { Scope } from './message.interfaces'
import type * as messageHandlerI from './message_handler.interfaces'

export * from './connection.interfaces'

type ChannelI = amqplib.Channel & { _lookup_key_: string }
type ChannelsI = { [key: string]: Promise<ChannelI> | undefined }
type ReconnectGeneratorParamsI = Pick<
  interfaces.OptionalConfigI,
  'reconnectTries' | 'reconnectFactor' | 'reconnectInterval'
>

export class Connection {
  private TAG = 'Iris:Connection'

  private connection: amqplib.Connection | undefined
  private intentionallyDisconnected = false
  private disconnectPromise: Promise<void> | undefined
  private connectPromise: Promise<void> | undefined
  private reconnectHelper: ReconnectHelper | undefined
  private doAutoReconnect = true

  private channels: ChannelsI = {}

  private config: interfaces.ConfigI | undefined

  public getConnection(): amqplib.Connection | undefined {
    return this.connection
  }

  public getConfig(): interfaces.ConfigI {
    return <interfaces.ConfigI>_.cloneDeep(this.config)
  }

  public async connect(config: interfaces.ConnectionConfigI): Promise<void> {
    this.setDoAutoReconnect(true)
    if (this.reconnectHelper !== undefined) {
      await this.reconnectHelper.promise
    }

    await this.internalConnect(config)
  }

  /**
   * Returns true if lib is disconnected and not trying to connect
   * or false when lib is either connected or in process of (re)connecting
   *
   * Can be used for health checks
   */
  public isDisconnected(): boolean {
    return (
      this.connection === undefined &&
      this.connectPromise === undefined &&
      this.reconnectHelper === undefined &&
      this.disconnectPromise === undefined
    )
  }

  public isReconnecting(): boolean {
    return this.connection === undefined && this.reconnectHelper !== undefined
  }

  public setDoAutoReconnect(autoReconnect: boolean): void {
    this.doAutoReconnect = autoReconnect
  }

  private async internalConnect(
    config?: interfaces.ConnectionConfigI,
  ): Promise<void> {
    if (this.disconnectPromise !== undefined) {
      await this.disconnectPromise
    }

    if (this.connection !== undefined) {
      logger.debug(this.TAG, 'Already connected')

      return
    }

    if (this.connectPromise === undefined) {
      if (config !== undefined) {
        this.setOptions(config)
      }
      this.connectPromise = this.doConnect()
      this.connectPromise.catch(() => {
        this.connectPromise = undefined
      })
    } else {
      logger.debug(this.TAG, 'Already connecting')
    }

    return this.connectPromise
  }

  private async doConnect(): Promise<void> {
    logger.log(this.TAG, 'Connecting')
    const options = <interfaces.ConfigI>this.config

    this.connection = await amqplib.connect(
      <string | amqplib.Options.Connect>options.urlOrOpts,
      {
        ...options.socketOptions,
        // https://github.com/amqp-node/amqplib/issues/217#issuecomment-373728741
        clientProperties: {
          ...options.socketOptions?.clientProperties,
          connection_name: helper.getHostName(),
        },
      },
    )
    logger.debug(this.TAG, 'Connected')
    this.intentionallyDisconnected = false
    this.connectPromise = undefined

    this.connection.once('close', (err?: Error) => {
      this.onDisconnectCleanup()

      if (err !== undefined) {
        logger.error(this.TAG, 'Connection errored', { err })
      } else {
        logger.warn(this.TAG, 'Connection closed')
      }

      this.reconnect()
    })
  }

  public async disconnect(): Promise<void> {
    if (this.reconnectHelper !== undefined) {
      await this.reconnectHelper.promise
    }

    if (this.connectPromise !== undefined) {
      await this.connectPromise
    }

    if (this.connection === undefined) {
      logger.debug(this.TAG, 'Already disconnected')

      return
    }

    if (this.disconnectPromise === undefined) {
      this.intentionallyDisconnected = true
      this.disconnectPromise = this.doDisconnect()
    } else {
      logger.debug(this.TAG, 'Already disconnecting')
    }

    return this.disconnectPromise
  }

  private async doDisconnect(): Promise<void> {
    // if disconnect is called right after publish then
    // messages do not come through unless we wait
    await new Promise((resolve) => setTimeout(resolve))
    logger.log(this.TAG, 'Disconnecting')
    await (<amqplib.Connection>this.connection).close()
    this.onDisconnectCleanup()
  }

  private onDisconnectCleanup(): void {
    this.connection = undefined
    this.disconnectPromise = undefined
    this.reconnectHelper = undefined
  }

  public shouldAutoReconnect(): boolean {
    return this.doAutoReconnect && !this.intentionallyDisconnected
  }

  public async assureDefaultChannel(): Promise<amqplib.Channel> {
    return this.assureChannel('defaultChannel')
  }

  public async assureChannelForHandler(
    handler: messageHandlerI.ProcessedMessageHandlerMetadataI,
  ): Promise<amqplib.Channel> {
    const { uuid } = handler
    const { prefetch } = handler.processedConfig
    const msgMeta = messageDecoratorUtils.getMessageDecoratedClass(
      handler.messageClass,
    )
    const isFrontend = msgMeta.origDecoratorConfig.scope === Scope.FRONTEND

    const key = isFrontend
      ? '_frontend_channel_'
      : [
          uuid,
          `(${handler.targetClassName}.${handler.methodName})`,
          msgMeta.uuid,
        ].join('-')

    return this.assureChannel(key, prefetch)
  }

  public async assureChannel(
    lookup: string,
    prefetch?: number,
  ): Promise<ChannelI> {
    if (this.reconnectHelper !== undefined) {
      await this.reconnectHelper.promise
    }

    if (this.connectPromise !== undefined) {
      await this.connectPromise
    }

    let chP = this.channels[lookup]
    if (chP === undefined) {
      chP = this.doAssureChannel(lookup, prefetch)
      this.channels[lookup] = chP
      chP.catch(() => {
        delete this.channels[lookup]
      })
    }

    return chP
  }

  private async doAssureChannel(
    lookup: string,
    prefetch?: number,
  ): Promise<ChannelI> {
    logger.debug(this.TAG, `Opening channel for ${lookup}`)

    if (this.connection === undefined) {
      delete this.channels[lookup]
      throw new Error('ERR_IRIS_CONNECTION_NOT_ESTABLISHED')
    }

    const channel = <ChannelI>await this.connection.createChannel()
    channel._lookup_key_ = lookup

    channel.once('close', () => {
      logger.debug(this.TAG, `Channel for ${lookup} closed`)
      delete this.channels[lookup]
    })

    if (prefetch !== undefined) {
      logger.debug(this.TAG, `Setting prefetch for ${lookup} to ${prefetch}`)
      await channel.prefetch(prefetch)
    }

    return channel
  }

  private reconnect(): void {
    if (!this.shouldAutoReconnect()) {
      return
    }

    const options = <interfaces.ConfigI>this.config

    if (options.reconnectTries < 1) {
      logger.warn(this.TAG, 'Reconnecting disabled', {
        reconnectTries: options.reconnectTries,
      })

      return
    }

    if (this.reconnectHelper === undefined) {
      this.reconnectHelper = new ReconnectHelper(options)
    }

    const reconnectDelay = this.reconnectHelper.nextDelay()

    if (reconnectDelay === false) {
      logger.error(
        this.TAG,
        'Reconnecting exhausted, will not try to reconnect',
      )
      this.onReconnectCleanup(new Error('ERR_IRIS_CONNECTION_NOT_ESTABLISHED'))

      return
    }

    logger.warn(this.TAG, `Reconnecting in ${reconnectDelay}ms`)

    setTimeout(() => {
      this.doReconnect()
    }, reconnectDelay)
  }

  private async doReconnect(): Promise<void> {
    try {
      await this.internalConnect()
      this.onReconnectCleanup()
    } catch (err) {
      logger.error(this.TAG, 'Reconnect failed', { err: asError(err) })
      this.reconnect()
    }
  }

  private onReconnectCleanup(err?: Error): void {
    if (this.reconnectHelper !== undefined) {
      if (err === undefined) {
        this.reconnectHelper.resolve()
      } else {
        this.reconnectHelper.reject(err)
      }
    }
    this.reconnectHelper = undefined
  }

  private setOptions(config: interfaces.ConnectionConfigI): void {
    this.config = {
      ...constants.CONNECTION_DEFAULT_OPTONS,
      ...config,
    }
  }
}

export class ReconnectHelper {
  public promise: Promise<void>
  public resolve!: () => void
  public reject!: (err: Error) => void
  private delayGenerator: Generator<number, false, void>

  private static TAG = 'Iris:Connection:ReconnectHelper'

  constructor(conf: ReconnectGeneratorParamsI) {
    this.delayGenerator = this.getReconnectDelayGenerator(conf)
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
  }

  public nextDelay(): number | false {
    return this.delayGenerator.next().value
  }

  private getReconnectDelayGenerator({
    reconnectInterval,
    reconnectFactor,
    reconnectTries,
  }: ReconnectGeneratorParamsI): Generator<number, false, void> {
    function* nextDelay(): Generator<number, false, void> {
      let reconnectTryNum = 0
      while (reconnectTryNum < reconnectTries) {
        logger.debug(ReconnectHelper.TAG, 'Generating next delay', {
          reconnectInterval,
          reconnectFactor,
          reconnectTryNum,
        })
        yield Math.round(
          reconnectInterval +
            reconnectTryNum * reconnectInterval * reconnectFactor,
        )
        reconnectTryNum = reconnectTryNum + 1
      }

      return false
    }

    return nextDelay()
  }
}

export const connection = new Connection()
