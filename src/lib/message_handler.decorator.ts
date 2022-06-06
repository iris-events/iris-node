import * as _ from 'lodash'
import * as uuid from 'uuid'
import * as helper from './helper'
import * as message from './message'
import * as storage from './storage'
import * as interfaces from './message_handler.interfaces'
// import * as paramDecorators from './message_handler.param.decorator'
import * as validationI from './validation.interfaces'
import * as decoratorUtils from './message_handler.decorator_utils'

/**
 * AMQP queue decorator.
 */
export const MessageHandler =
  (config: interfaces.MessageHandlerI = {}, replyClass?: Object): MethodDecorator =>
  (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor): void => {
    const targetName = helper.getTargetConstructor(target).name
    const isStaticMethod = target instanceof Function
    const targetConstructor = isStaticMethod ? target : target.constructor
    const targetMessage = manageAutoDecoratedArguments(target, propertyKey)

    if (replyClass !== undefined && !message.isMessageDecoratedClass(replyClass)) {
      throw new validationI.ValidationError('INVALID_HANDLER_REPLY_CLASS', 'MessageHandler() replyClass should be class decorated with @Message()', {
        target: helper.getTargetConstructor(target).name,
        method: <string>propertyKey,
      })
    }

    const handler: interfaces.MessageHandlerMetadataI = {
      uuid: uuid.v4(),
      target,
      targetClassName: targetName,
      methodName: <string>propertyKey,
      isStaticMethod,
      descriptor,
      replyMessageClass: replyClass,
      messageClass: targetMessage,
      origDecoratorConfig: config,
      callback: <(...args: unknown[]) => Promise<unknown>>descriptor.value,
    }

    // a class can have multiple @MessageHandler() methods
    const handlers = [...decoratorUtils.getMessageHandlerDecoratedMethods(targetConstructor), handler]

    storage.SetMetadata<string, interfaces.MessageHandlerMetadataI[]>(storage.IRIS_MESSAGE_HANDLERS_META, handlers)(targetConstructor)

    const msgHandlers = decoratorUtils.hasHandlers(targetMessage) ? decoratorUtils.getHandlers(targetMessage) : []
    msgHandlers.push(targetConstructor)
    storage.SetMetadata<string, Object[]>(storage.IRIS_MESSAGE_HANDLERS, msgHandlers)(targetConstructor)
  }

function manageAutoDecoratedArguments(target: Object, propertyKey: string | symbol): Object {
  const methodArgs = <typeof Function[]>Reflect.getMetadata('design:paramtypes', target, propertyKey)
  const targetMessage: Object | undefined = methodArgs.find(arg => message.isMessageDecoratedClass(arg))

  // for (let pos = 0; pos < methodArgs.length; pos++) {
  //   const arg = methodArgs[pos]

  //   if (message.isMessageDecoratedClass(arg)) {
  //     if (targetMessage !== undefined) {
  //       throwTargetMsgError(target, propertyKey)
  //     }

  //     targetMessage = arg
  //     const msgMeta = message.getMessageDecoratedClass(targetMessage)
  //     paramDecorators.MessageParam(msgMeta)(target, propertyKey, pos)
  //   } else if (paramDecorators.isAmqpMessageClass(arg)) {
  //     paramDecorators.AmqpMessageParam()(target, propertyKey, pos)
  //   }
  // }

  if (targetMessage === undefined) {
    throwTargetMsgError(target, propertyKey)
  }

  return targetMessage
}

function throwTargetMsgError(target: Object, propertyKey: string | symbol): never {
  throw new validationI.ValidationError(
    'INVALID_HANDLER_CONFIG',
    'MessageHandler() should be a method accepting exactly one argument of a class decorated with @Message()',
    {
      target: helper.getTargetConstructor(target).name,
      method: propertyKey,
    }
  )
}
