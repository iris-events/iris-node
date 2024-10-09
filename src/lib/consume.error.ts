import type * as amqplib from 'amqplib'
import logger from '../logger'
import {
  cloneAmqpMsgProperties,
  getTemporaryChannel,
  hasClientContext,
} from './amqp.helper'
import { MANAGED_EXCHANGES, MESSAGE_HEADERS } from './constants'
import * as consumeAck from './consume.ack'
import * as consumeRetry from './consume.retry'
import * as errors from './errors'
import * as helper from './helper'
import { amqpToMDC } from './mdc'
import type * as messageI from './message.interfaces'
import type * as messageHandler from './message_handler'

const { ERROR } = MANAGED_EXCHANGES

const TAG = 'Iris:Consumer:HandleError'

export async function handleConsumeError(
  error: Error,
  handler: messageHandler.ProcessedMessageHandlerMetadataI,
  msgMeta: messageI.ProcessedMessageMetadataI,
  channel: amqplib.Channel,
  msg: amqplib.ConsumeMessage,
): Promise<void> {
  const reject = errors.isRejectableError(error)
  const { exchange } = handler.processedConfig
  logger.error(TAG, `Event consume error on "${msg.fields.exchange}"`, {
    mdc: amqpToMDC(msg),
    ...errors.enhancedDetails(
      {
        rejecting: reject,
        exchange,
        handler: handler.processedConfig,
      },
      error,
    ),
  })

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
    logger.debug(TAG, 'Not publishing error message')

    return
  }

  if (hasClientContext(msg)) {
    logger.debug(TAG, 'Publishing error message')
  } else {
    logger.error(
      TAG,
      'Publishing error message even though msg does not have client context',
      {
        mdc: amqpToMDC(msg),
      },
    )
  }

  try {
    const msgProperties = cloneAmqpMsgProperties(msg)
    const { headers } = msgProperties
    delete headers[MESSAGE_HEADERS.MESSAGE.JWT]

    const originEventType = headers[MESSAGE_HEADERS.MESSAGE.EVENT_TYPE]
    if (originEventType !== undefined) {
      headers[MESSAGE_HEADERS.MESSAGE.ORIGIN_EVENT_TYPE] = originEventType
    }

    headers[MESSAGE_HEADERS.MESSAGE.EVENT_TYPE] = ERROR.EXCHANGE
    headers[MESSAGE_HEADERS.MESSAGE.SERVER_TIMESTAMP] = Date.now()
    headers[MESSAGE_HEADERS.MESSAGE.CURRENT_SERVICE_ID] =
      helper.getServiceName()

    const routingKey = `${msg.fields.exchange}${ERROR.ROUTING_KEY_SUFFIX}`

    const channel = await getTemporaryChannel('error')
    channel.publish(
      ERROR.EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(errors.getErrorMessage(error))),
      msgProperties,
    )
  } catch (err) {
    logger.error(
      TAG,
      `Failed to publish error message for "${msg.fields.exchange}"`,
      {
        err: errors.asError(err),
        mdc: amqpToMDC(msg),
      },
    )
  }
}
