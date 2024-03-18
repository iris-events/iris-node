import { Message, MessageHandler } from '../../../src'
import { irisTesting } from '../../setup'

describe('Message Validation', () => {
  test("Non empty 'name' is required for @Message", async () => {
    const expectedError = {
      message: expect.stringMatching(/ERR_IRIS_MESSAGE_REQUIRES_NAME/),
    }

    @Message({ name: '' })
    class Foo {}

    class Handler {
      @MessageHandler()
      handle(_evt: Foo): void {}
    }

    await expect(
      irisTesting.integration.registerAndConnect(Handler),
    ).rejects.toMatchObject(expectedError)
  })

  test('Name should be kebab-case', async () => {
    const expectedError = {
      message: expect.stringMatching(/ERR_IRIS_MESSAGE_INVALID_NAME/),
    }

    @Message({ name: 'foo+msg' })
    class Foo {}

    class Handler {
      @MessageHandler()
      handle(_evt: Foo): void {}
    }

    await expect(
      irisTesting.integration.registerAndConnect(Handler),
    ).rejects.toMatchObject(expectedError)
  })

  test('RoutingKey should be kebab-case', async () => {
    const expectedError = {
      message: expect.stringMatching(/ERR_IRIS_MESSAGE_INVALID_ROUTING_KEY/),
    }

    @Message({ name: 'foo', routingKey: 'foo+evt' })
    class Foo {}

    class Handlere {
      @MessageHandler()
      handle(_evt: Foo): void {}
    }

    await expect(
      irisTesting.integration.registerAndConnect(Handlere),
    ).rejects.toMatchObject(expectedError)
  })

  test('DeadLetter should be kebab-case', async () => {
    const expectedError = {
      message: expect.stringMatching(
        /ERR_IRIS_MESSAGE_INVALID_DEAD_LETTER_NAME/,
      ),
    }

    @Message({ name: 'foo', deadLetter: 'foo+evt' })
    class Foo {}

    class Handlere {
      @MessageHandler()
      handle(_evt: Foo): void {}
    }

    await expect(
      irisTesting.integration.registerAndConnect(Handlere),
    ).rejects.toMatchObject(expectedError)
  })

  test('Exchange names should be unique (should not allow multiple @Message classes with same name)', async () => {
    const expectedError = {
      message: expect.stringMatching(/ERR_IRIS_MESSAGE_NAME_NOT_UNIQUE/),
    }

    @Message({ name: 'foo' })
    class Foo {}

    @Message({ name: 'foo' })
    class AnotherFoo {}

    class Handler {
      @MessageHandler()
      handle(_evt: Foo): void {}
      @MessageHandler()
      handleAnother(_evt: AnotherFoo): void {}
    }
    await expect(
      irisTesting.integration.registerAndConnect(Handler),
    ).rejects.toMatchObject(expectedError)
  })
})
