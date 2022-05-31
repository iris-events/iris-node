import * as _ from 'lodash'
import * as interfaces from './subscription.interfaces'
import { MessageHandler } from './message_handler.decorator'

/**
 * AMQP queue decorator for SubscriptionMessageHandler.
 */
export const SnapshotMessageHandler =
  (config: interfaces.SnapshotMessageHandlerI, replyClass?: Object): MethodDecorator =>
  (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor): void => {
    const { resourceType, ...msgHandlerConfig } = config
    MessageHandler({ ...msgHandlerConfig, bindingKeys: resourceType }, replyClass)(target, propertyKey, descriptor)
  }
