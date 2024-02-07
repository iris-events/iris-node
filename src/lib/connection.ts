import * as amqplib from 'amqplib'
import { getLogger, LoggerI } from '../logger'
import * as interfaces from './connection.interfaces'
import * as messageHandlerI from './message_handler.interfaces'
import * as messageDecoratorUtils from './message.decorator_utils'
import { Scope } from './message.interfaces'
import * as constants from './constants'
import * as helper from './helper'
import _ from 'lodash'

export * from './connection.interfaces'

type ChannelI = amqplib.Channel & { _lookup_key_: string }
type ChannelsI = { [key: string]: Promise<ChannelI> | undefined }
type ReconnectGeneratorParamsI = Pick<interfaces.OptionalConfigI, 'reconnectTries' | 'reconnectFactor' | 'reconnectInterval'>

export class Connection {
  private logger: LoggerI

  private connection: amqplib.Connection | undefined
  private intentionallyDisconnected: boolean = false
  private disconnectPromise: Promise<void> | undefined
  private connectPromise: Promise<void> | undefined
  private reconnectHelper: ReconnectHelper | undefined
  private doAutoReconnect: boolean = true

  private channels: ChannelsI = {}

  private config: interfaces.ConfigI | undefined

  constructor() {
    this.logger = getLogger('Iris:Connection')
  }

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
    return this.connection === undefined && this.connectPromise === undefined && this.reconnectHelper === undefined && this.disconnectPromise === undefined
  }

  public isReconnecting(): boolean {
    return this.connection === undefined && this.reconnectHelper !== undefined
  }

  public setDoAutoReconnect(autoReconnect: boolean): void {
    this.doAutoReconnect = autoReconnect
  }

  private async internalConnect(config?: interfaces.ConnectionConfigI): Promise<void> {
    if (this.disconnectPromise !== undefined) {
      await this.disconnectPromise
    }

    if (this.connection !== undefined) {
      this.logger.verbose('Already connected')

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
      this.logger.verbose('Already connecting')
    }

    return this.connectPromise
  }

  private async doConnect(): Promise<void> {
    this.logger.log('Connecting')
    const options = <interfaces.ConfigI>this.config

    this.connection = await amqplib.connect(<string | amqplib.Options.Connect>options.urlOrOpts, {
      ...options.socketOptions,
      // https://github.com/amqp-node/amqplib/issues/217#issuecomment-373728741
      clientProperties: {
        ...options.socketOptions?.clientProperties,
        connection_name: helper.getHostName(),
      },
    })
    this.logger.verbose('Connected')
    this.intentionallyDisconnected = false
    this.connectPromise = undefined

    this.connection.once('close', (error?: Error) => {
      this.onDisconnectCleanup()

      if (error !== undefined) {
        this.logger.errorDetails('Connection errored', { error })
      } else {
        this.logger.warn('Connection closed')
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
      this.logger.verbose('Already disconnected')

      return
    }

    if (this.disconnectPromise === undefined) {
      this.intentionallyDisconnected = true
      this.disconnectPromise = this.doDisconnect()
    } else {
      this.logger.verbose('Already disconnecting')
    }

    return this.disconnectPromise
  }

  private async doDisconnect(): Promise<void> {
    // if disconnect is called right after publish then
    // messages do not come through unless we wait
    await new Promise(resolve => setTimeout(resolve))
    this.logger.log('Disconnecting')
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

  public async assureChannelForHandler(handler: messageHandlerI.ProcessedMessageHandlerMetadataI): Promise<amqplib.Channel> {
    const { uuid } = handler
    const { prefetch } = handler.processedConfig
    const msgMeta = messageDecoratorUtils.getMessageDecoratedClass(handler.messageClass)
    const isFrontend = msgMeta.origDecoratorConfig.scope === Scope.FRONTEND

    const key = isFrontend ? '_frontend_channel_' : [uuid, `(${handler.targetClassName}.${handler.methodName})`, msgMeta.uuid].join('-')

    return this.assureChannel(key, prefetch)
  }

  public async assureChannel(lookup: string, prefetch?: number): Promise<ChannelI> {
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

  private async doAssureChannel(lookup: string, prefetch?: number): Promise<ChannelI> {
    this.logger.log(`Opening channel for ${lookup}`)

    if (this.connection === undefined) {
      delete this.channels[lookup]
      throw new Error('ERR_IRIS_CONNECTION_NOT_ESTABLISHED')
    }

    const channel = <ChannelI>await this.connection.createChannel()
    channel._lookup_key_ = lookup

    channel.once('close', () => {
      this.logger.verbose(`Channel for ${lookup} closed`)
      delete this.channels[lookup]
    })

    if (prefetch !== undefined) {
      this.logger.verbose(`Setting prefetch for ${lookup} to ${prefetch}`)
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
      this.logger.warn('Reconnecting disabled', { reconnectTries: options.reconnectTries })

      return
    }

    if (this.reconnectHelper === undefined) {
      this.reconnectHelper = new ReconnectHelper(options)
    }

    const reconnectDelay = this.reconnectHelper.nextDelay()

    if (reconnectDelay === false) {
      this.logger.errorDetails('Reconnecting exhausted, will not try to reconnect')
      this.onReconnectCleanup(new Error('ERR_IRIS_CONNECTION_NOT_ESTABLISHED'))

      return
    }

    this.logger.warn(`Reconnecting in ${reconnectDelay}ms`)

    setTimeout(() => {
      this.doReconnect()
    }, reconnectDelay)
  }

  private async doReconnect(): Promise<void> {
    try {
      await this.internalConnect()
      this.onReconnectCleanup()
    } catch (err) {
      this.logger.errorDetails('Reconnect failed')
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
  private logger: LoggerI

  constructor(conf: ReconnectGeneratorParamsI) {
    this.logger = getLogger('Iris:Connection:ReconnectHelper')
    this.delayGenerator = this.getReconnectDelayGenerator(conf)
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
  }

  public nextDelay(): number | false {
    return this.delayGenerator.next().value
  }

  private getReconnectDelayGenerator({ reconnectInterval, reconnectFactor, reconnectTries }: ReconnectGeneratorParamsI): Generator<number, false, void> {
    const logger = this.logger
    function* nextDelay(): Generator<number, false, void> {
      let reconnectTryNum = 0
      while (reconnectTryNum < reconnectTries) {
        logger.verbose('Generating next delay', { reconnectInterval, reconnectFactor, reconnectTryNum })
        yield Math.round(reconnectInterval + reconnectTryNum * reconnectInterval * reconnectFactor)
        reconnectTryNum = reconnectTryNum + 1
      }

      return false
    }

    return nextDelay()
  }
}

export const connection = new Connection()
