import { Logger as LoggerClass } from './index.interfaces'

export class Logger {
  private static _customLogger: LoggerClass

  public static set custom(custom: LoggerClass) {
    Logger._customLogger = custom
  }

  public static get instance(): LoggerClass {
    return Logger._customLogger
  }
}
