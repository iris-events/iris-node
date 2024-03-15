import { nextTick } from 'node:process'
import amqplib from 'amqplib'
import { v4 } from 'uuid'
import * as iris from '..'
import { DefaultLogger, LogLevel } from '../logger'

export async function setLogLevel(level?: LogLevel) {
  DefaultLogger.setLogLevel(level ?? process.env.LOG_LEVEL ?? ('debug' as any))
}

export async function connect(opts?: iris.ConnectionConfigI) {
  await iris.connection.connect(
    opts ?? { urlOrOpts: <string>process.env.AMQP_URL },
  )
}

/**
 * [Testing]
 * try clear all queues for passed handlers metadata
 * obtained via {@link iris.getProcessedMessageDecoratedClass}
 */
export async function clearQueues(
  handlers: iris.ProcessedMessageHandlerMetadataI[],
  alsoDelete: boolean,
  allowReconnect = false,
) {
  iris.connection.setDoAutoReconnect(allowReconnect)
  await Promise.all(
    collectHandlerQueueInfo(handlers).map(async ({ handler, queues }) => {
      let ch: amqplib.Channel | undefined
      async function setupChannel() {
        ch = await iris.connection.assureChannelForHandler(handler)
        ch.on('error', setupChannel)
      }
      await setupChannel()
      await nextTickP()
      for (const queue of queues) {
        await ch!.purgeQueue(queue).catch(nextTickP)
        if (alsoDelete) {
          await ch!.deleteQueue(queue).catch(nextTickP)
        }
      }
    }),
  )
  await nextTickP()
}

/**
 * [Testing]
 */
export async function deleteExchange(exchange: string) {
  const ch = await getTestChannel()
  await ch.deleteExchange(exchange)
}

/**
 * [Testing]
 * Allow publishing to fronend exchange
 */
export async function publishToFrontend<T extends Object>(
  messageClass: { new (): T },
  message: T,
  routingKey?: string,
  options?: amqplib.Options.Publish,
): Promise<void> {
  const msgMeta = iris.getProcessedMessageDecoratedClass(messageClass)
  const { scope, publishingExchangeName, publishingExchangeRoutingKey } =
    msgMeta.processedConfig

  if (scope !== iris.Scope.FRONTEND) {
    throw new Error('ERR_IRIS_TEST_INVALID_FRONTEND_MESSAGE')
  }

  const rKey =
    publishingExchangeRoutingKey ??
    routingKey ??
    msgMeta.processedConfig.routingKey

  const channel = await getTestChannel()

  channel.publish(
    publishingExchangeName,
    rKey,
    Buffer.from(JSON.stringify(message)),
    options,
  )
}

/**
 * Subscribe and consume any event decorated with @Message()
 * @param {Object} messageClass which event to subscribe to
 * @param {Function} handler (spy)
 * @param {string} [bindKey='#'] which binding key to use in case of direct/topic exchange type
 *
 * @Returns unsubscribe method
 */
export async function subscribe<T>(
  messageClass: { new (): T },
  handler: Function,
  bindKey?: string,
) {
  const msgMeta = iris.getProcessedMessageDecoratedClass(messageClass)

  if (msgMeta.processedConfig.scope !== iris.Scope.INTERNAL) {
    await assureSubscriptionExchange(msgMeta)
  }

  // for tests we want to subscribe to exchanges where msg
  // is published to based on SCOPE
  const { publishingExchangeName, publishingExchangeRoutingKey } =
    msgMeta.processedConfig
  const bindingKey: string = bindKey ?? publishingExchangeRoutingKey ?? ''

  const qName = `${publishingExchangeName}_test_${v4()}`
  let channel = await getTestChannel()
  await channel.assertQueue(qName, { durable: false, autoDelete: true })
  await channel.bindQueue(qName, publishingExchangeName, bindingKey)

  const cTag = await channel.consume(
    qName,
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (msg: amqplib.ConsumeMessage | null) => {
      if (msg !== null) {
        const content = <unknown>JSON.parse(msg.content.toString())
        await handler(content, msg)
      }
    },
    { noAck: true },
  )

  return async (): Promise<void> => {
    channel = await getTestChannel()
    await Promise.all([
      channel.unbindQueue(qName, publishingExchangeName, bindingKey),
      channel.cancel(cTag.consumerTag),
    ])
  }
}

/**
 * [Testing]
 * Request snapshot for resource
 */
export async function requestSnapshot(
  resourceType: string,
  resourceId: string,
): Promise<void> {
  await iris.publish.getPublisher(iris.SnapshotRequested)(
    { resourceType, resourceId },
    { routingKey: resourceType },
  )
}

/**
 * [Testing]
 * Open a amqp channel for test
 */
export async function getTestChannel(): Promise<amqplib.Channel> {
  return await iris.connection.assureChannel('test')
}

/**
 * [Testing]
 * Get a dedicated channel for for a specific Message class
 */
export async function getChannelForMessage<T>(messageClass: { new (): T }) {
  const handler = iris.getHandlers(messageClass).pop()
  const handlerMeta = iris
    .getProcessedMessageHandlerDecoratedMethods(handler!)
    .find((h) => h.messageClass === messageClass)

  return await iris.connection.assureChannelForHandler(handlerMeta!)
}

function collectHandlerQueueInfo(
  handlers: iris.ProcessedMessageHandlerMetadataI[],
) {
  return handlers.map((handler) => {
    const msgMeta = iris.message.getProcessedMessageDecoratedClass(
      handler.messageClass,
    )

    const queues = [handler.processedConfig.queueName]
    if (
      msgMeta.processedConfig.deadLetterIsCustom &&
      handler.processedConfig.queueOptions.deadLetterExchange
    ) {
      queues.push(handler.processedConfig.queueOptions.deadLetterExchange)
    }

    return { handler, queues }
  })
}

async function assureSubscriptionExchange(
  msgMeta: iris.ProcessedMessageMetadataI,
) {
  await iris.amqpHelper.assertExchange(
    msgMeta.processedConfig.publishingExchangeName,
    msgMeta.processedConfig.exchangeType,
    {
      autoDelete: true,
      durable: false,
    },
  )
}

async function nextTickP() {
  return new Promise((resolve) => nextTick(resolve))
}
