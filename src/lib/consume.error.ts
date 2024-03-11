import type * as amqplib from 'amqplib'
import { getLogger } from '../logger'
import {
  cloneAmqpMsgProperties,
  getTemporaryChannel,
  hasClientContext,
} from './amqp.helper'
import { MANAGED_EXCHANGES, MESSAGE_HEADERS } from './constants'
import * as consumeAck from './consume.ack'
import * as consumeRetry from './consume.retry'
import * as errors from './errors'
import type * as messageI from './message.interfaces'
import type * as messageHandler from './message_handler'

const { ERROR } = MANAGED_EXCHANGES

const logger = getLogger('Iris:Consumer:HandleError')

export async function handleConsumeError(
  error: Error,
  handler: messageHandler.ProcessedMessageHandlerMetadataI,
  msgMeta: messageI.ProcessedMessageMetadataI,
  channel: amqplib.Channel,
  msg: amqplib.ConsumeMessage,
): Promise<void> {
  const reject = errors.isRejectableError(error)
  const { exchange } = handler.processedConfig
  logger.errorDetails(
    'Event consume error',
    errors.enhancedDetails(
      {
        rejecting: reject,
        exchange,
        handler: handler.processedConfig,
      },
      error,
    ),
  )

  if (reject) {
    consumeAck.safeAckMsg(msg, channel, 'reject', false)
    await handleRejectableError(msg, error)
  } else {
    const enqueued = await consumeRetry.enqueueWithBackoff(
      msg,
      handler,
      msgMeta.processedConfig,
      error,
    )
    if (enqueued) {
      consumeAck.safeAckMsg(msg, channel, 'ack')
    } else {
      consumeAck.safeAckMsg(msg, channel, 'nack')
    }
  }
}

async function handleRejectableError(
  msg: amqplib.ConsumeMessage,
  error: Error,
): Promise<void> {
  const notifyClient = errors.shouldNotifyClient(error, msg)

  if (notifyClient === false) {
    logger.debug('Not publishing error message')

    return
  }

  if (hasClientContext(msg)) {
    logger.debug('Publishing error message')
  } else {
    logger.errorDetails(
      'Publishing error message even though msg does not have client context',
    )
  }

  try {
    const msgProperties = cloneAmqpMsgProperties(msg)
    const { headers } = msgProperties
    delete headers[MESSAGE_HEADERS.MESSAGE.JWT]
    headers[MESSAGE_HEADERS.MESSAGE.EVENT_TYPE] = ERROR.EXCHANGE
    headers[MESSAGE_HEADERS.MESSAGE.SERVER_TIMESTAMP] = Date.now()
    const routingKey = `${msg.fields.exchange}${ERROR.ROUTING_KEY_SUFFIX}`

    const channel = await getTemporaryChannel('error')
    channel.publish(
      ERROR.EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(errors.getErrorMessage(error))),
      msgProperties,
    )
  } catch (e) {
    logger.error('Failed to publish error message', <Error>e)
  }
}
