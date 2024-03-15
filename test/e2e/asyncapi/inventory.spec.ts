import {
  collectProcessedMessages,
  getProcessedMessageHandlerDecoratedMethods,
} from '../../../src'
import { AsyncapiSchema, DocumentBuilder } from '../../../src/lib/asyncapi'
import '../../setup'
import * as msgHandlers from './inventory.handlers'

export const SCHEMA_POINTER_PREFIX = '#/components/schemas/'

describe('Asyncapi generation with "inventory" app', () => {
  test('generates expected asyncapi', async () => {
    const handlers = [
      msgHandlers.HandlerInquiry,
      msgHandlers.HandlerOrder,
      msgHandlers.HandlerOrderSytem,
    ].flatMap((handler) => getProcessedMessageHandlerDecoratedMethods(handler))

    const asyncapiSchema = new AsyncapiSchema({
      SCHEMA_POINTER_PREFIX,
      messages: collectProcessedMessages(),
      messageHandlers: handlers,
    })

    const document = new DocumentBuilder()
      .setTitle('test_invernory')
      .setDescription('Test inverntory asnycapi')
      .setVersion('1.0.0')
      .setId('urn:id:global:test_invernory')
      .build()

    const asyncapi = {
      ...document,
      components: {
        schemas: asyncapiSchema.getSchemas(),
      },
      channels: asyncapiSchema.getChannels(),
    }

    expect(asyncapi).toMatchSnapshot()
  })
})
