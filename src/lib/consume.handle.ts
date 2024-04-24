import type * as amqplib from 'amqplib'
import type * as classTransformer from 'class-transformer'
import _ from 'lodash'
import logger from '../logger'
import * as amqpHelper from './amqp.helper'
import * as consumeAck from './consume.ack'
import * as consumeError from './consume.error'
import * as errors from './errors'
import { amqpToMDC } from './mdc'
import type * as message from './message'
import type * as messageHandler from './message_handler'
import * as publish from './publish'

const TAG = 'Iris:ConsumerHandle'

type ResolveMessageHandlerI = (
  msg: amqplib.ConsumeMessage,
) => messageHandler.ProcessedMessageHandlerMetadataI

type HandleMessageT = {
  resolveMessageHandler: ResolveMessageHandlerI
  obtainChannel: () => Promise<amqplib.Channel>
  queueName: string
  onChannelClose: () => void
  msgMeta: message.ProcessedMessageMetadataI
}

type HandleMessageReturnT = (
  msg: amqplib.ConsumeMessage | null,
) => Promise<void>

export function getMessageHandler({
  resolveMessageHandler,
  obtainChannel,
  queueName,
  onChannelClose,
  msgMeta,
}: HandleMessageT): HandleMessageReturnT {
  return async (msg: amqplib.ConsumeMessage | null): Promise<void> => {
    if (msg === null) {
      logger.warn(
        TAG,
        `Received empty message on queue "${queueName}" (disappeared?)`,
      )
      onChannelClose()

      return
    }

    const ch = await obtainChannel()
    logger.debug(
      TAG,
      `Message received for exchange "${msg.fields.exchange}"`,
      {
        mdc: amqpToMDC(msg),
        queueName,
        message: msg.content.toString(),
        fields: msg.fields,
        headers:
          amqpHelper.safeAmqpObjectForLogging(msg.properties.headers) ??
          '<missing headers>',
      },
    )

    if (consumeAck.ignoreMsg(msg, ch)) {
      logger.debug(TAG, 'Ignoring message', { mdc: amqpToMDC(msg) })

      return
    }

    if (_.isNil(msg.properties.headers)) {
      logger.warn(
        TAG,
        `Received message with no headers on "${msg.fields.exchange}". Assigning empty object.`,
        {
          evt: amqpHelper.safeAmqpObjectForLogging(msg),
        },
      )

      msg.properties.headers = {}
    }

    const handler = resolveMessageHandler(msg)

    try {
      const result: unknown = await handler.callback(msg)
      consumeAck.safeAckMsg(msg, ch, 'ack')

      if (handler.kind === 'WITH_REPLY' && result !== undefined) {
        await publish
          .publishReply(
            msg,
            <classTransformer.ClassConstructor<unknown>>(
              handler.replyMessageClass
            ),
            result,
          )
          .catch((err) => {
            logger.error(TAG, 'Publish reply failed', {
              error: errors.enhancedDetails({ result }, err),
              mdc: amqpToMDC(msg),
            })
          })
      }
    } catch (err) {
      await consumeError.handleConsumeError(
        errors.asError(err),
        handler,
        msgMeta,
        ch,
        msg,
      )
    }
  }
}
