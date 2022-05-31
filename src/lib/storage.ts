export type CallbackMethod<T> = (msg: T) => Promise<void>
export type CustomDecorator<T = string> = ClassDecorator & { KEY: T }

export const IRIS_MESSAGE = 'iris_msg_meta'
export const IRIS_MESSAGE_HANDLERS_META = 'iris_msg_handlers_meta'
export const IRIS_MESSAGE_HANDLERS = 'iris_msg_handlers'
export const AMQP_MESSAGE_CLASS = 'amqp_message_class'

const storage: Object[] = []

export function registerMessage<T extends Function>(msg: T): void {
  storage.push(msg)
}
export function getMessageStore<T extends Function>(): T[] {
  return <T[]>storage
}

export const SetMetadata = <K = string, V = unknown>(metadataKey: K, metadataValue: V): CustomDecorator<K> => {
  const decoratorFactory = <TFunction extends Function>(target: TFunction): TFunction | void => {
    Reflect.defineMetadata(metadataKey, metadataValue, target)

    return target
  }
  decoratorFactory.KEY = metadataKey

  return decoratorFactory
}

export const clearMessageStore = (): void => {
  storage.length = 0
}
