export declare type LogLevel = 'debug' | 'log' | 'warn' | 'error' | 'silent'

const LEVEL_BITMASK: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  log: 4,
  debug: 8,
}

export interface LoggerI {
  debug(ctx: string, message: string, additional?: any): void
  log(ctx: string, message: string, additional?: any): void
  warn(ctx: string, message: string, additional?: any): void
  error(ctx: string, message: string, additional?: any): void
}

type AdditionalI = {
  [key: string]: any
  err?: Error
}

export class ConsoleLogger implements LoggerI {
  console: Console = console

  static level = 0

  static {
    ConsoleLogger.setLogLevel('debug')
  }

  debug(ctx: string, message: string, additional?: any): void {
    this.callLog('debug', ctx, message, additional)
  }

  log(ctx: string, message: string, additional?: any): void {
    this.callLog('log', ctx, message, additional)
  }

  warn(ctx: string, message: string, additional?: any): void {
    this.callLog('warn', ctx, message, additional)
  }

  error(ctx: string, message: string, additional?: any): void {
    this.callLog('error', ctx, message, additional)
  }

  private callLog(
    level: LogLevel,
    ctx: string,
    message: string,
    additional?: any,
  ): void {
    if (this.shouldLog(level)) {
      if (additional !== undefined) {
        this.console[level](`[${ctx}]`, message, additional)
      } else {
        this.console[level](`[${ctx}]`, message)
      }
    }
  }

  static setLogLevel(level: LogLevel): void {
    ConsoleLogger.level = Object.keys(LEVEL_BITMASK).reduce(
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
    return (ConsoleLogger.level & LEVEL_BITMASK[level]) > 0
  }
}

class LoggerProxy implements LoggerI {
  private static logger: LoggerI = new ConsoleLogger()

  public static replaceLogger(logger: LoggerI): void {
    LoggerProxy.logger = logger
  }

  replaceLogger(logger: LoggerI): void {
    LoggerProxy.replaceLogger(logger)
  }

  debug(ctx: string, message: string, additional?: AdditionalI): void {
    LoggerProxy.logger.debug(ctx, message, additional)
  }
  log(ctx: string, message: string, additional?: AdditionalI): void {
    LoggerProxy.logger.log(ctx, message, additional)
  }
  warn(ctx: string, message: string, additional?: AdditionalI): void {
    LoggerProxy.logger.warn(ctx, message, additional)
  }
  error(ctx: string, message: string, additional?: AdditionalI): void {
    LoggerProxy.logger.error(ctx, message, additional)
  }
}

export default new LoggerProxy()
