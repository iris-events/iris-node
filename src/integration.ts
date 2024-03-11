import type { ClassConstructor } from 'class-transformer'
import {
  type CustomChannelClassesI,
  IrisChannels,
} from './lib/asyncapi/schema/channels'
import { type CustomErrorI, registerRejectableErrors } from './lib/errors'
import { type LoggerI, loggers } from './logger'

export interface IrisIntegrationI {
  customLoggerClass?: ClassConstructor<LoggerI>
  rejectableErrors?: CustomErrorI[]
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
