import _ from 'lodash'
import * as helper from './helper'
import * as interfaces from './message.interfaces'
import * as processMsg from './message.process'
import * as storage from './storage'
import * as validationI from './validation.interfaces'

export function isMessageDecoratedClass(messageClass: Object): boolean {
  return Reflect.getMetadata(storage.IRIS_MESSAGE, messageClass) !== undefined
}

export function getMessageDecoratedClass(
  messageClass: Object,
): interfaces.MessageMetadataI {
  const msgMeta = <interfaces.ProcessedMessageMetadataI | undefined>(
    Reflect.getMetadata(storage.IRIS_MESSAGE, messageClass)
  )
  if (msgMeta === undefined) {
    throw new validationI.ValidationError(
      'NO_SUCH_MESSAGE',
      'Class is not decorated usig @Message()',
      {
        targetClassName: helper.getTargetConstructor(messageClass).name,
      },
    )
  }

  return msgMeta
}

export function getProcessedMessageDecoratedClass(
  messageClass: Object,
): interfaces.ProcessedMessageMetadataI {
  const msgMeta = getMessageDecoratedClass(messageClass)
  const processedConfig = processMsg.processAndValidateConfig(
    msgMeta.origDecoratorConfig,
    msgMeta.target,
  )

  validateMessageIsUnique(msgMeta)

  return { ...msgMeta, processedConfig }
}

export function isFrontend(arg: {
  processedConfig: Pick<interfaces.MessageI, 'scope'>
}): boolean {
  const { scope } = arg.processedConfig

  return scope === interfaces.Scope.FRONTEND
}

export function collectProcessedMessages(): interfaces.ProcessedMessageMetadataI[] {
  return storage.getMessageStore().map(getProcessedMessageDecoratedClass)
}

function validateMessageIsUnique(msgMeta: interfaces.MessageMetadataI): void {
  const { target } = msgMeta
  const msgWithSameName = storage
    .getMessageStore()
    .map(getMessageDecoratedClass)
    .find(
      (msg) =>
        msg.target !== msgMeta.target &&
        exchangeNameDistinct(msg) === exchangeNameDistinct(msgMeta),
    )

  if (msgWithSameName !== undefined) {
    throw new validationI.ValidationError(
      'MESSAGE_NAME_NOT_UNIQUE',
      'Another class decorated with @Message() holds same `name`',
      {
        thisClassName: helper.getTargetConstructor(target).name,
        otherClassName: helper.getTargetConstructor(msgWithSameName.target)
          .name,
        name: msgMeta.origDecoratorConfig.name,
      },
    )
  }
}

function exchangeNameDistinct(arg: {
  origDecoratorConfig: Pick<interfaces.MessageI, 'name' | 'scope'>
}): string {
  return [
    arg.origDecoratorConfig.scope ?? '',
    _.kebabCase(arg.origDecoratorConfig.name),
  ].join('_')
}
