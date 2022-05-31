import * as amqplib from 'amqplib'
import * as validationI from './validation.interfaces'

export type AssertExchangeI = amqplib.Options.AssertExchange & { durable: boolean; autoDelete: boolean }

export enum ExchangeType {
  // bindingKey must equal routingKey
  direct = 'direct',
  // bindingKey is a pattern containing `*` and/or `#` chars.
  // If non are present then it's same as using `direct`
  topic = 'topic',
  // bindingKey is ignored
  fanout = 'fanout',
}

export enum Scope {
  /**
   * Backend inter-service message
   */
  INTERNAL = 'INTERNAL',
  /**
   * Request message on websocket from client/frontend
   */
  FRONTEND = 'FRONTEND',
  /**
   * Message intended for user on all his sessions
   */
  USER = 'USER',
  /**
   * Message intended for user on exact session
   */
  SESSION = 'SESSION',
  /**
   * Message intended for all users on all sessions
   */
  BROADCAST = 'BROADCAST',
}

export interface MessageI {
  /**
   * Name of exchange
   */
  name: string
  /**
   * Defaults to `fanout`
   */
  exchangeType?: ExchangeType
  routingKey?: string
  scope?: Scope
  ttl?: number
  deadLetter?: string
  /**
   * Max times this message should be sent to retry queue
   * before considered unhandled. Overrides default from
   * connection configuration.
   */
  maxRetry?: number
}

export interface MessageMetadataI {
  uuid: string
  target: Object
  targetClassName: string
  validation?: validationI.ValidationOptions
  origDecoratorConfig: MessageI
}

export interface ProcessedMessageMetadataI extends MessageMetadataI {
  processedConfig: ProcessedMessageConfigI
}

export interface ProcessedMessageConfigI extends Omit<MessageI, 'name'> {
  exchangeName: string
  /**
   * Most SCOPEs publish to specific exchanges
   */
  publishingExchangeName: string
  /**
   * If set, must be used when publishing instead of
   * routingKey
   */
  publishingExchangeRoutingKey?: string
  exchangeType: ExchangeType
  routingKey: string
  scope: Scope
  deadLetter: string
  deadLetterIsCustom: boolean
  exchangeOptions: AssertExchangeI
}
