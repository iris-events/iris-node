/**
 * Since we don't have MDC like Java, we need
 * to have a way to provide same information, but
 * via param decorators and utilities.
 */

import _ from 'lodash'
import { MDC_PROPERTIES as MDC_PROPS, MESSAGE_HEADERS } from './constants'
import { AmqpMessage } from './message_handler.param.decorator'
import { MDC_CLASS, SetMetadata } from './storage'

const { MESSAGE: MH } = MESSAGE_HEADERS

export type MdcI = {
  sessionId?: string
  userId?: string
  clientTraceId?: string
  correlationId?: string
  eventType?: string
  clientVersion?: string
}

export class MDC implements MdcI {
  sessionId?: string
  userId?: string
  clientTraceId?: string
  correlationId?: string
  eventType?: string
  clientVersion?: string
}

SetMetadata(MDC_CLASS, true)(MDC)

export function amqpToMDC(amqpMessage: Pick<AmqpMessage, 'properties'>) {
  const ref: MdcI = {}

  setFromHeader(amqpMessage, ref, MH.SESSION_ID, MDC_PROPS.SESSION_ID)
  setFromHeader(amqpMessage, ref, MH.USER_ID, MDC_PROPS.USER_ID)
  setFromHeader(amqpMessage, ref, MH.CLIENT_TRACE_ID, MDC_PROPS.CLIENT_TRACE_ID)
  setFromHeader(amqpMessage, ref, MH.EVENT_TYPE, MDC_PROPS.EVENT_TYPE)
  setFromHeader(amqpMessage, ref, MH.CLIENT_VERSION, MDC_PROPS.CLIENT_VERSION)
  if (amqpMessage.properties.correlationId !== undefined) {
    ref.correlationId = amqpMessage.properties.correlationId
  } else {
    setFromHeader(amqpMessage, ref, MH.CORRELATION_ID, MDC_PROPS.CORRELATION_ID)
  }

  return Object.assign(new MDC(), ref)
}

export const isMDCClass = (target: unknown): boolean => {
  if (typeof target === 'object' && target !== null) {
    if (target instanceof MDC) {
      return true
    }
  } else if (typeof target === 'function') {
    return target === MDC || Reflect.getMetadata(MDC_CLASS, target)
  }

  return false
}

function setFromHeader(
  amqpMessage: Pick<AmqpMessage, 'properties'>,
  ref: MdcI,
  header: string,
  key: string,
) {
  const val = _.get(amqpMessage, `properties.headers.${header}`)
  if (!_.isEmpty(val)) {
    ref[key] = val
  }
}
