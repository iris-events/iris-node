import * as helper from './helper'
import * as message from './message'
import * as storage from './storage'
import * as interfaces from './message_handler.interfaces'
import * as process from './message_handler.process'
import * as validationI from './validation.interfaces'

type queueHandlerMapT = Record<string, interfaces.ProcessedMessageHandlerMetadataI | undefined>

/**
 * Whether passed handlerClass has any @MessageHandler() deocrated methods
 */
export function hasMessageHandlerDecoratedMethods(handlerClass: Object): boolean {
  return getMessageHandlerDecoratedMethods(handlerClass).length > 0
}

/**
 * Get all processd methods decorated with @MessageHandler() for passed handlerClass
 */
export function getMessageHandlerDecoratedMethods(handlerClass: Object): interfaces.MessageHandlerMetadataI[] {
  return <interfaces.MessageHandlerMetadataI[]>(Reflect.getMetadata(storage.IRIS_MESSAGE_HANDLERS_META, handlerClass) ?? [])
}

export function getProcessedMessageHandlerDecoratedMethods(handlerClass: Object): interfaces.ProcessedMessageHandlerMetadataI[] {
  const result = getMessageHandlerDecoratedMethods(handlerClass).map(mh => ({
    ...mh,
    processedConfig: process.processAndValidateConfig(mh, message.getProcessedMessageDecoratedClass(mh.messageClass)),
  }))

  validateAllHandlersUseDistinctQueues(result)

  return result
}

/**
 * Whether @Message() decorated class has a handler or not
 */
export function hasHandlers(messageClass: Object): boolean {
  return Reflect.getMetadata(storage.IRIS_MESSAGE_HANDLERS, messageClass) !== undefined
}

/**
 * Get a class @MessgeHandler() deocared methods, where one of them
 * is handling passed messageClass
 */
export function getHandlers(messageClass: Object): Object[] {
  const handlerClasses = <Object[] | undefined>Reflect.getMetadata(storage.IRIS_MESSAGE_HANDLERS, messageClass)
  if (handlerClasses === undefined) {
    throw new validationI.ValidationError('NO_SUCH_MESSAGE_HANDLER', 'This @Message() class does not have any handler', {
      targetClassName: helper.getTargetConstructor(messageClass).name,
    })
  }

  return handlerClasses
}

function validateAllHandlersUseDistinctQueues(handlers: interfaces.ProcessedMessageHandlerMetadataI[]): void {
  handlers.reduce((queueHandlerMap: queueHandlerMapT, handler): queueHandlerMapT => {
    const { queueName } = handler.processedConfig
    const otherHandler = queueHandlerMap[queueName]
    if (otherHandler !== undefined) {
      const messageClassName = helper.getTargetConstructor(handler.messageClass).name
      const thisHandlerInfo = `@MessageHandler(${handler.targetClassName}).${handler.methodName}()`
      const otherHandlerInfo = `@MessageHandler(${otherHandler.targetClassName}).${otherHandler.methodName}()`
      throw new validationI.ValidationError(
        'DUPLICATE_MESSAGE_HANDLER',
        `These two handlers would be exchangeably receiving @Message(${messageClassName}):\n - ${thisHandlerInfo} \n - ${otherHandlerInfo}.\nUsing handler for same @Message class is only supported when handling different routing/binding keys.`
      )
    }

    queueHandlerMap[queueName] = handler

    return queueHandlerMap
  }, {})
}
