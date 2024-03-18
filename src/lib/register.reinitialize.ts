import { getLogger } from '../logger'
import { connection } from './connection'
import * as constants from './constants'

const logger = getLogger('Iris:RegisterReinitalize')

type callbackFnT = () => Promise<void>

export function getReinitializationFn(callback: callbackFnT): () => void {
  return (): void => {
    process.nextTick(() => {
      if (!shouldReinitalize()) {
        return
      }
      runReinitialization(callback)
    })
  }
}

function runReinitialization(callback: callbackFnT): void {
  logger.debug(
    `Reinitialization scheduled after ${constants.getReinitializationDelay()}ms`,
  )
  setTimeout(() => {
    if (!shouldReinitalize()) {
      return
    }

    logger.debug('Reinitializing')
    callback().catch((e) => {
      logger.error('Reinitialization failed', <Error>e)
    })
  }, constants.getReinitializationDelay())
}

function shouldReinitalize(): boolean {
  if (!connection.shouldAutoReconnect()) {
    logger.debug(
      'Reinitialization: connection purposefully closed, not reinitializing.',
    )

    return false
  }

  return true
}
