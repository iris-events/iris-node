import * as classValidator from 'class-validator'
import { ClassConstructor } from 'class-transformer'

export const UnauthorizedError = class UnauthorizedException extends Error {}
export const ForbiddenError = class ForbiddenException extends Error {}

export interface CustomRejectableErrorI {
  errorClass: ClassConstructor<Error>
  errorType: ErrorTypeE
}

const REJECTABLE_ERRORS: CustomRejectableErrorI[] = []

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
  notifyFrontend: boolean = true
  constructor(msg: string)
  constructor(msg: string, notifyFrontend: boolean)
  constructor(msg: string, notifyFrontend?: boolean) {
    super(msg)
    this.notifyFrontend = notifyFrontend ?? true
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

  constructor(errorDetails: classValidator.ValidationError[], notifyFrontend: boolean = true) {
    super('InvalidObjectCoversion', notifyFrontend)
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

export function shouldNotifyFrontend(error: Error): boolean {
  return error instanceof MsgError ? error.notifyFrontend : true
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

export function registerRejectableErrors(errorClasses: CustomRejectableErrorI[]): void {
  errorClasses.forEach(errorClass => {
    REJECTABLE_ERRORS.push(errorClass)
  })
}

function getIfRejectableError(error: Error): CustomRejectableErrorI | undefined {
  return REJECTABLE_ERRORS.find(({ errorClass }) => {
    return error instanceof errorClass
  })
}

registerRejectableErrors([
  { errorClass: UnauthorizedError, errorType: ErrorTypeE.UNAUTHORIZED },
  { errorClass: ForbiddenError, errorType: ErrorTypeE.FORBIDDEN },
  { errorClass: RejectMsgError, errorType: ErrorTypeE.BAD_REQUEST },
])
