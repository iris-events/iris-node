/**
 * Retry is managed by a dedicted manager service, feature is driven
 * through special headers attached to the message.
 */
import _ from 'lodash'
import * as amqplib from 'amqplib'
import { connection } from './connection'
import { MESSAGE_HEADERS, MANAGED_EXCHANGES } from './constants'
import * as messageI from './message.interfaces'
import * as messageHandlerI from './message_handler.interfaces'
import flags from './flags'
import { getTemporaryChannel } from './amqp.helper'
import { getLogger } from '../logger'
import * as errors from './errors'

const { DEAD_LETTER, RETRY } = MANAGED_EXCHANGES

const logger = getLogger('Iris:Consumer:RetryEnqueue')

export async function enqueueWithBackoff(
  msg: amqplib.ConsumeMessage,
  handler: messageHandlerI.ProcessedMessageHandlerMetadataI,
  msgMeta: messageI.ProcessedMessageConfigI,
  error: Error
): Promise<boolean> {
  if (flags.DISABLE_RETRY) {
    return false
  }

  logger.errorDetails('Publishing to retry exchange')

  const channel = await getTemporaryChannel('retry')
  const msgProperties: amqplib.MessageProperties = _.cloneDeep(msg.properties)

  // Happenes on redelivered messages right now that headers are undefined (??)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (msgProperties.headers === undefined) {
    msgProperties.headers = {}
  }

  const { headers } = msgProperties

  headers[MESSAGE_HEADERS.REQUEUE.ORIGINAL_EXCHANGE] = msg.fields.exchange
  headers[MESSAGE_HEADERS.REQUEUE.ORIGINAL_ROUTING_KEY] = msg.fields.routingKey
  headers[MESSAGE_HEADERS.REQUEUE.MAX_RETRIES] = msgMeta.maxRetry ?? connection.getConfig().maxMessageRetryCount
  headers[MESSAGE_HEADERS.REQUEUE.NOTIFY_CLIENT] = errors.shouldNotifyFrontend(error)
  headers[MESSAGE_HEADERS.MESSAGE.SERVER_TIMESTAMP] = Date.now()

  headers[MESSAGE_HEADERS.REQUEUE.ERROR_CODE] = error.constructor.name
  headers[MESSAGE_HEADERS.REQUEUE.ERROR_TYPE] = errors.getErrorType(error)
  headers[MESSAGE_HEADERS.REQUEUE.ERROR_MESSAGE] = error.message

  if (msgMeta.deadLetter !== '') {
    const deadLetterRoutingKey = `${DEAD_LETTER.PREFIX}${handler.processedConfig.queueName}`
    headers[MESSAGE_HEADERS.QUEUE_DECLARATION.DEAD_LETTER_EXCHANGE] = msgMeta.deadLetter
    headers[MESSAGE_HEADERS.QUEUE_DECLARATION.DEAD_LETTER_ROUTING_KEY] = deadLetterRoutingKey
  }

  return channel.publish(RETRY.EXCHANGE, RETRY.ROUTING_KEY, Buffer.from(msg.content), msgProperties)
}
