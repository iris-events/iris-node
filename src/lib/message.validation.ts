import * as _ from 'lodash'
import * as helper from './helper'
import * as interfaces from './message.interfaces'
import * as validationIris from './validation.iris'
import { ValidationError } from './validation.interfaces'

export function validateProcessedMessageConfig(msgConfig: interfaces.MessageI, target: Object): void {
  const { name, routingKey, exchangeType, deadLetter } = msgConfig
  const targetClassName = helper.getTargetConstructor(target).name

  if (_.isEmpty(name)) {
    throw new ValidationError('MESSAGE_REQUIRES_NAME', `@Message(${targetClassName}) requires a non empty name to be set`, {
      targetClassName: helper.getTargetConstructor(target).name,
    })
  }

  validationIris.throwIfValueIsInvalidCaseFormat(name, 'MESSAGE_INVALID_NAME', `Name for @Message(${helper.getTargetConstructor(target).name})`)

  if (routingKey !== undefined) {
    validationIris.throwIfValueIsInvalidCaseFormat(
      routingKey,
      'MESSAGE_INVALID_ROUTING_KEY',
      `Routing Key for @Message(${targetClassName})`,
      exchangeType === interfaces.ExchangeType.topic
    )
  }

  if (deadLetter !== undefined) {
    validationIris.throwIfValueIsInvalidCaseFormat(deadLetter, 'MESSAGE_INVALID_DEAD_LETTER_NAME', `DeadLetter for @Message(${targetClassName})`)
  }
}
