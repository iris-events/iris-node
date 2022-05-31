import _ from 'lodash'
import * as interfaces from './message_handler.interfaces'
import * as messageI from './message.interfaces'
import * as helper from './helper'
import * as validationIris from './validation.iris'
import * as message from './message'
import { SnapshotRequested } from './subscription.messages'
import { ValidationError } from './validation.interfaces'

export function validateProcessedHandlerConfig(
  processedHandlerConfig: interfaces.ProcessedMessageHandlerConfigI,
  handlerMetadata: interfaces.MessageHandlerMetadataI,
  msgMeta: messageI.ProcessedMessageMetadataI
): void {
  if (processedHandlerConfig.messageDeliveryMode === interfaces.MessageDeliveryMode.PER_SERVICE_INSTANCE) {
    const { scope } = msgMeta.processedConfig
    if (scope === messageI.Scope.FRONTEND) {
      throw new ValidationError(
        'PER_SERVICE_INSTANCE_NOT_SUPPORTED_FOR_FRONTEND_SCOPE',
        'FRONTEND scope can not be used with PER_SERVICE_INSTANCE delivery',
        getErrorDetails(handlerMetadata, msgMeta)
      )
    }

    if (helper.classIsSameOrSubclassOf(<Function>handlerMetadata.messageClass, SnapshotRequested)) {
      throw new ValidationError(
        'PER_SERVICE_INSTANCE_NOT_SUPPORTED_WITH_SNAPSHOT_REQUESTED_MESSAGE',
        `@Message(${SnapshotRequested.name}) can not be used with PER_SERVICE_INSTANCE delivery`,
        getErrorDetails(handlerMetadata, msgMeta)
      )
    }
  }
}

export function validateBindingKeysForConfig(
  handlerMetadata: interfaces.MessageHandlerMetadataI,
  bindingKeys: string[] | string | undefined,
  msgMeta: message.ProcessedMessageMetadataI
): void {
  if (bindingKeys !== undefined) {
    const { exchangeType } = msgMeta.processedConfig
    if (message.isFrontend(msgMeta)) {
      throw new ValidationError(
        'MESSAGE_HANDLER_BINDING_KEYS_ARE_OVERRIDDEN_FOR_FRONTEND_SCOPE',
        `@Message(${msgMeta.targetClassName}) is FRONTEND, bindingKeys are set internally in this case`,
        getErrorDetails(handlerMetadata, msgMeta)
      )
    } else if (exchangeType === message.ExchangeType.fanout) {
      throw new ValidationError(
        'MESSAGE_HANDLER_BINDING_KEYS_HAVE_NO_EFFECT_FOR_FANOUT_EXCHANGE',
        `@Message(${msgMeta.targetClassName}) is FANOUT exchangeType, bindingKeys are ignored in this case`,
        getErrorDetails(handlerMetadata, msgMeta)
      )
    }
  }
}

export function validateBindingKeys(bindingKeys: string[], handlerMeta: interfaces.MessageHandlerMetadataI, msgMeta: message.ProcessedMessageMetadataI): void {
  const { exchangeType } = msgMeta.processedConfig
  bindingKeys.forEach(bindingKey =>
    validationIris.throwIfValueIsInvalidCaseFormat(
      bindingKey,
      'MESSAGE_HANDLER_INVALID_BINDING_KEYS',
      `@MessageHandler(${handlerMeta.targetClassName}).${handlerMeta.methodName}: bindingKey '${bindingKey}'`,
      exchangeType === message.ExchangeType.topic
    )
  )
}

function getErrorDetails(handlerMetadata: interfaces.MessageHandlerMetadataI, msgMeta: message.ProcessedMessageMetadataI): Record<string, string> {
  return {
    handler: handlerMetadata.targetClassName,
    method: handlerMetadata.methodName,
    message: msgMeta.targetClassName,
  }
}
