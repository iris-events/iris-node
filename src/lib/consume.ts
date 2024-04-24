import type * as amqplib from 'amqplib'
import logger from '../logger'
import * as amqpHelper from './amqp.helper'
import * as consumeHandle from './consume.handle'
import * as helper from './helper'
import * as message from './message'
import * as messageHandler from './message_handler'

export type ConsumeHanderT = (
  msg: amqplib.ConsumeMessage | null,
) => Promise<void>

type RegisterQueueConsumerT = {
  handler: messageHandler.ProcessedMessageHandlerMetadataI
  consumerTag: string
  obtainChannel: () => Promise<amqplib.Channel>
  onChannelClose: () => void
}

const TAG = 'Iris:Consumer'

const queueConsumers: Record<string, boolean> = {}
const frontendMessageHandlers: Record<
  string,
  messageHandler.ProcessedMessageHandlerMetadataI | undefined
> = {}

export async function registerConsumer(
  handler: messageHandler.ProcessedMessageHandlerMetadataI,
  msgMeta: message.ProcessedMessageMetadataI,
  obtainChannel: () => Promise<amqplib.Channel>,
  onChannelClose: () => void,
): Promise<void> {
  const isFrontend = message.isFrontend(msgMeta)
  const { exchange, queueName } = handler.processedConfig
  const consumerTag = getConsumerTag(msgMeta, handler)
  const frontendHandlerLookupKey = getFrontendHandlerLookupKey(
    msgMeta.processedConfig.routingKey,
  )
  const queueToConsume = isFrontend
    ? amqpHelper.getFrontendQueueName()
    : queueName

  const consumerRegistered = await registerQueueConsumerIfMissing({
    handler,
    consumerTag,
    obtainChannel,
    onChannelClose,
  })

  if (isFrontend) {
    frontendMessageHandlers[frontendHandlerLookupKey] = handler
  }

  if (!consumerRegistered) {
    logger.debug(TAG, 'Already consuming queue', { queueName, exchange })

    return
  }

  const channel = await obtainChannel()
  const resolveMessageHandler = isFrontend
    ? getFrontendHandler
    : (): messageHandler.ProcessedMessageHandlerMetadataI => handler

  await channel.consume(
    queueToConsume,
    consumeHandle.getMessageHandler({
      obtainChannel,
      onChannelClose,
      msgMeta,
      queueName,
      resolveMessageHandler,
    }),
    { consumerTag },
  )
}

async function registerQueueConsumerIfMissing({
  consumerTag,
  handler,
  obtainChannel,
  onChannelClose,
}: RegisterQueueConsumerT): Promise<boolean> {
  const { queueName, exchange, bindingKeys } = handler.processedConfig

  if (queueConsumers[consumerTag]) {
    return false
  }

  queueConsumers[consumerTag] = true

  const cleanup = (tag: string) => (): void => {
    logger.debug(TAG, `Unregister queue consumer for (channel ${tag})`, {
      queueName,
      exchange,
      bindingKeys,
      consumerTag,
    })
    queueConsumers[consumerTag] = false
  }

  const channel = await obtainChannel()
  channel.once('close', cleanup('closed'))
  channel.once('iris:reinit', cleanup('reinit'))
  channel.once('close', onChannelClose)

  return true
}

function getFrontendHandler(
  msg: amqplib.ConsumeMessage,
): messageHandler.ProcessedMessageHandlerMetadataI {
  return <messageHandler.ProcessedMessageHandlerMetadataI>(
    frontendMessageHandlers[getFrontendHandlerLookupKey(msg.fields.routingKey)]
  )
}

export function getConsumerTag(
  msgMeta: message.ProcessedMessageMetadataI,
  handler: messageHandler.ProcessedMessageHandlerMetadataI,
): string {
  const { queueName, messageDeliveryMode } = handler.processedConfig
  const queueTag = message.isFrontend(msgMeta)
    ? amqpHelper.getFrontendQueueName()
    : queueName
  const delivery =
    messageDeliveryMode ===
    messageHandler.MessageDeliveryMode.PER_SERVICE_INSTANCE
      ? `(${messageDeliveryMode})`
      : ''

  return `${helper.getServiceName()}@${helper.getHostName()}#${queueTag}${delivery}`
}

function getFrontendHandlerLookupKey(routingKey: string): string {
  return `fontend_${routingKey}`
}
