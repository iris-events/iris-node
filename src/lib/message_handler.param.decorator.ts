import type * as amqplib from 'amqplib'
import { AMQP_MESSAGE_CLASS, SetMetadata } from './storage'

export class AmqpMessage implements amqplib.ConsumeMessage {
  content!: Buffer
  fields!: amqplib.ConsumeMessageFields
  properties!: amqplib.MessageProperties
}

SetMetadata(AMQP_MESSAGE_CLASS, true)(AmqpMessage)

export const isAmqpMessageClass = (target: Object): boolean =>
  target === AmqpMessage ||
  Reflect.getMetadata(AMQP_MESSAGE_CLASS, target) === true
