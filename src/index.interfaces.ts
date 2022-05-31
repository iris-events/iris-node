import * as amqplib from 'amqplib'

interface LoggerI {
  setContext: (ctx: string) => void
  error: (message: string, errStack?: string | Error, details?: unknown) => void
  errorDetails: (message: string, details?: unknown) => void
  log: (message: string, details?: unknown) => void
  warn: (message: string, details?: unknown) => void
  debug: (message: string, details?: unknown) => void
  verbose: (message: string, details?: unknown) => void
}

export interface Logger {
  new (name: string): LoggerI
}

export interface UnauthorizedExceptionI extends Error {
  name: string
  message: string
}

export interface UnauthorizedException {
  new (message?: string | undefined): ForbiddenExceptionI
}

export interface ForbiddenExceptionI extends Error {
  name: string
  message: string
}

export interface ForbiddenException {
  new (message?: string | undefined): ForbiddenExceptionI
}

export type CustomParamFactory<TData = unknown, TInput = unknown, TOutput = unknown> = (data: TData, input: TInput) => TOutput

type CustomParamDecorator = (...args: unknown[]) => ParameterDecorator
export type CreateParamDecorator = <FactoryData = unknown, FactoryInput = unknown, FactoryOutput = unknown>(
  factory: CustomParamFactory<FactoryData, FactoryInput, FactoryOutput>
) => CustomParamDecorator

export type GetAmqpMessage = (...args: unknown[]) => amqplib.ConsumeMessage

export interface OptionsI {
  createParamDecorator: CreateParamDecorator
  getAmqpMessage: GetAmqpMessage
  logger: Logger
  unauthorizedException: UnauthorizedException
  forbiddenException: ForbiddenException
}
