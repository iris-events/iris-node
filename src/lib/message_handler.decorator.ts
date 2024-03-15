import * as uuid from 'uuid'
import * as helper from './helper'
import * as message from './message'
import * as decoratorUtils from './message_handler.decorator_utils'
import type * as interfaces from './message_handler.interfaces'
import * as storage from './storage'
import * as validationI from './validation.interfaces'
/**
 * AMQP queue decorator.
 */
export const MessageHandler =
  (
    config: interfaces.MessageHandlerI = {},
    replyMessageClass?: Object,
  ): MethodDecorator =>
  (
    target: Object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): void => {
    const targetName = helper.getTargetConstructor(target).name
    const isStaticMethod = target instanceof Function
    const targetConstructor = isStaticMethod ? target : target.constructor
    const targetMessage = manageAutoDecoratedArguments(target, propertyKey)

    if (
      replyMessageClass !== undefined &&
      !message.isMessageDecoratedClass(replyMessageClass)
    ) {
      throw new validationI.ValidationError(
        'INVALID_HANDLER_REPLY_CLASS',
        'MessageHandler() replyClass should be class decorated with @Message()',
        {
          target: helper.getTargetConstructor(target).name,
          method: <string>propertyKey,
        },
      )
    }

    let handler: interfaces.MessageHandlerMetadataI = {
      kind: 'NO_REPLY',
      uuid: uuid.v4(),
      target,
      targetClassName: targetName,
      methodName: <string>propertyKey,
      isStaticMethod,
      descriptor,
      messageClass: targetMessage,
      origDecoratorConfig: config,
      callback: <(...args: unknown[]) => Promise<unknown>>descriptor.value,
    }

    if (replyMessageClass !== undefined) {
      handler = {
        ...handler,
        kind: 'WITH_REPLY',
        replyMessageClass,
        replyMessageClassName:
          helper.getTargetConstructor(replyMessageClass).name,
      }
    }

    // a class can have multiple @MessageHandler() methods
    const handlers = [
      ...decoratorUtils.getMessageHandlerDecoratedMethods(targetConstructor),
      handler,
    ]

    storage.SetMetadata<string, interfaces.MessageHandlerMetadataI[]>(
      storage.IRIS_MESSAGE_HANDLERS_META,
      handlers,
    )(targetConstructor)

    decoratorUtils.addHandlerForMsg(targetMessage, targetConstructor)
  }

function manageAutoDecoratedArguments(
  target: Object,
  propertyKey: string | symbol,
): Function {
  const methodArgs = <(typeof Function)[]>(
    Reflect.getMetadata('design:paramtypes', target, propertyKey)
  )
  const targetMessage = methodArgs.filter(message.isMessageDecoratedClass)

  if (targetMessage.length !== 1) {
    throwTargetMsgError(target, propertyKey)
  }

  return targetMessage[0]
}

function throwTargetMsgError(
  target: Object,
  propertyKey: string | symbol,
): never {
  throw new validationI.ValidationError(
    'INVALID_HANDLER_CONFIG',
    'MessageHandler() should be a method accepting exactly one argument of a class decorated with @Message()',
    {
      target: helper.getTargetConstructor(target).name,
      method: propertyKey,
    },
  )
}
