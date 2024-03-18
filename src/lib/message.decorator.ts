import { randomUUID } from 'node:crypto'
import * as helper from './helper'
import type * as interfaces from './message.interfaces'
import * as storage from './storage'
import type * as validationI from './validation.interfaces'

/**
 * AMQP exchange decorator.
 * Decorate a class representing a message for publishing or consuming (in conjunction with @MessageHandler).
 * Use class-validator decorators (eg. @IsString()) on class's properties for message automatic validation.
 */
export const Message =
  (
    config: interfaces.MessageI,
    validationOptions?: validationI.ValidationOptions,
  ): ClassDecorator =>
  (target): void => {
    const targetClassName = helper.getTargetConstructor(target).name

    storage.registerMessage(target)
    storage.SetMetadata<string, interfaces.MessageMetadataI>(
      storage.IRIS_MESSAGE,
      {
        uuid: randomUUID(),
        target,
        targetClassName,
        validation: validationOptions,
        origDecoratorConfig: config,
      },
    )(target)
  }
