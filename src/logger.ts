/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ClassConstructor } from 'class-transformer'
export declare type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose'

interface LoggerIncompleteI {
  log(message: any, ...optionalParams: any[]): any
  error(message: any, ...optionalParams: any[]): any
  errorDetails(message: string, details?: unknown): any
  warn(message: any, ...optionalParams: any[]): any
  debug?(message: any, ...optionalParams: any[]): any
  verbose?(message: any, ...optionalParams: any[]): any
  setLogLevels?(levels: LogLevel[]): any
}

export interface LoggerI extends LoggerIncompleteI {
  debug(message: any, ...optionalParams: any[]): any
  verbose(message: any, ...optionalParams: any[]): any
  setLogLevels(levels: LogLevel[]): any
}

class LoggerProxy implements LoggerI {
  private logger: LoggerIncompleteI

  constructor(logger: LoggerIncompleteI) {
    this.logger = logger
  }

  public replaceLogger(logger: LoggerIncompleteI): void {
    this.logger = logger
  }

  log(message: any, ...optionalParams: any[]): any {
    return this.logger.log(message, ...optionalParams)
  }
  error(message: any, ...optionalParams: any[]): any {
    return this.logger.error(message, ...optionalParams)
  }
  errorDetails(message: string, details?: unknown): any {
    return this.logger.errorDetails(message, details)
  }
  warn(message: any, ...optionalParams: any[]): any {
    return this.logger.warn(message, ...optionalParams)
  }
  debug(message: any, ...optionalParams: any[]): any {
    if (this.logger.debug !== undefined) {
      return this.logger.debug(message, ...optionalParams)
    }

    return this.log(message, ...optionalParams)
  }
  verbose(message: any, ...optionalParams: any[]): any {
    if (this.logger.verbose !== undefined) {
      return this.logger.verbose(message, ...optionalParams)
    }

    return this.log(message, ...optionalParams)
  }
  setLogLevels(levels: LogLevel[]): any {
    if (this.logger.setLogLevels !== undefined) {
      this.logger.setLogLevels(levels)
    }
  }
}

class Loggers {
  private loggers: Record<string, LoggerProxy> = {}
  private loggerClass: ClassConstructor<LoggerI>

  constructor() {
    this.loggerClass = DefaultLogger
  }

  public setLogger(loggerClass: ClassConstructor<LoggerI>): void {
    this.loggerClass = loggerClass
    for (const context in this.loggers) {
      const logger = this.loggers[context]
      logger.replaceLogger(new this.loggerClass(context))
    }
  }

  public getLogger(context: string): LoggerI {
    const logger = new LoggerProxy(new this.loggerClass(context))
    this.loggers[context] = logger

    return logger
  }
}

class DefaultLogger implements LoggerI {
  console: Console
  context: string

  constructor(componentName: string) {
    this.console = console
    this.context = componentName
  }

  setContext(ctx: string): void {
    this.context = ctx
  }

  error(message: string, errStack?: string | Error, details?: unknown): void {
    this.console.error(message, { errStack, details })
  }

  errorDetails(message: string, details?: unknown): void {
    this.console.error(message, { details })
  }

  log(message: string, details?: unknown): void {
    this.console.info(message, { details })
  }

  warn(message: string, details?: unknown): void {
    this.console.warn(message, { details })
  }

  debug(message: string, details?: unknown): void {
    this.console.debug(message, { details })
  }

  verbose(message: string, details?: unknown): void {
    this.console.debug(message, { details })
  }

  setLogLevels(_levels: LogLevel[]): any {}
}

export const loggers = new Loggers()
export const getLogger = (context: string): LoggerI => loggers.getLogger(context)
export const setLogger = (loggerClass: ClassConstructor<LoggerI>): void => loggers.setLogger(loggerClass)
