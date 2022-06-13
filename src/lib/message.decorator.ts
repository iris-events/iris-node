import * as uuid from 'uuid'
import * as storage from './storage'
import * as helper from './helper'
import * as validationI from './validation.interfaces'
import * as interfaces from './message.interfaces'

/**
 * AMQP exchange decorator.
 * Decorate a class representing a message for publishing or consuming (in conjunction with @MessageHandler).
 * Use class-validator decorators (eg. @IsString()) on class's properties for message automatic validation.
 */
export const Message =
  (config: interfaces.MessageI, validationOptions?: validationI.ValidationOptions): ClassDecorator =>
  (target): void => {
    const targetClassName = helper.getTargetConstructor(target).name

    storage.registerMessage(target)
    storage.SetMetadata<string, interfaces.MessageMetadataI>(storage.IRIS_MESSAGE, {
      uuid: uuid.v4(),
      target,
      targetClassName,
      validation: validationOptions,
      origDecoratorConfig: config,
    })(target)
  }
