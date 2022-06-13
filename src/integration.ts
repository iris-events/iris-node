import { ClassConstructor } from 'class-transformer'
import { loggers, LoggerI } from './logger'
import { registerRejectableErrors, CustomRejectableErrorI } from './lib/errors'

export interface IrisIntegrationI {
  customLoggerClass?: ClassConstructor<LoggerI>
  rejectableErrors?: CustomRejectableErrorI[]
}

/**
 * Override internals when integrating IRIS with a specific platorm
 */
export function init(config: IrisIntegrationI): void {
  if (config.rejectableErrors !== undefined) {
    registerRejectableErrors(config.rejectableErrors)
  }
  if (config.customLoggerClass !== undefined) {
    loggers.setLogger(config.customLoggerClass)
  }
}
