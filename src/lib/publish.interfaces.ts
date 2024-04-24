import type * as amqplib from 'amqplib'

export declare type PublishOptionsI = {
  routingKey?: string
  userId?: string
  amqpPublishOpts?: amqplib.Options.Publish
}
