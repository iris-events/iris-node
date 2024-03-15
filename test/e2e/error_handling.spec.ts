import { IsEnum, IsString } from 'class-validator'
import {
  constants,
  AmqpMessage,
  ExchangeType,
  Message,
  MessageHandler,
  errors,
  flags,
  publish,
} from '../../src'
import { irisTesting } from '../setup'

@Message({
  name: 'event-foo-direct',
  exchangeType: ExchangeType.direct,
  routingKey: 'foo',
})
class Foo {
  @IsString() name!: string
}

@Message({ name: 'event-bar' })
class Bar {
  @IsString() name!: string
}

/**
 * Event to subscribe to `error` exchange in order to get reported errors
 */
@Message({ name: 'error', exchangeType: ExchangeType.topic })
class ErrorEvt implements errors.ErrorMessageI {
  @IsEnum(errors.ErrorTypeE) errorType!: errors.ErrorTypeE
  @IsString() code!: string
  @IsString() message!: string
}

class Handler {
  throwError?: Error

  throwThisError(error: Error): void {
    this.throwError = error
  }

  private doThrow(): void {
    if (this.throwError !== undefined) {
      throw this.throwError
    }
  }

  @MessageHandler()
  handleFoo(_evt: Foo): void {
    this.doThrow()
  }

  @MessageHandler()
  handleBar(_evt: Bar): void {
    this.doThrow()
  }

  @MessageHandler({ bindingKeys: '#' })
  handleError(_evt: ErrorEvt, _am: AmqpMessage): void {}
}

describe('Error handling', () => {
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

  test('Error of type `RejectMsgError` should be directly rejected and error sent to `error` exchange if notifyClient is set to true', async () => {
    class NotFoundError extends errors.RejectMsgError {
      errorType: errors.ErrorTypeE = errors.ErrorTypeE.NOT_FOUND
    }

    const spyError = vi.spyOn(handler, 'handleError')
    const spyFoo = vi.spyOn(handler, 'handleFoo')

    handler.throwThisError(
      new errors.RejectMsgError('BECAUSE OF REASONS', true),
    )

    await publish.getPublisher(Foo)({ name: 'foo_evt' }, { routingKey: 'foo' })

    await vi.waitFor(() => {
      expect(spyFoo).toHaveBeenCalledTimes(1)
      expect(spyFoo).toHaveBeenNthCalledWith(1, { name: 'foo_evt' })
    })

    spyFoo.mockClear()

    handler.throwThisError(new NotFoundError('NOTHING HERE', true))

    await publish.getPublisher(Foo)(
      { name: 'foo_evt_2' },
      { routingKey: 'foo' },
    )

    await vi.waitFor(() => {
      expect(spyFoo).toHaveBeenCalledTimes(1)
      expect(spyFoo).toHaveBeenNthCalledWith(1, { name: 'foo_evt_2' })
    })

    await vi.waitFor(() => {
      expect(spyError).toHaveBeenCalledTimes(2)
      expect(spyError).toHaveBeenNthCalledWith(
        1,
        {
          errorType: errors.ErrorTypeE.BAD_REQUEST,
          code: 'RejectMsgError',
          message: 'BECAUSE OF REASONS',
        },
        expect.anything(),
      )
      expect(spyError).toHaveBeenNthCalledWith(
        2,
        {
          errorType: errors.ErrorTypeE.NOT_FOUND,
          code: 'NotFoundError',
          message: 'NOTHING HERE',
        },
        expect.anything(),
      )

      expect(spyError.mock.calls.at(0)![1]).toEqual(
        expect.objectContaining({
          fields: expect.objectContaining({
            routingKey: 'event-foo-direct.error',
          }),
          properties: expect.objectContaining({
            headers: expect.objectContaining({
              'x-event-type': 'error',
            }),
          }),
        }),
      )

      expect(spyError.mock.calls.at(1)![1]).toEqual(
        expect.objectContaining({
          fields: expect.objectContaining({
            routingKey: 'event-foo-direct.error',
          }),
          properties: expect.objectContaining({
            headers: expect.objectContaining({
              'x-event-type': 'error',
            }),
          }),
        }),
      )
    })
  })

  test('Message should be directly rejected if structure does not correspond to specified message class', async () => {
    const spyError = vi.spyOn(handler, 'handleError')
    const spyFoo = vi.spyOn(handler, 'handleFoo')

    const currentDisableProduceValidationFlag =
      flags.DISABLE_MESSAGE_PRODUCE_VALIDATION
    flags.DISABLE_MESSAGE_PRODUCE_VALIDATION = true
    const invalidFooEvent = <Foo>(<unknown>{ name: 1234 })
    await publish.getPublisher(Foo)(invalidFooEvent, {
      routingKey: 'foo',
      amqpPublishOpts: {
        headers: {
          // error is auto sent to `error` exchange if session is found
          [constants.MESSAGE_HEADERS.MESSAGE.SESSION_ID]: 'foo-id',
        },
      },
    })
    flags.DISABLE_MESSAGE_PRODUCE_VALIDATION =
      currentDisableProduceValidationFlag

    await vi.waitFor(() => {
      expect(spyFoo).toHaveBeenCalledTimes(0)
      expect(spyError).toHaveBeenCalledTimes(1)

      expect(spyError).toHaveBeenNthCalledWith(
        1,
        {
          errorType: errors.ErrorTypeE.BAD_REQUEST,
          code: 'InvalidObjectConverionError',
          message:
            '[{"target":{"name":1234},"value":1234,"property":"name","children":[],"constraints":{"isString":"name must be a string"}}]',
        },
        expect.anything(),
      )

      expect(spyError.mock.calls.at(0)![1]).toEqual(
        expect.objectContaining({
          fields: expect.objectContaining({
            routingKey: 'event-foo-direct.error',
          }),
          properties: expect.objectContaining({
            headers: expect.objectContaining({
              'x-event-type': 'error',
            }),
          }),
        }),
      )
    })
  })
})
