import {
  type CustomChannelClassesI,
  IrisChannels,
} from './lib/asyncapi/schema/channels'
import { type CustomErrorI, registerRejectableErrors } from './lib/errors'
import { MdcI, registerMdcProvider } from './lib/mdc'
import Logger, { type LoggerI } from './logger'

export interface IrisIntegrationI {
  customLoggerInstance?: LoggerI
  rejectableErrors?: CustomErrorI[]
  asyncapi?: {
    customChannelClasses?: CustomChannelClassesI
  }

  /**
   * Since MDC is not integrated in same way as with Java IRIS
   * counterpart it's up to integration whether to use it or not.
   * In case it's used, this method can be used to obtain MDC instance.
   *
   * Current usage within node IRIS is to:
   * - use reqiestId value as correlationId (for HTTP requests that
   *   produce events)
   * - be able to omit userId agument with the `publish.publishToUser()`
   *   method
   */
  mdcProvider?: () => MdcI | undefined | Promise<MdcI | undefined>
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
  if (config.mdcProvider !== undefined) {
    registerMdcProvider(config.mdcProvider)
  }
}
