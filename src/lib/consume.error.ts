import * as amqplib from 'amqplib'
import * as messageHandler from './message_handler'
import * as messageI from './message.interfaces'
import { getLogger } from '../logger'
import * as errors from './errors'
import * as consumeRetry from './consume.retry'
import * as consumeAck from './consume.ack'
import { MESSAGE_HEADERS, MANAGED_EXCHANGES } from './constants'
import { getTemporaryChannel } from './amqp.helper'
import _ from 'lodash'

const { ERROR } = MANAGED_EXCHANGES

const logger = getLogger('Iris:Consumer:HandleError')

export async function handleConsumeError(
  error: Error,
  handler: messageHandler.ProcessedMessageHandlerMetadataI,
  msgMeta: messageI.ProcessedMessageMetadataI,
  channel: amqplib.Channel,
  msg: amqplib.ConsumeMessage
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
      error
    )
  )

  if (reject) {
    consumeAck.safeAckMsg(msg, channel, 'reject', false)
    await sendErrorMessage(msg, error)
  } else {
    const enqueued = await consumeRetry.enqueueWithBackoff(msg, handler, msgMeta.processedConfig, error)
    if (enqueued) {
      consumeAck.safeAckMsg(msg, channel, 'ack')
    } else {
      consumeAck.safeAckMsg(msg, channel, 'nack')
    }
  }
}

async function sendErrorMessage(msg: amqplib.ConsumeMessage, error: Error): Promise<void> {
  logger.errorDetails('Publishing Error message')
  try {
    const msgProperties: amqplib.MessageProperties = _.cloneDeep(msg.properties)
    const headers = msgProperties.headers
    delete headers[MESSAGE_HEADERS.MESSAGE.JWT]
    headers[MESSAGE_HEADERS.MESSAGE.EVENT_TYPE] = ERROR.EXCHANGE
    headers[MESSAGE_HEADERS.MESSAGE.SERVER_TIMESTAMP] = Date.now()
    const routingKey = `${msg.fields.exchange}${ERROR.ROUTING_KEY_SUFFIX}`

    const channel = await getTemporaryChannel('error')
    channel.publish(ERROR.EXCHANGE, routingKey, Buffer.from(JSON.stringify(errors.getErrorMessage(error))), msgProperties)
  } catch (e) {
    logger.error('Failed to publish error message', <Error>e)
  }
}
