import { ValidationMetadata } from 'class-validator/types/metadata/ValidationMetadata'
import { ServerObject, SchemaObject, ReferenceObject, ServerVariableObject, InfoObject, SecuritySchemeType, OAuthFlowsObject } from './interfaces_openapi'

export * from './interfaces_openapi'

export type SchemaObjects = Record<string, SchemaObject>
export interface PublicMetadataStorage {
  validationMetadatas: ValidationMetadata[]
}

export enum Operation {
  subscribe = 'subscribe',
  publish = 'publish',
}
export enum ChannelIs {
  queue = 'queue',
  routingKey = 'routingKey',
}

export interface AsyncAPIObject {
  asyncapi: string
  id?: string
  info: InfoObject
  servers?: Record<string, AsyncServerObject>
  channels: AsyncChannelsObject
  components?: AsyncComponentsObject
  tags?: AsyncTagObject[]
  externalDocs?: ExternalDocumentationObject
  defaultContentType?: string
}

export interface AsyncComponentsObject {
  schemas?: Record<string, SchemaObject | ReferenceObject>
  messages?: Record<string, AsyncMessageObject>
  securitySchemes?: Record<string, AsyncSecuritySchemeObject>
  parameters?: Record<string, ParameterObject>
  correlationIds?: Record<string, AsyncCorrelationObject>
  operationTraits?: Record<string, AsyncOperationTraitObject>
  messageTraits?: Record<string, AsyncMessageTraitObject>
  serverBindings?: Record<string, AmqpServerBindingObject>
  channelBindings?: Record<string, AmqpChannelBindingObject>
  operationBindings?: Record<string, AmqpOperationBindingObject>
  messageBindings?: Record<string, AmqpMessageBindingObject>
}

export interface AsyncServerVariableObject extends ServerVariableObject {
  examples?: string[]
}

export type SecurityObject = Record<string, string[]>

export interface AmqpServerBindingObject {}

export interface AsyncServerObject extends Omit<ServerObject, 'variables'> {
  variables?: Record<string, AsyncServerVariableObject>
  protocol: string
  protocolVersion?: string
  security?: SecurityObject[]
  bindings?: Record<string, AmqpServerBindingObject>
}

export type AsyncChannelsObject = Record<string, AsyncChannelObject>
export interface AsyncChannelObject {
  description?: string
  subscribe?: AsyncOperationObject
  publish?: AsyncOperationObject
  parameters?: Record<string, ParameterObject>
  bindings?: Record<string, AmqpChannelBindingObject>
}

export interface AsyncOperationObject {
  operationId?: string
  summary?: string
  description?: string
  tags?: AsyncTagObject[]
  externalDocs?: ExternalDocumentationObject
  bindings?: Record<string, AmqpOperationBindingObject>
  traits?: Record<string, AsyncOperationTraitObject>
  message?: AsyncMessageObject | ReferenceObject
}

export interface AsyncOperationTraitObject {
  operationId?: string
  summary?: string
  description?: string
  tags?: AsyncTagObject[]
  externalDocs?: ExternalDocumentationObject
  bindings?: Record<string, AmqpOperationBindingObject>
}

export interface AsyncMessageTraitObject {
  headers?: SchemaObject
  correlationId?: AsyncCorrelationObject
  schemaFormat?: string
  contentType?: string
  name?: string
  title?: string
  summary?: string
  description?: string
  tags?: AsyncTagObject[]
  externalDocs?: ExternalDocumentationObject
  bindings?: Record<string, AmqpMessageBindingObject>
}

export interface AsyncCorrelationObject {
  description?: string
  location: string
}

export interface AsyncMessageObject extends AsyncMessageTraitObject {
  payload?: unknown
  traits?: AsyncMessageTraitObject
}

export type ParameterObject = BaseParameterObject

export interface BaseParameterObject {
  description?: string
  schema?: SchemaObject | ReferenceObject
  location?: string
}

export interface AmqpQueue {
  name: string
  durable?: boolean
  exclusive?: boolean
  autoDelete?: boolean
  vhost?: string
}

export interface AmqpExchange {
  name: string
  type: string
  durable?: boolean
  autoDelete?: boolean
  vhost?: string
}

export interface AmqpChannelBindingObject {
  is: ChannelIs
  exchange?: AmqpExchange
  queue?: AmqpQueue
  bindingVersion?: string
}

export interface AmqpChannelBindingExchange extends AmqpChannelBindingObject {
  is: ChannelIs.routingKey
  exchange: AmqpExchange
}

export interface AmqpChannelBindingQueue extends AmqpChannelBindingObject {
  is: ChannelIs.queue
  queue: AmqpQueue
}

export interface AmqpOperationBindingObject {
  expiration?: number
  userId?: string
  cc?: string[]
  priority?: number
  deliveryMode?: number
  mandatory?: boolean
  bcc?: string[]
  replyTo?: string
  timestamp?: boolean
  ack?: boolean
  bindingVersion?: string
}

export interface AmqpMessageBindingObject {
  contentEncoding?: string
  messageType?: string
  bindingVersion?: string
}

export interface AsyncTagObject {
  name: string
  description?: string
  externalDocs?: ExternalDocumentationObject
}

export interface AsyncSecuritySchemeObject {
  type: SecuritySchemeType
  description?: string
  name?: string
  in?: string
  scheme?: string
  bearerFormat?: string
  flows?: OAuthFlowsObject
  openIdConnectUrl?: string
}

export interface ExternalDocumentationObject {
  description?: string
  url: string
}
