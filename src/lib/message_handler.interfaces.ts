import * as amqplib from 'amqplib'

export enum MessageDeliveryMode {
  /**
   * Message will be handled by single service instance
   */
  PER_SERVICE_INSTANCE = 'PER_SERVICE_INSTANCE',
  /**
   * Message will be handled by all running service instances
   */
  PER_SERVICE = 'PER_SERVICE',
}

export type queueOptionsT = amqplib.Options.AssertQueue & { durable: boolean; autoDelete: boolean; exclusive: boolean }

export type handlerCallbackI = (...args: unknown[]) => Promise<unknown>

export interface MessageHandlerI {
  bindingKeys?: string[] | string
  /**
   * If true, the queue will survive broker restarts (defaults to true)
   */
  durable?: boolean
  /**
   * If true, the queue will be deleted when the number of consumers drops to zero
   * (defaults to false)
   */
  autoDelete?: boolean
  /**
   * Amount of messages that can be received on queue at same time.
   * Set it to some low number (like 1) for events causing a long/resource heavy
   * tasks.
   */
  prefetch?: number
  messageDeliveryMode?: MessageDeliveryMode
}

export interface MessageHandlerMetadataI {
  uuid: string
  target: Object
  targetClassName: string
  methodName: string
  isStaticMethod: boolean
  descriptor: PropertyDescriptor
  messageClass: Object
  replyMessageClass?: Object
  callback: handlerCallbackI
  origDecoratorConfig: MessageHandlerI
}

export interface ProcessedMessageHandlerMetadataI extends MessageHandlerMetadataI {
  processedConfig: ProcessedMessageHandlerConfigI
}

export interface ProcessedMessageHandlerConfigI extends Omit<MessageHandlerI, 'bindingKeys' | 'autoDelete' | 'durable'> {
  bindingKeys: string[]
  messageDeliveryMode: MessageDeliveryMode
  queueOptions: queueOptionsT
  queueName: string
  /**
   * Exchange queue needs to bind to, can differ from the one
   * found in related ProcessedMessageHandlerMetadataI in some
   * cases (like when FRONTEND scope is used).
   */
  exchange: string
}
