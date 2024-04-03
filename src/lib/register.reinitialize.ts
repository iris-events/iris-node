import logger from '../logger'
import { connection } from './connection'
import * as constants from './constants'

const TAG = 'Iris:RegisterReinitalize'

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
    TAG,
    `Reinitialization scheduled after ${constants.getReinitializationDelay()}ms`,
  )
  setTimeout(() => {
    if (!shouldReinitalize()) {
      return
    }

    logger.debug(TAG, 'Reinitializing')
    callback().catch((err) => {
      logger.error(TAG, 'Reinitialization failed', { err })
    })
  }, constants.getReinitializationDelay())
}

function shouldReinitalize(): boolean {
  if (!connection.shouldAutoReconnect()) {
    logger.debug(
      TAG,
      'Reinitialization: connection purposefully closed, not reinitializing.',
    )

    return false
  }

  return true
}
