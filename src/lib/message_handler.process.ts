import type * as amqplib from 'amqplib'
import _ from 'lodash'
import { MANAGED_EXCHANGES, getQueueDefaultsForExchangeName } from './constants'
import * as helper from './helper'
import * as message from './message'
import * as interfaces from './message_handler.interfaces'
import * as validation from './message_handler.validation'
import * as validationI from './validation.interfaces'

const { FRONTEND, DEAD_LETTER } = MANAGED_EXCHANGES

export function processAndValidateConfig(
  configIntermediate: interfaces.MessageHandlerMetadataI,
  msgMeta: message.ProcessedMessageMetadataI,
): interfaces.ProcessedMessageHandlerConfigI {
  const { exchangeName } = msgMeta.processedConfig

  const origConfig = configIntermediate.origDecoratorConfig

  const messageDeliveryMode =
    origConfig.messageDeliveryMode ?? interfaces.MessageDeliveryMode.PER_SERVICE
  let { durable, autoDelete } = getQueueDefaultsForExchangeName(
    exchangeName,
    origConfig,
  )

  if (
    messageDeliveryMode === interfaces.MessageDeliveryMode.PER_SERVICE_INSTANCE
  ) {
    durable = false
    autoDelete = true
  }

  if (message.isFrontend(msgMeta)) {
    durable = false
  }

  const processedConfig: Omit<
    interfaces.ProcessedMessageHandlerConfigI,
    'queueName' | 'queueOptions'
  > = {
    ..._.omit(origConfig, ['durable', 'autoDelete']),
    messageDeliveryMode,
    exchange: message.isFrontend(msgMeta) ? FRONTEND.EXCHANGE : exchangeName,
    bindingKeys: getBindingKeys(
      configIntermediate,
      origConfig.bindingKeys,
      msgMeta,
    ),
  }

  const queueName = getQueueName(
    configIntermediate.uuid,
    processedConfig,
    msgMeta,
  )
  const queueOptions: interfaces.queueOptionsT = {
    durable,
    autoDelete,
    exclusive: false,
    ...getQueueExtraOptions(queueName, msgMeta),
  }

  const processedHandlerConfig = {
    ...processedConfig,
    queueName,
    queueOptions,
  }

  validation.validateProcessedHandlerConfig(
    processedHandlerConfig,
    configIntermediate,
    msgMeta,
  )

  return processedHandlerConfig
}

function getBindingKeys(
  handlerMetadata: interfaces.MessageHandlerMetadataI,
  bindingKeys: string[] | string | undefined,
  msgMeta: message.ProcessedMessageMetadataI,
): string[] {
  const { exchangeName, exchangeType } = msgMeta.processedConfig

  validation.validateBindingKeysForConfig(handlerMetadata, bindingKeys, msgMeta)

  if (message.isFrontend(msgMeta)) {
    // this decision assumes that FRONTEND exchange is not `direct`
    return [`#.${exchangeName}`]
  }

  if (exchangeType === message.ExchangeType.fanout) {
    return [`#.${exchangeName}`]
  }

  let bKeys = <string[]>[bindingKeys].flat().filter((s) => !_.isEmpty(s))
  validation.validateBindingKeys(bKeys, handlerMetadata, msgMeta)

  // msgMeta.processedConfig.routingKey contains either a routingKey or
  // exchange name if rk is empty.
  if (bKeys.length === 0 && !_.isEmpty(msgMeta.processedConfig.routingKey)) {
    bKeys = [msgMeta.processedConfig.routingKey]
  }

  if (exchangeType === message.ExchangeType.direct && bKeys.length !== 1) {
    throw new validationI.ValidationError(
      'MESSAGE_HANDLER_INVALID_BINDING_KEYS',
      `MessageHandler() ${exchangeType} Message (${exchangeName}) requires exactly one binding key.`,
      {
        bindingKeys,
      },
    )
  }

  return bKeys
}

function getQueueName(
  handlerUuid: string,
  config: Pick<
    interfaces.ProcessedMessageHandlerConfigI,
    'messageDeliveryMode' | 'bindingKeys'
  >,
  msgMeta: message.ProcessedMessageMetadataI,
): string {
  const { messageDeliveryMode, bindingKeys } = config
  const { exchangeName, exchangeType } = msgMeta.processedConfig
  const qName: string[] = [helper.getServiceName(), exchangeName]

  const appendBindingKeys =
    (exchangeType === message.ExchangeType.direct ||
      exchangeType === message.ExchangeType.topic) &&
    !message.isFrontend(msgMeta)

  if (appendBindingKeys) {
    qName.push(bindingKeys.join('-'))
  }

  if (
    messageDeliveryMode === interfaces.MessageDeliveryMode.PER_SERVICE_INSTANCE
  ) {
    qName.push(helper.getHostName(), handlerUuid)
  }

  return qName.filter((part) => part.length > 0).join('.')
}

function getQueueExtraOptions(
  queueName: string,
  msgMeta: message.ProcessedMessageMetadataI,
): Partial<amqplib.Options.AssertQueue> {
  const opts: amqplib.Options.AssertQueue = {}

  const { ttl, deadLetter } = msgMeta.processedConfig

  if (ttl !== undefined) {
    opts.messageTtl = ttl
  }

  if (!_.isEmpty(deadLetter)) {
    opts.deadLetterExchange = deadLetter
    opts.deadLetterRoutingKey = `${DEAD_LETTER.PREFIX}${queueName}`
  }

  return opts
}
