import type * as amqplib from 'amqplib'
import logger from '../logger'
import { asError } from './errors'

const TAG = 'Iris:Consumer.Ack'

const nonAckedMsgs: amqplib.ConsumeMessage[] = []

export function safeAckMsg(
  msg: amqplib.ConsumeMessage,
  channel: amqplib.Channel,
  method: 'ack' | 'nack' | 'reject',
  enqueue?: boolean,
): void {
  try {
    switch (method) {
      case 'reject':
        channel.reject(msg, enqueue)
        break
      case 'nack':
        channel.nack(msg, undefined, enqueue)
        break
      //case "ack":
      default:
        channel.ack(msg)
        break
    }
  } catch (err) {
    logger.error(TAG, 'SafeAckMsg can not (n)ack message', {
      err: asError(err),
      info: {
        method,
        enqueue,
      },
    })
    if (method === 'ack') {
      nonAckedMsgs.push(msg)
    }
  }
}

export function ignoreMsg(
  msg: amqplib.ConsumeMessage,
  channel: amqplib.Channel,
): boolean {
  if (!msg.fields.redelivered) {
    return false
  }

  for (let pos = 0; pos < nonAckedMsgs.length; pos++) {
    const nonAckedMsg = nonAckedMsgs[pos]
    if (Buffer.compare(nonAckedMsg.content, msg.content) === 0) {
      nonAckedMsgs.splice(pos, 1)
      safeAckMsg(msg, channel, 'ack')
      logger.warn(TAG, 'IgnoreMsg ACKing previously unacked msg')

      return true
    }
  }

  return false
}
