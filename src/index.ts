// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata'
import { OptionsI } from './index.interfaces'
import { CustomIntegration } from './config'
import { Logger } from './logger'

export * as storage from './lib/storage'
export * as registerProcessed from './lib/register.processed'
export * as validation from './lib/validation'
export * as publish from './lib/publish'
export * as amqpHelper from './lib/amqp.helper'
export * as message from './lib/message'
export * as messageHandler from './lib/message_handler'
export * as consume from './lib/consume'
export * as helper from './lib/helper'
export * as subscription from './lib/subscription'
export * as flags from './lib/flags'
export { connection, Connection, ConnectionConfigI } from './lib/connection'
export * as errors from './lib/errors'
export * from './lib/subscription.messages'
export * as constants from './lib/constants'

export function initSDK(opts: OptionsI): void {
  Logger.custom = opts.logger
  CustomIntegration.UnauthorizedException = opts.unauthorizedException
  CustomIntegration.ForbiddenException = opts.forbiddenException
  CustomIntegration.createParamDecorator = opts.createParamDecorator
  CustomIntegration.getAmqpMessage = opts.getAmqpMessage
}
