import type * as amqplib from 'amqplib'
import _ from 'lodash'
import { AMQP_MESSAGE_CLASS, SetMetadata } from './storage'

const AMQP_MESSAGE_PROPERTIES = ['content', 'fields', 'properties']

export class AmqpMessage implements amqplib.ConsumeMessage {
  content!: Buffer
  fields!: amqplib.ConsumeMessageFields
  properties!: amqplib.MessageProperties
}

SetMetadata(AMQP_MESSAGE_CLASS, true)(AmqpMessage)

export const isAmqpMessageClass = (target: unknown): boolean => {
  if (typeof target === 'object' && target !== null) {
    if (target instanceof AmqpMessage) {
      return true
    }

    const objKeys = Object.keys(target)

    return (
      objKeys.length === AMQP_MESSAGE_PROPERTIES.length &&
      _.xor(objKeys, AMQP_MESSAGE_PROPERTIES).length === 0 &&
      (<{ content: any }>target).content instanceof Buffer
    )
  }
  if (typeof target === 'function') {
    return (
      target === AmqpMessage || Reflect.getMetadata(AMQP_MESSAGE_CLASS, target)
    )
  }

  return false
}
