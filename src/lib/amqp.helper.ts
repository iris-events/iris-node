import type * as amqplib from 'amqplib'
import * as amqplibDefs from 'amqplib/lib/defs'
import _ from 'lodash'
import logger from '../logger'
import { connection } from './connection'
import { MANAGED_EXCHANGES, MESSAGE_HEADERS } from './constants'
import { asError } from './errors'
import * as helper from './helper'
import type * as messageI from './message.interfaces'

const { FRONTEND } = MANAGED_EXCHANGES

const TAG = 'Iris:IrisHelper'

export type MessagePropertiesWithHeadersI = amqplib.MessageProperties & {
  headers: amqplib.MessagePropertyHeaders
}

export const getFrontendQueueName = (): string =>
  `${helper.getServiceName()}.${FRONTEND.SUFFIX}`

export async function assertQueue(
  queueName: string,
  options?: amqplib.Options.AssertQueue,
): Promise<void> {
  const channelTag = 'channel-create'
  let channel = await getTemporaryChannel(channelTag)

  try {
    logger.debug(TAG, `AssertQueue ${queueName}`, { options, queueName })
    await channel.assertQueue(queueName, options)

    return
  } catch (err) {
    if (
      (<{ code: number }>err).code !== amqplibDefs.constants.PRECONDITION_FAILED
    ) {
      throw err
    }

    logger.warn(
      TAG,
      `AssertQueue ${queueName} can not be asserted: ${asError(err).message}`,
    )

    // channel was closed, open a new one again
    channel = await getTemporaryChannel(channelTag)
  }

  const qCheck = await channel.checkQueue(queueName)
  if (qCheck.messageCount < 1) {
    logger.debug(
      TAG,
      `AssertQueue ${queueName} recreating queue with new configuration`,
    )
    await channel.deleteQueue(queueName)
    await channel.assertQueue(queueName, options)
  }
}

export async function assertExchange(
  exchangeName: string,
  exchangeType: messageI.ExchangeType,
  options?: amqplib.Options.AssertExchange,
): Promise<void> {
  const channelTag = 'exchange-create'
  const channel = await getTemporaryChannel(channelTag)

  const onErr = _.noop
  channel.on('error', onErr)

  try {
    logger.debug(TAG, `AssertExchange: ${exchangeName}`, {
      exchangeName,
      options,
      exchangeType,
    })
    await channel.assertExchange(exchangeName, exchangeType, options)
    channel.off('error', onErr)

    return
  } catch (err) {
    if (
      (<{ code: number }>err).code !== amqplibDefs.constants.PRECONDITION_FAILED
    ) {
      throw err
    }

    logger.warn(
      TAG,
      `AssertExchange ${exchangeName} can not be asserted: ${
        asError(err).message
      }. Will use one with existing settings.`,
    )
  }
}

export async function getTemporaryChannel(
  tag: string,
): Promise<amqplib.Channel> {
  const channel = await connection.assureChannel(tag)
  const onErr = _.noop
  // remove error listener from before if channel was not closed yet
  channel.off('error', onErr)
  channel.on('error', onErr)

  return channel
}

export function safeAmqpObjectForLogging<
  T extends
    | undefined
    | amqplib.Message
    | amqplib.Options.Publish
    | amqplib.MessagePropertyHeaders,
>(msg: T): T {
  if (msg === undefined) {
    return msg
  }

  const jwtHeader = MESSAGE_HEADERS.MESSAGE.JWT
  const jwtPath: string | undefined = [
    `properties.headers[${jwtHeader}]`,
    `headers[${jwtHeader}]`,
    jwtHeader,
  ].find((jp) => _.has(msg, jp))

  if (jwtPath === undefined) {
    return msg
  }

  return _.chain({}).merge(msg).set(jwtPath, '<omitted>').value()
}

export function cloneAmqpMsgProperties(
  msg: amqplib.ConsumeMessage,
): MessagePropertiesWithHeadersI {
  // It's happening with redelivered messages that headers are undefined (??)
  const msgProperties = _.cloneDeep(msg.properties)
  if (_.isNil(msgProperties.headers)) {
    msgProperties.headers = {}
  }

  return <MessagePropertiesWithHeadersI>msgProperties
}

export function hasClientContext(msg: amqplib.ConsumeMessage): boolean {
  const lookupKey = `properties.headers[${MESSAGE_HEADERS.MESSAGE.SESSION_ID}]`
  const hasSession = <string | undefined>_.get(msg, lookupKey)

  return hasSession !== undefined
}
