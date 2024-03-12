import type * as amqplib from 'amqplib'
import { getLogger } from '../logger'
import * as amqpHelper from './amqp.helper'
import { connection } from './connection'
import { MANAGED_EXCHANGES } from './constants'
import * as consume from './consume'
import * as featManagement from './feat.management'
import * as message from './message'
import type * as messageHandler from './message_handler'
import * as reinitialize from './register.reinitialize'

const { DEAD_LETTER, FRONTEND } = MANAGED_EXCHANGES
const logger = getLogger('Iris:RegisterProcessed')

export async function register(
  messages: message.ProcessedMessageMetadataI[],
  messageHandlers: messageHandler.ProcessedMessageHandlerMetadataI[],
): Promise<void> {
  for (const msgMeta of messages) {
    await assertExchangeAndQueues(msgMeta, messageHandlers)
  }
}

async function assertExchangeAndQueues(
  msgMeta: message.ProcessedMessageMetadataI,
  messageHandlers: messageHandler.ProcessedMessageHandlerMetadataI[],
): Promise<void> {
  if (msgMeta.processedConfig.assertExchange) {
    await assertExchange(msgMeta)
  }
  const handlers = messageHandlers.filter(
    (mh) => mh.messageClass === msgMeta.target,
  )
  for (const handler of handlers) {
    const obtainChannel = async (): Promise<amqplib.Channel> =>
      connection.assureChannelForHandler(handler)
    const channel = await obtainChannel()
    const reinit = reinitialize.getReinitializationFn(async () => {
      channel.emit('iris:reinit')
      await assertExchangeAndQueues(msgMeta, messageHandlers)
    })

    if (message.isFrontend(msgMeta)) {
      await registerFrontendMessageHandler(handler, msgMeta)
    } else {
      await registerMessageHandler(handler, msgMeta)
    }

    await consume.registerConsumer(handler, msgMeta, obtainChannel, reinit)
  }
}

async function assertExchange(
  msg: message.ProcessedMessageMetadataI,
): Promise<void> {
  if (message.isFrontend(msg)) {
    await initFrontendQueue()
  } else {
    await amqpHelper.assertExchange(
      msg.processedConfig.exchangeName,
      msg.processedConfig.exchangeType,
      msg.processedConfig.exchangeOptions,
    )
  }
}

async function registerMessageHandler(
  handler: messageHandler.ProcessedMessageHandlerMetadataI,
  msgMeta: message.ProcessedMessageMetadataI,
): Promise<void> {
  const channel = await connection.assureChannelForHandler(handler)
  const { exchange, queueName, queueOptions, bindingKeys } =
    handler.processedConfig

  await registerDeadletter(handler, msgMeta)
  await amqpHelper.assertQueue(queueName, queueOptions)

  logger.debug(
    `Bind ${msgMeta.processedConfig.exchangeType} queue to exchange`,
    {
      queueName,
      exchange,
      targetClassName: msgMeta.targetClassName,
      bindingKeys,
    },
  )

  for (const bindKey of bindingKeys) {
    await channel.bindQueue(queueName, exchange, bindKey)
  }
}

async function registerFrontendMessageHandler(
  handler: messageHandler.ProcessedMessageHandlerMetadataI,
  msgMeta: message.ProcessedMessageMetadataI,
): Promise<void> {
  const fronendQueueName = amqpHelper.getFrontendQueueName()
  const channel = await connection.assureChannelForHandler(handler)
  const { routingKey } = msgMeta.processedConfig
  logger.debug(`Bind ${fronendQueueName} queue to FRONTEND exchange`, {
    routingKey,
    fronendQueueName,
    targetClassName: msgMeta.targetClassName,
  })

  await channel.bindQueue(fronendQueueName, FRONTEND.EXCHANGE, routingKey)
}

async function registerDeadletter(
  handler: messageHandler.ProcessedMessageHandlerMetadataI,
  msgMeta: message.ProcessedMessageMetadataI,
): Promise<void> {
  const { deadLetterIsCustom } = msgMeta.processedConfig
  const { deadLetterExchange, deadLetterRoutingKey } =
    handler.processedConfig.queueOptions

  if (
    !deadLetterIsCustom ||
    deadLetterExchange === undefined ||
    deadLetterRoutingKey === undefined
  ) {
    return
  }

  logger.debug(
    `Register custom DQL for '${handler.processedConfig.queueName}'`,
    handler.processedConfig.queueOptions,
  )

  await amqpHelper.assertExchange(
    deadLetterExchange,
    DEAD_LETTER.EXCHANGE_TYPE,
    DEAD_LETTER.EXCHANGE_OPTIONS,
  )
  await amqpHelper.assertQueue(deadLetterExchange, DEAD_LETTER.QUEUE_OPTIONS)

  const channel = await connection.assureChannelForHandler(handler)
  await channel.bindQueue(deadLetterExchange, deadLetterExchange, '#')
}

async function initFrontendQueue(): Promise<void> {
  const fronendQueueName = amqpHelper.getFrontendQueueName()
  await Promise.all([
    featManagement.registerFrontendExchange(),
    amqpHelper.assertQueue(fronendQueueName, FRONTEND.QUEUE_OPTIONS),
  ])
}
