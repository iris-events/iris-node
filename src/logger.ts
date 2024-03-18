import type { ClassConstructor } from 'class-transformer'
export declare type LogLevel = 'debug' | 'log' | 'warn' | 'error' | 'silent'

const LEVEL_BITMASK: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  log: 4,
  debug: 8,
}

interface LoggerIncompleteI {
  log(message: any, ...optionalParams: any[]): any
  error(message: any, ...optionalParams: any[]): any
  errorDetails(message: string, details?: any): any
  warn(message: any, ...optionalParams: any[]): any
  debug?(message: any, ...optionalParams: any[]): any
  setLogLevels?(levels: LogLevel[]): any
}

export interface LoggerI extends LoggerIncompleteI {
  debug(message: any, ...optionalParams: any[]): any
  setLogLevels(levels: LogLevel[]): void
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
  errorDetails(message: string, details?: any): any {
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
  setLogLevels(levels: LogLevel[]): void {
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

export class DefaultLogger implements LoggerI {
  console: Console
  context: string

  static level = 0

  static {
    DefaultLogger.setLogLevel('debug')
  }

  constructor(componentName: string) {
    this.console = console
    this.context = componentName
  }

  setContext(ctx: string): void {
    this.context = ctx
  }

  error(message: string, errStack?: string | Error, details?: any): void {
    if (this.shouldLog('error')) {
      this.console.error(this.msgWithContext(message), { errStack, details })
    }
  }

  errorDetails(message: string, details?: any): void {
    if (this.shouldLog('error')) {
      this.console.error(this.msgWithContext(message), { details })
    }
  }

  warn(message: string, details?: any): void {
    if (this.shouldLog('warn')) {
      this.console.warn(this.msgWithContext(message), { details })
    }
  }

  log(message: string, details?: any): void {
    if (this.shouldLog('log')) {
      this.console.info(this.msgWithContext(message), { details })
    }
  }

  debug(message: string, details?: any): void {
    if (this.shouldLog('debug')) {
      this.console.debug(this.msgWithContext(message), { details })
    }
  }

  msgWithContext(message: string) {
    return `[${this.context}] ${message}`
  }

  setLogLevels(): void {}

  static setLogLevel(level: LogLevel): void {
    DefaultLogger.level = Object.keys(LEVEL_BITMASK).reduce(
      (acc, val) => {
        if (acc.ignoreRest) return acc
        if (val === level) acc.ignoreRest = true

        acc.mask |= LEVEL_BITMASK[val]

        return acc
      },
      { mask: 0, ignoreRest: false },
    ).mask
  }

  private shouldLog(level: LogLevel): boolean {
    return (DefaultLogger.level & LEVEL_BITMASK[level]) > 0
  }
}

export const loggers = new Loggers()
export const getLogger = (context: string): LoggerI =>
  loggers.getLogger(context)
export const setLogger = (loggerClass: ClassConstructor<LoggerI>): void =>
  loggers.setLogger(loggerClass)
