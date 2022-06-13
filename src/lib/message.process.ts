import * as interfaces from './message.interfaces'
import { getExchangeDefaultsForExchangeName, MANAGED_EXCHANGES } from './constants'
import * as validation from './message.validation'

const { DEAD_LETTER, FRONTEND, USER, SESSION, BROADCAST } = MANAGED_EXCHANGES

export function processAndValidateConfig(config: interfaces.MessageI, target: Object): interfaces.ProcessedMessageConfigI {
  validation.validateProcessedMessageConfig(config, target)

  const exchangeName = config.name

  const { routingKey } = config
  const intermediate = {
    ...getExchangeDefaultsForExchangeName(exchangeName),
    ...config,
    routingKey: routingKey ?? exchangeName,
    ttl: getTTL(config),
    deadLetter: getDeadLetter(config),
    exchangeName,
  }

  const processedMessageConfig = {
    deadLetterIsCustom: isDeadletterCustom(intermediate.deadLetter),
    ...intermediate,
    ...getPublishExchangeProps(intermediate),
  }

  return processedMessageConfig
}

function getDeadLetter(config: interfaces.MessageI): string {
  const { scope, deadLetter: dl } = config
  const deadLetter = typeof dl === 'string' ? dl.trim() : undefined

  if (deadLetter === '') {
    return ''
  }

  if (scope === interfaces.Scope.FRONTEND) {
    return ''
  }

  if (typeof deadLetter !== 'string') {
    return DEAD_LETTER.QUEUE
  }

  if (!deadLetter.startsWith(DEAD_LETTER.PREFIX)) {
    return `${DEAD_LETTER.PREFIX}${deadLetter}`
  }

  return deadLetter
}

function isDeadletterCustom(name: string): boolean {
  return name !== '' && name !== DEAD_LETTER.QUEUE
}

function getTTL(config: interfaces.MessageI): number | undefined {
  const { ttl, scope } = config

  if (scope === interfaces.Scope.FRONTEND && ttl === undefined) {
    return FRONTEND.TTL
  }

  if (ttl !== undefined && ttl < 0) {
    return undefined
  }

  return ttl
}

function getPublishExchangeProps(msgOpts: Pick<interfaces.ProcessedMessageConfigI, 'scope' | 'exchangeName'>): {
  publishingExchangeName: string
  publishingExchangeRoutingKey?: string
} {
  const { scope, exchangeName } = msgOpts

  if (scope === interfaces.Scope.USER) {
    return {
      publishingExchangeName: USER.EXCHANGE,
      publishingExchangeRoutingKey: `${exchangeName}.${USER.EXCHANGE}`,
    }
  } else if (scope === interfaces.Scope.SESSION) {
    return {
      publishingExchangeName: SESSION.EXCHANGE,
      publishingExchangeRoutingKey: `${exchangeName}.${SESSION.EXCHANGE}`,
    }
  } else if (scope === interfaces.Scope.BROADCAST) {
    return {
      publishingExchangeName: BROADCAST.EXCHANGE,
      publishingExchangeRoutingKey: `${exchangeName}.${BROADCAST.EXCHANGE}`,
    }
  } else if (scope === interfaces.Scope.FRONTEND) {
    // publishing to this exchange is not permitted, but let's have everything normalized.
    return {
      publishingExchangeName: FRONTEND.EXCHANGE,
    }
  }

  return { publishingExchangeName: exchangeName }
}
