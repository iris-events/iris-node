import * as amqplib from 'amqplib'
// import * as validation from './validation'
// import flags from './flags'
// import * as messageI from './message.interfaces'
// import { CustomIntegration } from '../config'
// import { AMQP_MESSAGE_CLASS, SetMetadata } from './storage'

// /**
//  * Use to get a @Message() decorated class representing the event msg
//  */
// export const MessageParam = CustomIntegration.createParamDecorator<messageI.MessageMetadataI, unknown, unknown>(async (msgMeta, ctx) => {
//   const event = await validation.validationClass.convertBufferToTargetClass(
//     CustomIntegration.getAmqpMessage(ctx),
//     msgMeta,
//     flags.DISABLE_MESSAGE_CONSUME_VALIDATION
//   )

//   return event
// })

// /**
//  * Use to get a full amqplib.Message object
//  */
// export const AmqpMessageParam = CustomIntegration.createParamDecorator<void, unknown, amqplib.ConsumeMessage>((_data, ctx) => {
//   return CustomIntegration.getAmqpMessage(ctx)
// })

export class AmqpMessage implements amqplib.ConsumeMessage {
  content!: Buffer
  fields!: amqplib.ConsumeMessageFields
  properties!: amqplib.MessageProperties
}

// SetMetadata(AMQP_MESSAGE_CLASS, true)(AmqpMessage)

// export const isAmqpMessageClass = (target: Object): boolean => target === AmqpMessage || Reflect.getMetadata(AMQP_MESSAGE_CLASS, target) === true
