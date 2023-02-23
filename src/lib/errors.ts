import _ from 'lodash'
import * as amqplib from 'amqplib'
import * as classValidator from 'class-validator'
import { ClassConstructor } from 'class-transformer'
import { hasClientContext } from './amqp.helper'

export const UnauthorizedError = class UnauthorizedException extends Error {}
export const ForbiddenError = class ForbiddenException extends Error {}

export interface CustomErrorI {
  errorClass: ClassConstructor<Error>
  errorType: ErrorTypeE
  // when registring custom errors, this flag
  // can be used to override `notifyClient` flag
  // on error itself.
  alwaysNotifyClient?: true
}

const REJECTABLE_ERRORS: CustomErrorI[] = []

export interface ErrorMessageI {
  errorType: ErrorTypeE
  code: string
  message: string
}

export enum ErrorTypeE {
  // security
  'FORBIDDEN' = 'FORBIDDEN',
  'UNAUTHORIZED' = 'UNAUTHORIZED',
  'AUTHORIZATION_FAILED' = 'AUTHORIZATION_FAILED',
  // client
  'BAD_REQUEST' = 'BAD_REQUEST',
  'NOT_FOUND' = 'NOT_FOUND',
  // server
  'INTERNAL_SERVER_ERROR' = 'INTERNAL_SERVER_ERROR',
}

export abstract class MsgError extends Error {
  errorType: ErrorTypeE = ErrorTypeE.INTERNAL_SERVER_ERROR

  /**
   * Whether error should be propagated back to the client.
   * If not set, IRIS will do this when client's context is
   * available.
   */
  notifyClient?: boolean = undefined

  constructor(msg: string)
  constructor(msg: string, notifyClient: boolean)
  constructor(msg: string, notifyClient?: boolean) {
    super(msg)
    if (notifyClient !== undefined) {
      this.notifyClient = notifyClient
    }
  }

  /**
   * Whether error should be propagated back to the client.
   * If not set, IRIS will do this when client's context is
   * available.
   */
  public setNotifyClient(notifyClient: boolean): MsgError {
    this.notifyClient = notifyClient

    return this
  }

  public trhow(): never {
    throw this
  }

  public getMessage(): string {
    return this.message
  }
}

/**
 * When this error is thrown by @MessageHandler() method
 * the message is automatically rejected, no retry/enqueue
 * mechanism is used.
 */

export class RejectMsgError extends MsgError {
  errorType: ErrorTypeE = ErrorTypeE.BAD_REQUEST
}

export class InvalidObjectConverionError extends RejectMsgError {
  validationErrors: classValidator.ValidationError[]

  constructor(errorDetails: classValidator.ValidationError[]) {
    super('InvalidObjectCoversion')
    this.validationErrors = errorDetails
  }

  public getMessage(): string {
    return JSON.stringify(this.validationErrors)
  }
}

export function enhancedDetails<T extends Object>(details: T, error: Error): T {
  let detailsEnhanced = { ...details }
  if (error instanceof InvalidObjectConverionError) {
    detailsEnhanced = { ...detailsEnhanced, validation: error.validationErrors }
  } else {
    detailsEnhanced = { ...details, err: error }
  }

  return detailsEnhanced
}

export function getErrorType(error: Error): ErrorTypeE {
  if (error instanceof MsgError) {
    return error.errorType
  }

  if (error instanceof UnauthorizedError) {
    return ErrorTypeE.UNAUTHORIZED
  }
  if (error instanceof ForbiddenError) {
    return ErrorTypeE.FORBIDDEN
  }

  const asRejectable = getIfRejectableError(error)
  if (asRejectable !== undefined) {
    return asRejectable.errorType
  }

  return ErrorTypeE.INTERNAL_SERVER_ERROR
}

export function getErrorMessage(error: Error): ErrorMessageI {
  const message = error instanceof MsgError ? error.getMessage() : error.message

  return {
    errorType: getErrorType(error),
    code: error.constructor.name,
    message: message,
  }
}

export function shouldNotifyClient(error: Error, msg: amqplib.ConsumeMessage): boolean {
  const customRejectableError = getIfRejectableError(error)

  if (customRejectableError?.alwaysNotifyClient === true) {
    return true
  }

  const explicit = error instanceof MsgError ? error.notifyClient : undefined

  return explicit ?? hasClientContext(msg)
}

export function isRejectableError(error: Error): boolean {
  const isRejectable = getIfRejectableError(error) !== undefined

  if (isRejectable) {
    return true
  }

  if (error instanceof MsgError) {
    const errorType = error.errorType

    return errorType === ErrorTypeE.AUTHORIZATION_FAILED || errorType === ErrorTypeE.UNAUTHORIZED || errorType === ErrorTypeE.FORBIDDEN
  }

  return false
}

export function registerRejectableErrors(errorClasses: CustomErrorI[]): void {
  errorClasses.reverse().forEach(errorClass => {
    REJECTABLE_ERRORS.unshift(errorClass)
  })
}

function getIfRejectableError(error: Error): CustomErrorI | undefined {
  return REJECTABLE_ERRORS.find(({ errorClass }) => {
    return error instanceof errorClass
  })
}

registerRejectableErrors([
  { errorClass: UnauthorizedError, errorType: ErrorTypeE.UNAUTHORIZED },
  { errorClass: ForbiddenError, errorType: ErrorTypeE.FORBIDDEN },
  { errorClass: RejectMsgError, errorType: ErrorTypeE.BAD_REQUEST },
])
