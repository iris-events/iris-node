import * as amqplib from 'amqplib'

export interface OptionalConfigI {
  /**
   * Passed to amqplib, see amqplib doc for more info
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socketOptions?: any

  /**
   * How many times should iris try to reconnect when connection drops
   * setting to 0 or less means do not try to reconnect
   */
  reconnectTries: number
  /**
   * Reconnect interval
   */
  reconnectInterval: number
  /**
   * Multiply factor for reconnectInterval for each next time if reconnecting fails
   */
  reconnectFactor: number

  /**
   * When error occures during event processing, event is re-enqueued.
   * This setting specifies how many times should a single event be re-enqueued
   * before marked as failed.
   */
  maxMessageRetryCount: number
}

interface ObligatoryConfigI {
  urlOrOpts: string | (Omit<amqplib.Options.Connect, 'port'> & { port?: number | string })
}

export type ConnectionConfigI = ObligatoryConfigI & Partial<OptionalConfigI>

export type ConfigI = ObligatoryConfigI & OptionalConfigI
