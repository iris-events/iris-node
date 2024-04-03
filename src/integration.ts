import {
  type CustomChannelClassesI,
  IrisChannels,
} from './lib/asyncapi/schema/channels'
import { type CustomErrorI, registerRejectableErrors } from './lib/errors'
import Logger, { type LoggerI } from './logger'

export interface IrisIntegrationI {
  customLoggerInstance?: LoggerI
  rejectableErrors?: CustomErrorI[]
  asyncapi?: {
    customChannelClasses?: CustomChannelClassesI
  }
}

/**
 * Override internals when integrating IRIS with a specific platorm
 */
export function update(config: IrisIntegrationI): void {
  if (config.rejectableErrors !== undefined) {
    registerRejectableErrors(config.rejectableErrors)
  }
  if (config.customLoggerInstance !== undefined) {
    Logger.replaceLogger(config.customLoggerInstance)
  }
  if (config.asyncapi?.customChannelClasses !== undefined) {
    IrisChannels.setCustomChannelClasses(config.asyncapi.customChannelClasses)
  }
}
