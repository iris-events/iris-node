/**
 * Test intergration for iris
 */

import * as iris from '..'
import { isAmqpMessageClass } from '../lib/message_handler.param.decorator'
import { clearQueues, connect, deleteExchange } from './test.utilities'

export type RegisterAndConnectReturnT = Awaited<
  ReturnType<typeof registerAndConnect>
>

export async function registerAndConnect<T extends any[]>(
  handlerClasses: { new (): T[number] } | { new (): T[number] }[],
  connectOptions?: iris.ConnectionConfigI,
) {
  await connect(connectOptions)

  const { handlers, instanceMap } = await registerHandlers(handlerClasses)

  return {
    getHandlers: () => handlers,
    getHandlerFor: <T>(handlerClass: { new (): T }): T | undefined =>
      <T | undefined>instanceMap[handlerClass.name]?.handlerInstance,
    deleteQueues: async (allowReconnect = false) =>
      await clearQueues(handlers, true, allowReconnect),
    clearQueues: async (allowReconnect = false) =>
      await clearQueues(handlers, false, allowReconnect),
    deleteExchange: async (exchangeOrMsgClass: string | Object) => {
      const exchange =
        typeof exchangeOrMsgClass === 'string'
          ? exchangeOrMsgClass
          : iris.message.getProcessedMessageDecoratedClass(exchangeOrMsgClass)
              .processedConfig.exchangeName

      await deleteExchange(exchange)
    },
  }
}

export async function registerHandlers<T extends any[]>(
  handlerClasses: { new (): T[number] } | { new (): T[number] }[],
) {
  const instanceMap = instantiateHandlers(handlerClasses)

  const handlers = Object.values(instanceMap).flatMap(({ metas }) => metas)
  await iris.featManagement.registerReservedManagedMessages()

  await iris.registerProcessed.register(
    iris.collectProcessedMessages(),
    handlers,
  )

  return { handlers, instanceMap }
}

/**
 * [Testing]
 * @internal
 * use {@link registerAndConnect} instead
 * Create instances of passed handler classes and
 * route events to their respective @MessageHandler methods
 */
export function instantiateHandlers<T>(
  handlerClasses: { new (): T } | { new (): T }[],
) {
  return (Array.isArray(handlerClasses) ? handlerClasses : [handlerClasses])
    .map(instantiateHandler)
    .reduce(
      (acc, instanceAndMeta) => {
        // @ts-ignore
        acc[instanceAndMeta.handlerInstance.constructor.name] = instanceAndMeta

        return acc
      },
      <
        Record<
          string,
          { handlerInstance: T; metas: iris.ProcessedMessageHandlerMetadataI[] }
        >
      >{},
    )
}

function instantiateHandler<T>(handlerClass: { new (): T }) {
  const metas = iris.getProcessedMessageHandlerDecoratedMethods(handlerClass)
  const handlerInstance = new handlerClass()

  for (const meta of metas) {
    const msgToArgs = msgToArgsFactory(meta, meta.target, meta.methodName)

    // @ts-ignore
    meta.callback = async (msg: iris.AmqpMessage) => {
      return meta.isStaticMethod
        ? handlerClass[meta.methodName](...(await msgToArgs(msg)))
        : handlerInstance[meta.methodName](...(await msgToArgs(msg)))
    }
  }

  return { handlerInstance, metas }
}

function msgToArgsFactory(
  meta: iris.ProcessedMessageHandlerMetadataI,
  handlerClass: Object,
  methodName: string,
) {
  const argFactories: Function[] = []
  const methodArgs = Reflect.getMetadata(
    'design:paramtypes',
    handlerClass,
    methodName,
  )

  for (const [pos, arg] of methodArgs.entries()) {
    if (iris.message.isMessageDecoratedClass(arg)) {
      argFactories[pos] = getMessageFactory(meta.messageClass)
    } else if (isAmqpMessageClass(arg)) {
      argFactories[pos] = (i: any) => i
    } else {
      throwTestHandlerArgError(handlerClass, methodName, arg)
    }
  }

  return async (msg: iris.AmqpMessage) =>
    await Promise.all(argFactories.map((f) => f(msg)))
}

function getMessageFactory(msgClass: Object) {
  const msgMeta = iris.message.getMessageDecoratedClass(msgClass)

  return async (msg: iris.AmqpMessage) => {
    return await iris.validation.validationClass.convertBufferToTargetClass(
      msg,
      msgMeta,
      iris.flags.DISABLE_MESSAGE_CONSUME_VALIDATION,
    )
  }
}

function throwTestHandlerArgError(
  handlerClass: Object,
  methodName: string,
  arg: unknown,
): never {
  // @ts-ignore
  const desc = `${handlerClass.constructor.name}.${methodName}`
  console.error(
    `test integration only allows for
       @Message and/or AmqpMessage arguments in handlers:
       ${desc}( .. ${arg} ? ..)
  `,
  )

  throw new Error(`TEST_ERR_INVALID_HANDLER_ARG ${desc}`)
}
