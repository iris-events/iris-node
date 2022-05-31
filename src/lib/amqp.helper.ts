import * as _ from 'lodash'
import * as amqplib from 'amqplib'
import * as amqplibDefs from 'amqplib/lib/defs'
import { Logger } from '../logger'
import * as messageI from './message.interfaces'
import { connection } from './connection'
import { MESSAGE_HEADERS, MANAGED_EXCHANGES } from './constants'
import * as helper from './helper'

const { FRONTEND } = MANAGED_EXCHANGES

const logger = new Logger.instance('Iris:IrisHelper')

export const getFrontendQueueName = (): string => `${helper.getServiceName()}.${FRONTEND.SUFFIX}`

export async function assertQueue(queueName: string, options?: amqplib.Options.AssertQueue): Promise<void> {
  const channelTag = 'channel-create'
  let channel = await getTemporaryChannel(channelTag)

  try {
    logger.log('AssertQueue', { options, queueName })
    await channel.assertQueue(queueName, options)

    return
  } catch (e) {
    if ((<{ code: number }>e).code !== amqplibDefs.constants.PRECONDITION_FAILED) {
      throw e
    }

    logger.warn(`AssertQueue ${queueName} can not be asserted: ${(<Error>e).message}`)

    // channel was closed, open a new one again
    channel = await getTemporaryChannel(channelTag)
  }

  const qCheck = await channel.checkQueue(queueName)
  if (qCheck.messageCount < 1) {
    logger.log(`AssertQueue ${queueName} recreating queue with new configuration`)
    await channel.deleteQueue(queueName)
    await channel.assertQueue(queueName, options)
  }
}

export async function assertExchange(exchangeName: string, exchangeType: messageI.ExchangeType, options?: amqplib.Options.AssertExchange): Promise<void> {
  const channelTag = 'exchange-create'
  const channel = await getTemporaryChannel(channelTag)

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const onErr = _.noop
  channel.on('error', onErr)

  try {
    logger.log('AssertExchange', { exchangeName, options, exchangeType })
    await channel.assertExchange(exchangeName, exchangeType, options)
    channel.off('error', onErr)

    return
  } catch (e) {
    if ((<{ code: number }>e).code !== amqplibDefs.constants.PRECONDITION_FAILED) {
      throw e
    }

    logger.warn(`AssertExchange ${exchangeName} can not be asserted: ${(<Error>e).message}. Will use one with existing settings.`)
  }
}

export async function getTemporaryChannel(tag: string): Promise<amqplib.Channel> {
  const channel = await connection.assureChannel(tag)
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const onErr = _.noop
  // remove error listener from before if channel was not closed yet
  channel.off('error', onErr)
  channel.on('error', onErr)

  return channel
}

export function safeAmqpObjectForLogging<T extends undefined | amqplib.Message | amqplib.Options.Publish | amqplib.MessagePropertyHeaders>(msg: T): T {
  if (msg === undefined) {
    return msg
  }

  const jwtHeader = MESSAGE_HEADERS.MESSAGE.JWT
  const jwtPath: string | undefined = [`properties.headers[${jwtHeader}]`, `headers[${jwtHeader}]`, jwtHeader].find(jp => _.has(msg, jp))

  if (jwtPath === undefined) {
    return msg
  }

  return _.chain({}).merge(msg).set(jwtPath, '<omitted>').value()
}
