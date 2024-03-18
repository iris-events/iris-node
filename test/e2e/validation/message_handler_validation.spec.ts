import { IsString } from 'class-validator'
import {
  ExchangeType,
  Message,
  MessageDeliveryMode,
  MessageHandler,
  Scope,
  SnapshotRequested,
  connection,
  publish,
} from '../../../src'
import { irisTesting } from '../../setup'

class NonMessageClass {}

@Message({ name: 'foo', scope: Scope.FRONTEND })
class FooFrontend {}

@Message({ name: 'foo-topic', exchangeType: ExchangeType.topic })
class FooTopic {}

@Message({ name: 'foo-direct', exchangeType: ExchangeType.direct })
class FooDirect {
  @IsString() msg!: string
}

@Message({ name: 'foo-fanout' })
class FooFanout {}

describe('MessageHandler validation', () => {
  test('MessageDeliveryMode = PER_SERVICE_INSTANCE is not allowed for FRONTEND scope messages', async () => {
    const expectedError = {
      message: expect.stringMatching(
        /ERR_IRIS_PER_SERVICE_INSTANCE_NOT_SUPPORTED_FOR_FRONTEND_SCOPE/,
      ),
    }

    class Handler {
      @MessageHandler({
        messageDeliveryMode: MessageDeliveryMode.PER_SERVICE_INSTANCE,
      })
      handle(_evt: FooFrontend): void {}
    }
    await expect(
      irisTesting.integration.registerAndConnect(Handler),
    ).rejects.toMatchObject(expectedError)
  })

  test('MessageDeliveryMode = PER_SERVICE_INSTANCE is not allowed for SubscriptionSnapshotRequested messages', async () => {
    const expectedError = {
      message: expect.stringMatching(
        /ERR_IRIS_PER_SERVICE_INSTANCE_NOT_SUPPORTED_WITH_SNAPSHOT_REQUESTED_MESSAGE/,
      ),
    }

    class Handler {
      @MessageHandler({
        messageDeliveryMode: MessageDeliveryMode.PER_SERVICE_INSTANCE,
      })
      handle(_evt: SnapshotRequested): void {}
    }
    await expect(
      irisTesting.integration.registerAndConnect(Handler),
    ).rejects.toMatchObject(expectedError)
  })

  test('Setting bindingKeys for handler using FRONTEND scope message is not supported', async () => {
    const expectedError = {
      message: expect.stringMatching(
        /ERR_IRIS_MESSAGE_HANDLER_BINDING_KEYS_ARE_OVERRIDDEN_FOR_FRONTEND_SCOPE/,
      ),
    }

    class Handler {
      @MessageHandler({ bindingKeys: 'some-binding-key' })
      handle(_evt: FooFrontend): void {}
    }
    await expect(
      irisTesting.integration.registerAndConnect(Handler),
    ).rejects.toMatchObject(expectedError)
  })

  test('Setting bindingKeys for handler using FANOUT messages is not supported', async () => {
    const expectedError = {
      message: expect.stringMatching(
        /ERR_IRIS_MESSAGE_HANDLER_BINDING_KEYS_HAVE_NO_EFFECT_FOR_FANOUT_EXCHANGE/,
      ),
    }

    class Handler {
      @MessageHandler({ bindingKeys: 'some-binding-key' })
      handle(_evt: FooFanout): void {}
    }
    await expect(
      irisTesting.integration.registerAndConnect(Handler),
    ).rejects.toMatchObject(expectedError)
  })

  test('Binding keys should be kebab-case only for DIRECT messages', async () => {
    const expectedError = {
      message: expect.stringMatching(
        /ERR_IRIS_MESSAGE_HANDLER_INVALID_BINDING_KEYS/,
      ),
    }

    class HandlerFanout {
      @MessageHandler({ bindingKeys: 'some-binding.key' })
      handle(_evt: FooDirect): void {}
    }
    await expect(
      irisTesting.integration.registerAndConnect(HandlerFanout),
    ).rejects.toMatchObject(expectedError)
  })

  test('Binding keys should be kebab-case for TOPIC messages', async () => {
    const expectedError = {
      message: expect.stringMatching(
        /ERR_IRIS_MESSAGE_HANDLER_INVALID_BINDING_KEYS/,
      ),
    }

    class Handler {
      @MessageHandler({ bindingKeys: 'some_binding.key' })
      handle(_evt: FooTopic): void {}
    }
    await expect(
      irisTesting.integration.registerAndConnect(Handler),
    ).rejects.toMatchObject(expectedError)
  })

  test('Event Class should be decorated with @Message', () => {
    const expectedError = /ERR_IRIS_INVALID_HANDLER_CONFIG/
    expect(() => {
      class Handler {
        @MessageHandler()
        handle(_evt: NonMessageClass): void {}
      }
    }).toThrowError(expectedError)
  })

  test('Only @Message is allowed as handler argument', () => {
    const expectedError = /ERR_IRIS_INVALID_HANDLER_CONFIG/

    expect(() => {
      class Handler {
        @MessageHandler()
        handle(_evt: FooTopic, _evt2: FooDirect): void {}
      }
    }).toThrowError(expectedError)
  })

  test('Reply Class should be decorated with @Message', () => {
    const expectedError = /ERR_IRIS_INVALID_HANDLER_REPLY_CLASS/
    expect(() => {
      class Handler {
        @MessageHandler({}, NonMessageClass)
        handle(_evt: FooFanout): void {}
      }
    }).toThrowError(expectedError)
  })

  test('Using handler for same @Message with same bindingKeys is invalid', async () => {
    const expectedError = {
      message: expect.stringMatching(/ERR_IRIS_DUPLICATE_MESSAGE_HANDLER/),
    }

    class HandlerWithBKeys {
      @MessageHandler({ bindingKeys: ['foo', 'bar'] })
      handleFoo(_evt: FooTopic): void {}

      @MessageHandler({ bindingKeys: ['foo', 'bar'] })
      handleFoo2(_evt: FooTopic): void {}
    }
    await expect(
      irisTesting.integration.registerAndConnect(HandlerWithBKeys),
    ).rejects.toMatchObject(expectedError)

    class HandlerWithDefaults {
      @MessageHandler()
      handleFoo(_evt: FooFanout): void {}

      @MessageHandler()
      handleFoo2(_evt: FooFanout): void {}
    }
    await expect(
      irisTesting.integration.registerAndConnect(HandlerWithDefaults),
    ).rejects.toMatchObject(expectedError)
  })

  test('Using handler for same @Message but different bindingKeys should work', async () => {
    class Handler {
      @MessageHandler({ bindingKeys: 'foo' })
      handleFooKey(_evt: FooDirect): void {}

      @MessageHandler({ bindingKeys: 'bar' })
      handleBarKey(_evt: FooDirect): void {}
    }
    const suite = await irisTesting.integration.registerAndConnect(Handler)

    const handler = suite.getHandlerFor(Handler)!
    const publisher = publish.getPublisher(FooDirect)

    const spyFoo = vi.spyOn(handler, 'handleFooKey')
    const spyBar = vi.spyOn(handler, 'handleBarKey')

    await publisher({ msg: 'foo' }, { routingKey: 'foo' })
    await publisher({ msg: 'bar' }, { routingKey: 'bar' })
    await vi.waitFor(() => {
      expect(spyFoo).toHaveBeenCalledTimes(1)
      expect(spyFoo).toHaveBeenNthCalledWith(1, { msg: 'foo' })

      expect(spyBar).toHaveBeenCalledTimes(1)
      expect(spyBar).toHaveBeenNthCalledWith(1, { msg: 'bar' })
    })

    await suite.deleteQueues()
    await connection.disconnect()
  })

  test('When using DIRECT Message, exactly one bindingKey should be set', async () => {
    const expectedError = {
      message: expect.stringMatching(
        /ERR_IRIS_MESSAGE_HANDLER_INVALID_BINDING_KEYS/,
      ),
    }

    class HandlerMultipleBindingKeys {
      @MessageHandler({ bindingKeys: ['foo', 'bar'] })
      handle(_evt: FooDirect): void {}
    }

    await expect(
      irisTesting.integration.registerAndConnect(HandlerMultipleBindingKeys),
    ).rejects.toMatchObject(expectedError)
  })
})
