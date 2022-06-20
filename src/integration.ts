import { ClassConstructor } from 'class-transformer'
import { loggers, LoggerI } from './logger'
import { registerRejectableErrors, CustomRejectableErrorI } from './lib/errors'
import { IrisChannels, CustomChannelClassesI } from './lib/asyncapi/schema/channels'

export interface IrisIntegrationI {
  customLoggerClass?: ClassConstructor<LoggerI>
  rejectableErrors?: CustomRejectableErrorI[]
  asyncapi?: {
    customChannelClasses?: CustomChannelClassesI
  }
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
  if (config.asyncapi?.customChannelClasses !== undefined) {
    IrisChannels.setCustomChannelClasses(config.asyncapi.customChannelClasses)
  }
}
