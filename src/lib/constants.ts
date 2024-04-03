import type * as amqplib from 'amqplib'
import type * as connectionI from './connection.interfaces'
import * as messageI from './message.interfaces'

let REINITIALIZATION_DELAY = 5000

const DEFAULT_TTL = 15000

type ExchangeDefaultsI = {
  exchangeOptions: messageI.AssertExchangeI
  exchangeType: messageI.ExchangeType
  scope: messageI.Scope
}

type QueueDefaultsI = {
  durable: boolean
  autoDelete: boolean
}

export type ManagedExchangeI = {
  EXCHANGE: string
  EXCHANGE_TYPE: messageI.ExchangeType
  EXCHANGE_OPTIONS?: messageI.AssertExchangeI
}

function castToQueueOptions<T extends amqplib.Options.AssertQueue>(opts: T): T {
  return opts
}

function castToExchangeOptions<T extends messageI.AssertExchangeI>(opts: T): T {
  return opts
}

export const getReinitializationDelay = (): number => REINITIALIZATION_DELAY
export const setReinitializationDelay = (delay: number): void => {
  REINITIALIZATION_DELAY = delay
}

export enum ManagedExchangesE {
  FRONTEND = 'frontend',
  DEAD_LETTER = 'dead.dead-letter',
  ERROR = 'error',
  RETRY = 'retry',
  BROADCAST = 'broadcast',
  SESSION = 'session',
  USER = 'user',
  SUBSCRIPTION = 'subscription',
  SNAPSHOT_REQUESTED = 'snapshot-requested',
  SUBSCRIBE_INTERNAL = 'subscribe-internal',
}

type ManagedExchangesReversedI = Record<
  ManagedExchangesE,
  keyof typeof ManagedExchangesE
>

const managedExchangesReversed: ManagedExchangesReversedI = Object.keys(
  ManagedExchangesE,
).reduce(
  (rev, managedExchangeKey): ManagedExchangesReversedI => {
    rev[ManagedExchangesE[managedExchangeKey]] = managedExchangeKey
    return rev
  },
  <ManagedExchangesReversedI>(<unknown>{}),
)

const NON_RESERVED_EXCHANGE_NAMES = [
  ManagedExchangesE.SUBSCRIPTION,
  ManagedExchangesE.SNAPSHOT_REQUESTED,
  ManagedExchangesE.SUBSCRIBE_INTERNAL,
]

export const CONNECTION_DEFAULT_OPTONS: Omit<
  connectionI.OptionalConfigI,
  'socketOptions'
> = {
  reconnectTries: 5,
  reconnectInterval: 3000,
  reconnectFactor: 1.5,
  maxMessageRetryCount: 3,
}

export const MESSAGE_HEADERS = {
  MESSAGE: {
    ANONYMOUS_ID: 'x-anon-id',
    CACHE_TTL: 'x-cache-ttl',
    CLIENT_TRACE_ID: 'x-client-trace-id',
    CLIENT_VERSION: 'x-client-version',
    CORRELATION_ID: 'x-correlation-id',
    CURRENT_SERVICE_ID: 'x-current-service-id',
    DEVICE: 'x-device',
    EVENT_TYPE: 'x-event-type',
    INSTANCE_ID: 'x-instance-id',
    IP_ADDRESS: 'x-ip-address',
    JWT: 'x-jwt',
    ORIGIN_SERVICE_ID: 'x-origin-service-id',
    PROXY_IP_ADDRESS: 'x-proxy-ip-address',
    REQUEST_REFERER: 'x-request-referer',
    REQUEST_URI: 'x-request-uri',
    REQUEST_VIA: 'x-request-via',
    ROUTER: 'x-router',
    SERVER_TIMESTAMP: 'x-server-timestamp',
    SESSION_ID: 'x-session-id',
    SUBSCRIPTION_ID: 'x-subscription-id',
    USER_AGENT: 'x-user-agent',
    USER_ID: 'x-user-id',
  },

  REQUEUE: {
    ERROR_CODE: 'x-error-code',
    ERROR_TYPE: 'x-error-type',
    ERROR_MESSAGE: 'x-error-message',
    MAX_RETRIES: 'x-max-retries',
    NOTIFY_CLIENT: 'x-notify-client',
    ORIGINAL_EXCHANGE: 'x-original-exchange',
    ORIGINAL_ROUTING_KEY: 'x-original-routing-key',
    ORIGINAL_QUEUE: 'x-original-queue',
    RETRY_COUNT: 'x-retry-count',
  },

  QUEUE_DECLARATION: {
    DEAD_LETTER_EXCHANGE: 'x-dead-letter-exchange',
    DEAD_LETTER_ROUTING_KEY: 'x-dead-letter-routing-key',
    MESSAGE_TTL: 'x-message-ttl',
  },
} as const

const DEFAULTS: { EXCHANGE: ExchangeDefaultsI; QUEUE: QueueDefaultsI } = {
  EXCHANGE: {
    exchangeOptions: castToExchangeOptions({
      durable: true,
      autoDelete: false,
    }),
    exchangeType: messageI.ExchangeType.fanout,
    scope: messageI.Scope.INTERNAL,
  },
  QUEUE: {
    durable: true,
    autoDelete: false,
  },
}

export const MANAGED_EXCHANGES = {
  FRONTEND: {
    EXCHANGE: ManagedExchangesE.FRONTEND,
    EXCHANGE_OPTIONS: castToExchangeOptions({
      durable: true,
      autoDelete: false,
    }),
    QUEUE_OPTIONS: castToQueueOptions({
      durable: true,
      autoDelete: false,
      messageTtl: DEFAULT_TTL,
    }),
    EXCHANGE_TYPE: messageI.ExchangeType.topic,
    SUFFIX: 'frontend',
    TTL: DEFAULT_TTL,
  },

  DEAD_LETTER: {
    EXCHANGE: ManagedExchangesE.DEAD_LETTER,
    EXCHANGE_TYPE: messageI.ExchangeType.topic,
    QUEUE: ManagedExchangesE.DEAD_LETTER,
    PREFIX: 'dead.',
    EXCHANGE_OPTIONS: castToExchangeOptions({
      durable: true,
      autoDelete: false,
    }),
    QUEUE_OPTIONS: castToQueueOptions({ durable: true, autoDelete: false }),
  },

  ERROR: {
    EXCHANGE: ManagedExchangesE.ERROR,
    ROUTING_KEY_SUFFIX: '.error',
    EXCHANGE_TYPE: messageI.ExchangeType.topic,
    EXCHANGE_OPTIONS: castToExchangeOptions({
      durable: true,
      autoDelete: false,
    }),
    QUEUE: 'error',
  },

  RETRY: {
    EXCHANGE: ManagedExchangesE.RETRY,
    ROUTING_KEY: 'retry',
    EXCHANGE_TYPE: messageI.ExchangeType.direct,
    EXCHANGE_OPTIONS: castToExchangeOptions({
      durable: true,
      autoDelete: false,
    }),
    QUEUE: ManagedExchangesE.RETRY,
    WAIT_TTL_PREFIX: 'retry.wait-',
    WAIT_ENDED: 'retry.wait-ended',
  },

  BROADCAST: {
    EXCHANGE: ManagedExchangesE.BROADCAST,
    EXCHANGE_TYPE: messageI.ExchangeType.topic,
    EXCHANGE_OPTIONS: castToExchangeOptions({
      durable: true,
      autoDelete: false,
    }),
  },

  SESSION: {
    EXCHANGE: ManagedExchangesE.SESSION,
    EXCHANGE_TYPE: messageI.ExchangeType.topic,
    EXCHANGE_OPTIONS: castToExchangeOptions({
      durable: true,
      autoDelete: false,
    }),
  },

  USER: {
    EXCHANGE: ManagedExchangesE.USER,
    EXCHANGE_TYPE: messageI.ExchangeType.topic,
    EXCHANGE_OPTIONS: castToExchangeOptions({
      durable: true,
      autoDelete: false,
    }),
  },

  SUBSCRIPTION: {
    EXCHANGE: ManagedExchangesE.SUBSCRIPTION,
    EXCHANGE_TYPE: messageI.ExchangeType.topic,
    EXCHANGE_OPTIONS: castToExchangeOptions({
      durable: true,
      autoDelete: false,
    }),
  },

  SNAPSHOT_REQUESTED: {
    EXCHANGE: ManagedExchangesE.SNAPSHOT_REQUESTED,
    EXCHANGE_TYPE: messageI.ExchangeType.topic,
    EXCHANGE_OPTIONS: castToExchangeOptions({
      durable: true,
      autoDelete: false,
    }),
    QUEUE_OPTIONS: castToQueueOptions({ durable: true, autoDelete: true }),
  },

  SUBSCRIBE_INTERNAL: {
    EXCHANGE: ManagedExchangesE.SUBSCRIBE_INTERNAL,
    EXCHANGE_TYPE: messageI.ExchangeType.fanout,
    EXCHANGE_OPTIONS: castToExchangeOptions({
      durable: true,
      autoDelete: false,
    }),
  },
}

export const MDC_PROPERTIES = {
  SESSION_ID: 'sessionId',
  USER_ID: 'userId',
  CLIENT_TRACE_ID: 'clientTraceId',
  CORRELATION_ID: 'correlationId',
  EVENT_TYPE: 'eventType',
  CLIENT_VERSION: 'clientVersion',
} as const

const RESERVED_EXCHANGE_NAMES = Object.values(ManagedExchangesE).filter(
  (ex) => !NON_RESERVED_EXCHANGE_NAMES.includes(ex),
)

const RESERVED_QUEUE_NAMES = [
  MANAGED_EXCHANGES.DEAD_LETTER.QUEUE,
  MANAGED_EXCHANGES.ERROR.QUEUE,
  MANAGED_EXCHANGES.RETRY.QUEUE,
  MANAGED_EXCHANGES.RETRY.WAIT_ENDED,
]

export const getReservedNames = (): string[] => [
  ...RESERVED_EXCHANGE_NAMES,
  ...RESERVED_QUEUE_NAMES,
]

export function getExchangeDefaultsForExchangeName(
  exchangeName: string,
): ExchangeDefaultsI {
  const managedExchange = <ManagedExchangeI | undefined>(
    MANAGED_EXCHANGES[managedExchangesReversed[exchangeName]]
  )

  return {
    exchangeOptions:
      managedExchange?.EXCHANGE_OPTIONS ?? DEFAULTS.EXCHANGE.exchangeOptions,
    exchangeType:
      managedExchange?.EXCHANGE_TYPE ?? DEFAULTS.EXCHANGE.exchangeType,
    scope: DEFAULTS.EXCHANGE.scope,
  }
}

export function getQueueDefaultsForExchangeName(
  exchangeName: string,
  overrideOptions: Partial<QueueDefaultsI>,
): QueueDefaultsI {
  const managedExchange = <{ QUEUE_OPTIONS?: QueueDefaultsI } | undefined>(
    MANAGED_EXCHANGES[managedExchangesReversed[exchangeName]]
  )

  return {
    ...DEFAULTS.QUEUE,
    ...overrideOptions,
    // defaults for managed exchange should prevail even with overrides
    ...managedExchange?.QUEUE_OPTIONS,
  }
}
