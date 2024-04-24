import { IsString } from 'class-validator'
import {
  AmqpMessage,
  Message,
  MessageHandler,
  ResourceMessage,
  SnapshotMessageHandler,
  SnapshotRequested,
  SubscribeInternal,
  publish,
  subscription,
} from '../../src'
import { irisTesting } from '../setup'

@Message({ name: 'event-foo' })
class Foo {
  @IsString() name!: string
}

@Message({ name: 'do-subscribe-me' })
class DoSubscribeMe {
  @IsString() toResource!: string
  @IsString() toId!: string
}

class Handler {
  @MessageHandler()
  async subMe(evt: DoSubscribeMe, irisMsg: AmqpMessage): Promise<void> {
    await subscription.internallySubscribe(irisMsg, evt.toResource, evt.toId)
  }

  /**
   * this is managed by a dedicated subscription service, using
   * handler here just for spy purposes
   */
  @MessageHandler()
  onSubscribeInternal(_evt: SubscribeInternal): void {}

  /**
   * this is managed by a dedicated subscription service, using
   * handler here just for spy purposes
   */
  @MessageHandler({ bindingKeys: '*.resource' })
  onSubscription(_evt: ResourceMessage): void {}

  @MessageHandler({ bindingKeys: 'foo-resource' })
  onSnapshotRequestFooViaClassicDecorator(_evt: SnapshotRequested): void {}

  @SnapshotMessageHandler({ resourceType: 'bar-resource' })
  onSnapshotRequestBar(_evt: SnapshotRequested): void {}

  @SnapshotMessageHandler({ resourceType: 'car-resource' })
  onSnapshotRequestCar(_evt: SnapshotRequested): void {}
}

describe('Subscription', () => {
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

  test('getSubscriptionPublisher()', async () => {
    const spyOnSubscription = vi.spyOn(handler, 'onSubscription')

    const subPublisher = subscription.getSnapshotPublisher(Foo)
    await subPublisher({ name: 'foo_evt 1' }, 'foo', 'foo-1')
    await subPublisher({ name: 'foo_evt 2' }, 'foo', 'foo-2')

    await vi.waitFor(() => {
      expect(spyOnSubscription).toHaveBeenCalledTimes(2)
      expect(spyOnSubscription).toHaveBeenNthCalledWith(1, {
        payload: { name: 'foo_evt 1' },
        resourceType: 'foo',
        resourceId: 'foo-1',
      })
      expect(spyOnSubscription).toHaveBeenNthCalledWith(2, {
        payload: { name: 'foo_evt 2' },
        resourceType: 'foo',
        resourceId: 'foo-2',
      })
    })
  })

  test('internallySubscribe() called as side effect of another event', async () => {
    const spyOnSubscribeInternal = vi.spyOn(handler, 'onSubscribeInternal')
    const spyOnSubscribeMe = vi.spyOn(handler, 'subMe')

    await publish.getPublisher(DoSubscribeMe)({
      toResource: 'some-resource',
      toId: '1-2-3',
    })

    await vi.waitFor(() => {
      expect(spyOnSubscribeMe).toHaveBeenCalledTimes(1)
      expect(spyOnSubscribeInternal).toHaveBeenCalledTimes(1)

      expect(spyOnSubscribeInternal).toHaveBeenNthCalledWith(1, {
        resourceType: 'some-resource',
        resourceId: '1-2-3',
      })
    })
  })

  test('SnapshotMessageHandler()', async () => {
    const spyOnSnapshotBar = vi.spyOn(handler, 'onSnapshotRequestBar')
    const spyOnSnapshotCar = vi.spyOn(handler, 'onSnapshotRequestCar')

    await irisTesting.utilities.requestSnapshot('bar-resource', 'bar-id')
    await irisTesting.utilities.requestSnapshot('car-resource', 'car-id')

    await vi.waitFor(() => {
      expect(spyOnSnapshotBar).toHaveBeenCalledTimes(1)
      expect(spyOnSnapshotBar).toHaveBeenNthCalledWith(1, {
        resourceType: 'bar-resource',
        resourceId: 'bar-id',
      })

      expect(spyOnSnapshotCar).toHaveBeenCalledTimes(1)
      expect(spyOnSnapshotCar).toHaveBeenNthCalledWith(1, {
        resourceType: 'car-resource',
        resourceId: 'car-id',
      })
    })
  })

  test('SnapshotRequested via MessageHandler()', async () => {
    const spyOnSnapshotFoo = vi.spyOn(
      handler,
      'onSnapshotRequestFooViaClassicDecorator',
    )

    await irisTesting.utilities.requestSnapshot('foo-resource', 'foo-id')

    await vi.waitFor(() => {
      expect(spyOnSnapshotFoo).toHaveBeenCalledTimes(1)
      expect(spyOnSnapshotFoo).toHaveBeenNthCalledWith(1, {
        resourceType: 'foo-resource',
        resourceId: 'foo-id',
      })
    })
  })
})
