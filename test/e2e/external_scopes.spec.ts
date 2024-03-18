import { Type } from 'class-transformer'
import { IsEnum, IsInstance, IsString } from 'class-validator'
import _ from 'lodash'
import {
  AmqpMessage,
  ExchangeType,
  Message,
  MessageHandler,
  Scope,
  publish,
} from '../../src'
import { irisTesting } from '../setup'

@Message({
  name: 'evt-frontend',
  scope: Scope.FRONTEND,
  exchangeType: ExchangeType.direct,
})
class EvtFrontend {
  @IsString({ each: true }) messages!: string[]
  @IsEnum(Scope) targetExchange!: Scope
}

@Message({
  name: 'evt-frontend-two',
  scope: Scope.FRONTEND,
  exchangeType: ExchangeType.direct,
})
class EvtFrontendTwo extends EvtFrontend {}

@Message({
  name: 'evt-frontend-three',
  scope: Scope.FRONTEND,
  exchangeType: ExchangeType.direct,
})
class EvtFrontendThree extends EvtFrontend {}

@Message({
  name: 'from-user-scope',
  scope: Scope.USER,
  exchangeType: ExchangeType.direct,
})
class EvtUser {
  @IsInstance(EvtFrontend) @Type(() => EvtFrontend) originalEvt!: EvtFrontend
  @IsString() routingKey!: string
}

@Message({
  name: 'from-session-scope',
  scope: Scope.SESSION,
  exchangeType: ExchangeType.direct,
})
class EvtSession extends EvtUser {}

@Message({
  name: 'from-broadcast-scope',
  scope: Scope.BROADCAST,
  exchangeType: ExchangeType.direct,
})
class EvtBroadcast extends EvtUser {}

class Handler {
  @MessageHandler({}, EvtFrontend)
  async handleFrontend(evt: EvtFrontend, msg: AmqpMessage): Promise<void> {
    await this.publishForScope(evt, msg.fields.routingKey)
  }

  @MessageHandler({}, EvtFrontendTwo)
  async handleFrontendTwo(
    evt: EvtFrontendTwo,
    msg: AmqpMessage,
  ): Promise<void> {
    await this.publishForScope(evt, msg.fields.routingKey)
  }

  @MessageHandler({}, EvtFrontendThree)
  async handleFrontendThree(
    evt: EvtFrontendThree,
    msg: AmqpMessage,
  ): Promise<void> {
    await this.publishForScope(evt, msg.fields.routingKey)
  }

  private async publishForScope(
    evt: EvtFrontend,
    routingKey: string,
  ): Promise<void> {
    switch (evt.targetExchange) {
      case Scope.USER:
        await publish.getPublisher(EvtUser)(
          { originalEvt: evt, routingKey },
          { userId: 'user-id' },
        )
        break
      case Scope.SESSION:
        await publish.getPublisher(EvtSession)(
          { originalEvt: evt, routingKey },
          { amqpPublishOpts: { headers: { 'x-session-id': 'session-id' } } },
        )
        break
      case Scope.BROADCAST:
        await publish.getPublisher(EvtBroadcast)({
          originalEvt: evt,
          routingKey,
        })
        break
      default:
        throw new Error('invalid test')
    }
  }
}

describe('External scopes (frontend/user/session). Testing with 3 frontend events to test internal frontend "router".', () => {
  let suite: irisTesting.integration.RegisterAndConnectReturnT
  let handler: Handler

  const frontEvtClasses: (typeof EvtFrontend)[] = [
    EvtFrontend,
    EvtFrontendTwo,
    EvtFrontendThree,
  ]

  beforeAll(async () => {
    suite = await irisTesting.integration.registerAndConnect(Handler)
    handler = suite.getHandlerFor(Handler)!
  })

  afterAll(async () => {
    await suite.deleteQueues()
  })

  for (const evtClass of frontEvtClasses) {
    // specified in @Message to be same as class name
    const expectedRoutingKey = _.kebabCase(evtClass.name)

    test(`Consume FRONTEND and publish to USER using ${evtClass.name}`, async () => {
      const spy = vi.fn()
      const unsubscribe = await irisTesting.utilities.subscribe(EvtUser, spy)

      await irisTesting.utilities.publishToFrontend(evtClass, {
        messages: ['hello'],
        targetExchange: Scope.USER,
      })

      await vi.waitFor(() => {
        expect(spy).toHaveBeenCalledOnce()
        expect(spy).toBeCalledWith(
          {
            originalEvt: { messages: ['hello'], targetExchange: Scope.USER },
            routingKey: expectedRoutingKey,
          },
          expect.anything(),
        )
      })

      await unsubscribe()
    })

    test(`Consume FRONTEND and publish to SESSION using ${evtClass.name}`, async () => {
      const spy = vi.fn()
      const unsubscribe = await irisTesting.utilities.subscribe(EvtSession, spy)

      await irisTesting.utilities.publishToFrontend(evtClass, {
        messages: ['hello'],
        targetExchange: Scope.SESSION,
      })

      await vi.waitFor(() => {
        expect(spy).toHaveBeenCalledOnce()
        expect(spy).toBeCalledWith(
          {
            originalEvt: { messages: ['hello'], targetExchange: Scope.SESSION },
            routingKey: expectedRoutingKey,
          },
          expect.anything(),
        )
      })

      await unsubscribe()
    })

    test(`Consume FRONTEND and publish to BROADCAST using ${evtClass.name}`, async () => {
      const spy = vi.fn()
      const unsubscribe = await irisTesting.utilities.subscribe(
        EvtBroadcast,
        spy,
      )

      await irisTesting.utilities.publishToFrontend(evtClass, {
        messages: ['hello'],
        targetExchange: Scope.BROADCAST,
      })

      await vi.waitFor(() => {
        expect(spy).toHaveBeenCalledOnce()
        expect(spy).toBeCalledWith(
          {
            originalEvt: {
              messages: ['hello'],
              targetExchange: Scope.BROADCAST,
            },
            routingKey: expectedRoutingKey,
          },
          expect.anything(),
        )
      })

      await unsubscribe()
    })
  }

  test('Publish to USER scope without x-user-id should throw', async () => {
    await expect(
      publish.getPublisher(EvtUser)({
        originalEvt: { targetExchange: Scope.USER, messages: [] },
        routingKey: 'rk',
      }),
    ).rejects.toEqual(
      new Error('ERR_IRIS_PUBLISH_TO_USER_SCOPE_WITHOUT_USER_ID'),
    )
  })

  test('Publish to SESSION scope without x-session-id should throw', async () => {
    await expect(
      publish.getPublisher(EvtSession)({
        originalEvt: { targetExchange: Scope.SESSION, messages: [] },
        routingKey: 'rk',
      }),
    ).rejects.toEqual(
      new Error('ERR_IRIS_PUBLISH_TO_SESSION_SCOPE_WITHOUT_SESSION_ID'),
    )
  })

  test('Publish to FRONTENT scope is not supported', async () => {
    await expect(
      publish.getPublisher(EvtFrontend)({
        messages: [],
        targetExchange: Scope.FRONTEND,
      }),
    ).rejects.toEqual(
      new Error('ERR_IRIS_PUBLISH_TO_FRONTENT_SCOPE_NOT_SUPPORTED'),
    )
  })
})
