import { randomUUID } from 'node:crypto'
import { IsString } from 'class-validator'
import {
  Message,
  MessageHandler,
  getProcessedMessageDecoratedClass,
  mdc,
  publish,
} from '../../src'
import { irisTesting } from '../setup'

@Message({ name: `foo-${randomUUID()}` })
class Foo {
  @IsString() name!: string
}

class Handler {
  @MessageHandler()
  async handleFoo(_evt: Foo, _mdc: mdc.MDC): Promise<void> {}
}

describe('MDC', () => {
  let suite: irisTesting.integration.RegisterAndConnectReturnT
  let handler: Handler

  beforeAll(async () => {
    suite = await irisTesting.integration.registerAndConnect(Handler)
    handler = suite.getHandlerFor(Handler)!
  })

  afterEach(async () => {
    await suite.clearQueues()
  })

  afterAll(async () => {
    await suite.deleteQueues()
  })

  test('Expect full MDC when all mdc related headers are present', async () => {
    const mdc: mdc.MdcI = {
      sessionId: randomUUID(),
      userId: randomUUID(),
      clientTraceId: randomUUID(),
      correlationId: randomUUID(),
      eventType: randomUUID(),
      clientVersion: randomUUID(),
    }

    const spyFoo = vi.spyOn(handler, 'handleFoo')

    await publish.getPublisher(Foo)(
      { name: 'foo_evt' },
      {
        amqpPublishOpts: {
          headers: {
            'x-session-id': mdc.sessionId,
            'x-user-id': mdc.userId,
            'x-client-trace-id': mdc.clientTraceId,
            'x-correlation-id': mdc.correlationId,
            'x-event-type': mdc.eventType,
            'x-client-version': mdc.clientVersion,
          },
        },
      },
    )

    await vi.waitFor(() => {
      expect(spyFoo).toHaveBeenCalledTimes(1)
      expect(spyFoo).toHaveBeenNthCalledWith(1, { name: 'foo_evt' }, mdc)
    })
  })

  test('Expect partial MDC when some mdc related headers are present', async () => {
    const mdc: mdc.MdcI = {
      sessionId: randomUUID(),
      userId: randomUUID(),
      clientVersion: randomUUID(),
      eventType:
        getProcessedMessageDecoratedClass(Foo).processedConfig!.exchangeName,
    }

    const spyFoo = vi.spyOn(handler, 'handleFoo')

    await publish.getPublisher(Foo)(
      { name: 'foo_evt' },
      {
        amqpPublishOpts: {
          headers: {
            'x-session-id': mdc.sessionId,
            'x-user-id': mdc.userId,
            'x-client-version': mdc.clientVersion,
          },
        },
      },
    )

    await vi.waitFor(() => {
      expect(spyFoo).toHaveBeenCalledTimes(1)
      expect(spyFoo).toHaveBeenNthCalledWith(1, { name: 'foo_evt' }, mdc)
    })
  })
})
