import type * as amqplib from 'amqplib'
import type { ClassConstructor } from 'class-transformer'
import _ from 'lodash'
import * as uuid from 'uuid'
import { getLogger } from '../logger'
import * as amqpHelper from './amqp.helper'
import { connection } from './connection'
import * as constants from './constants'
import flags from './flags'
import * as helper from './helper'
import * as message from './message'
import { getPublishExchangeProps } from './message.process'
import {
  AmqpMessage,
  isAmqpMessageClass,
} from './message_handler.param.decorator'
import type * as publishI from './publish.interfaces'
import * as validation from './validation'

export * from './publish.interfaces'

const logger = getLogger('Iris:Publish')
const { MESSAGE_HEADERS } = constants

export function getPublisher<T>(messageClass: ClassConstructor<T>) {
  getMessageMetaFromClass(
    messageClass,
    'getPublisher() passed argument should be class decorated with @Message()',
  )

  return async (msg: T, pubOpts?: publishI.PublishOptionsI): Promise<boolean> =>
    publish(messageClass, msg, pubOpts)
}

export function getUserPublisher<T>(messageClass: ClassConstructor<T>) {
  getMessageMetaFromClass(
    messageClass,
    'getPublisher() passed argument should be class decorated with @Message()',
  )

  return async (
    msg: T,
    user: string | AmqpMessage,
    pubOpts?: publishI.PublishOptionsI,
  ): Promise<boolean> => publishToUser(messageClass, msg, user, pubOpts)
}

export const publish = async <T>(
  messageClass: ClassConstructor<T>,
  msg: T,
  pubOpts?: publishI.PublishOptionsI,
): Promise<boolean> => internalPublish<T>(messageClass, msg, pubOpts)

/**
 * Send the mesaage to `user` exchange,
 * ignoring the exchange set on event being published.
 *
 * @{param user} - user id or AmqpMessage
 *  when processing a message from user, AmqpMessage can
 *  be used to get user id from consumed message.
 */
export const publishToUser = async <T>(
  messageClass: ClassConstructor<T>,
  msg: T,
  user: string | AmqpMessage,
  pubOpts?: publishI.PublishOptionsI,
): Promise<boolean> => {
  const userIdString = typeof user === 'string'
  const hasOriginalMsg = !userIdString && isAmqpMessageClass(user)
  const userId = userIdString
    ? user
    : _.get(user, `properties.headers[${MESSAGE_HEADERS.MESSAGE.USER_ID}]`)

  if (!_.isString(userId) || _.isEmpty(userId)) {
    throw new Error('ERR_IRIS_PUBLISHER_USER_ID_NOT_RESOLVED')
  }

  return internalPublish<T>(
    messageClass,
    msg,
    Object.assign({}, pubOpts, { userId }),
    hasOriginalMsg ? <AmqpMessage>user : undefined,
    message.Scope.USER,
  )
}

/**
 * Copies headers and properties from original message to message being published.
 *
 * Functionality is exactly the same as when @MessageHandler returns a @Message.
 */
export const publishReply = async <T>(
  originalMessage: Pick<amqplib.Message, 'properties'>,
  messageClass: ClassConstructor<T>,
  msg: T,
  pubOpts?: publishI.PublishOptionsI,
): Promise<boolean> =>
  internalPublish<T>(messageClass, msg, pubOpts, originalMessage)

async function internalPublish<T>(
  messageClass: ClassConstructor<T>,
  msg: T,
  pubOpts?: publishI.PublishOptionsI,
  originalMessage?: Pick<amqplib.Message, 'properties'>,
  overrideScope?: message.Scope,
): Promise<boolean> {
  const msgMeta = getMessageMetaFromClass(
    messageClass,
    'internalPublish() passed argument should be calss decorated with @Message()',
  )
  const msgString = await msg2String(msg, messageClass, msgMeta)
  const { exchangeName } = msgMeta.processedConfig
  const routingKey = <string>(
    [pubOpts?.routingKey, msgMeta.processedConfig.routingKey, ''].find(
      (s) => s !== undefined,
    )
  )

  return doPublish(
    msgMeta,
    msgString,
    routingKey,
    getAmqpBasicProperties(exchangeName, msgMeta, originalMessage, pubOpts),
    overrideScope,
  )
}

export async function doPublish(
  msgMeta: message.ProcessedMessageMetadataI,
  msg: string,
  routingKeyArg: string,
  options?: amqplib.Options.Publish,
  overrideScope?: message.Scope,
): Promise<boolean> {
  validateBeforePublish(msgMeta, options, overrideScope)

  const { publishingExchangeName, publishingExchangeRoutingKey } =
    overrideScope !== undefined
      ? getPublishExchangeProps({
          scope: overrideScope,
          exchangeName: msgMeta.processedConfig.exchangeName,
        })
      : msgMeta.processedConfig

  const routingKey = publishingExchangeRoutingKey ?? routingKeyArg

  logger.debug('Publishing message', {
    msg,
    routingKey,
    publishingExchangeName,
    options: amqpHelper.safeAmqpObjectForLogging(options),
  })

  const channel = await connection.assureDefaultChannel()

  return channel.publish(
    publishingExchangeName,
    routingKey,
    Buffer.from(msg),
    options,
  )
}

function getMessageMetaFromClass<T>(
  messageClass: ClassConstructor<T>,
  onErrMsg: string,
): message.ProcessedMessageMetadataI {
  try {
    return message.getProcessedMessageDecoratedClass(messageClass)
  } catch (error) {
    logger.error(onErrMsg, <Error>error, { messageClass })
    throw new Error('ERR_IRIS_PUBLISHER_INVALID_MESSAGE_CLASS')
  }
}

async function msg2String<T>(
  msg: T,
  messageClass: ClassConstructor<T>,
  msgMeta: message.ProcessedMessageMetadataI,
): Promise<string> {
  await validation.validationClass.convertToTargetClass(
    msg,
    messageClass,
    msgMeta.validation,
    flags.DISABLE_MESSAGE_PRODUCE_VALIDATION,
  )

  return JSON.stringify(msg)
}

function getAmqpBasicProperties(
  exchangeName: string,
  msgMeta: message.ProcessedMessageMetadataI,
  originalMsg?: Pick<amqplib.Message, 'properties'>,
  pubOpts?: publishI.PublishOptionsI,
): Partial<amqplib.MessageProperties> {
  const amqpProperties = getAmqpPropsWithoutHeaders(originalMsg, pubOpts)
  const amqpHeaders = getAmqpHeaders(exchangeName, originalMsg, pubOpts)

  if (msgMeta.processedConfig.scope !== message.Scope.INTERNAL) {
    // never propagate JWT when "leaving" backend
    delete amqpHeaders[constants.MESSAGE_HEADERS.MESSAGE.JWT]
  }

  if (pubOpts?.userId !== undefined) {
    const serviceId = helper.getServiceName()
    const correlationId = uuid.v4()
    // when overriding user header make sure
    // to clean possible existing event context properties
    amqpProperties.correlationId = correlationId
    amqpHeaders[MESSAGE_HEADERS.MESSAGE.ORIGIN_SERVICE_ID] = serviceId
    amqpHeaders[MESSAGE_HEADERS.MESSAGE.USER_ID] = pubOpts.userId
    delete amqpHeaders[MESSAGE_HEADERS.MESSAGE.ROUTER]
    delete amqpHeaders[MESSAGE_HEADERS.MESSAGE.SESSION_ID]
  }

  return {
    ...amqpProperties,
    headers: amqpHeaders,
  }
}

function getAmqpPropsWithoutHeaders(
  originalMsg?: Pick<amqplib.Message, 'properties'>,
  pubOpts?: publishI.PublishOptionsI,
): Partial<Omit<amqplib.MessageProperties, 'headers'>> {
  const forceOptions = pubOpts?.amqpPublishOpts
  const correlationId = uuid.v4()
  const inheritedProperties:
    | Omit<amqplib.MessageProperties, 'headers'>
    | object = _.chain(originalMsg).get('properties').omit('headers').value()
  const forcedProperties = _.chain(forceOptions).omit('headers').value()

  return {
    correlationId, // will be overridden if found in originalMsg
    ...inheritedProperties,
    ...forcedProperties,
  }
}

function getAmqpHeaders(
  exchangeName: string,
  originalMsg?: Pick<amqplib.Message, 'properties'>,
  pubOpts?: publishI.PublishOptionsI,
): amqplib.MessagePropertyHeaders {
  const forceOptions = pubOpts?.amqpPublishOpts
  const serviceId = helper.getServiceName()
  const inheritedHeaders =
    originalMsg !== undefined ? originalMsg.properties.headers : {}
  const forcedHeaders = forceOptions !== undefined ? forceOptions.headers : {}

  return <amqplib.MessagePropertyHeaders>{
    // set ORIGIN_SERVICE_ID but let it be overriden by inheritedHeaders if exists there
    [MESSAGE_HEADERS.MESSAGE.ORIGIN_SERVICE_ID]: helper.getServiceName(),
    ...inheritedHeaders,
    // force override these default headers
    [MESSAGE_HEADERS.MESSAGE.CURRENT_SERVICE_ID]: serviceId,
    [MESSAGE_HEADERS.MESSAGE.INSTANCE_ID]: helper.getHostName(),
    [MESSAGE_HEADERS.MESSAGE.EVENT_TYPE]: exchangeName,
    // manually passed options should prevail
    ...forcedHeaders,
    [MESSAGE_HEADERS.MESSAGE.SERVER_TIMESTAMP]: Date.now(),
  }
}

function validateBeforePublish(
  msgMeta: message.ProcessedMessageMetadataI,
  options?: amqplib.Options.Publish,
  overrideScope?: message.Scope,
): void {
  const scope = overrideScope ?? msgMeta.processedConfig.scope
  if (scope === message.Scope.FRONTEND) {
    throw new Error('ERR_IRIS_PUBLISH_TO_FRONTENT_SCOPE_NOT_SUPPORTED')
  }
  if (scope === message.Scope.USER) {
    const userId = <string | undefined>(
      options?.headers[MESSAGE_HEADERS.MESSAGE.USER_ID]
    )
    if (userId === undefined) {
      throw new Error('ERR_IRIS_PUBLISH_TO_USER_SCOPE_WITHOUT_USER_ID')
    }
  } else if (scope === message.Scope.SESSION) {
    const sessionId = <string | undefined>(
      options?.headers[MESSAGE_HEADERS.MESSAGE.SESSION_ID]
    )
    if (sessionId === undefined) {
      throw new Error('ERR_IRIS_PUBLISH_TO_SESSION_SCOPE_WITHOUT_SESSION_ID')
    }
  }
}
