import type * as amqplib from 'amqplib'

export declare type PublishOptionsI = {
  routingKey?: string
  userId?: string
  amqpPublishOpts?: amqplib.Options.Publish
}

export type PublisherI<T> = (
  msg: T,
  pubOpts?: PublishOptionsI,
) => Promise<boolean>
