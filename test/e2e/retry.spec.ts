import { IsString } from 'class-validator'
import {
  constants,
  AmqpMessage,
  ExchangeType,
  Message,
  MessageHandler,
  errors,
  helper,
  publish,
} from '../../src'
import { irisTesting } from '../setup'

@Message({ name: 'event-foo-dlq', maxRetry: 10 })
class FooDlqMsq {
  @IsString() name!: string
}

@Message({
  name: 'event-bar-dlq-custom-deadletter',
  deadLetter: 'bar-died',
  exchangeType: ExchangeType.direct,
  routingKey: 'bar-custom-dlq',
})
class BarCustomDLQMsg {
  @IsString() name!: string
}

/**
 * This exchange is otherwise managed by manager service
 */
@Message(
  { name: 'retry', exchangeType: ExchangeType.direct },
  { validate: false },
)
class Retry {}

@Message(
  {
    name: constants.MANAGED_EXCHANGES.DEAD_LETTER.EXCHANGE,
    exchangeType: constants.MANAGED_EXCHANGES.DEAD_LETTER.EXCHANGE_TYPE,
    routingKey: '#',
  },
  { validate: false },
)
class DefaultDLQ {}

@Message(
  {
    name: 'dead.bar-died',
    exchangeType: constants.MANAGED_EXCHANGES.DEAD_LETTER.EXCHANGE_TYPE,
    routingKey: '#',
  },
  { validate: false },
)
class CustomDlq {}

class Handler {
  throwError?: Error

  @MessageHandler()
  handleFooDqlMsg(_evt: FooDlqMsq): void {
    this.throwIfNeeded()
  }

  @MessageHandler()
  handleBarCustomDlqMsg(_evt: BarCustomDLQMsg): void {
    this.throwIfNeeded()
  }

  @MessageHandler({ bindingKeys: 'retry' })
  listenOnRetry(_evt: Retry, _am: AmqpMessage): void {}

  @MessageHandler()
  listenOnDefaultDlq(_evt: DefaultDLQ, _am: AmqpMessage): void {}

  @MessageHandler()
  listenOnCustomDlq(_evt: CustomDlq, _am: AmqpMessage): void {}

  throwThisError(error: Error): void {
    this.throwError = error
  }

  private throwIfNeeded(): void {
    if (this.throwError !== undefined) {
      throw this.throwError
    }
  }
}

describe('Retry / DLQ', () => {
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

  test('Message should be sent to retry queue when not rejected', async () => {
    class SomeError extends errors.MsgError {}
    class SomeOtherError extends errors.MsgError {
      errorType = errors.ErrorTypeE.BAD_REQUEST
    }
    const spyRetry = vi.spyOn(handler, 'listenOnRetry')
    const spyFooDlq = vi.spyOn(handler, 'handleFooDqlMsg')
    const spyBarDlqCustom = vi.spyOn(handler, 'handleBarCustomDlqMsg')

    const fooEvtName = `foo_evt_${Date.now()}`

    handler.throwThisError(
      new SomeError('I am going to retry..').setNotifyClient(true),
    )
    await publish.getPublisher(FooDlqMsq)({ name: fooEvtName })

    await vi.waitFor(() => {
      expect(spyFooDlq).toHaveBeenCalledTimes(1)
      expect(spyRetry).toHaveBeenCalledTimes(1)
      expect(spyRetry).toHaveBeenNthCalledWith(
        1,
        { name: fooEvtName },
        expect.anything(),
      )

      expect(spyRetry.mock.calls.at(0)![1]).toEqual(
        expect.objectContaining({
          fields: expect.objectContaining({
            routingKey: 'retry',
          }),

          properties: expect.objectContaining({
            headers: expect.objectContaining({
              'x-original-exchange': 'event-foo-dlq',
              'x-original-routing-key': 'event-foo-dlq',
              'x-max-retries': 10,
              'x-event-type': 'event-foo-dlq',
              'x-dead-letter-exchange': 'dead.dead-letter',
              'x-dead-letter-routing-key': `dead.${helper.getServiceName()}.event-foo-dlq`,
              'x-notify-client': true,
              'x-error-code': 'SomeError',
              'x-error-message': 'I am going to retry..',
              'x-error-type': 'INTERNAL_SERVER_ERROR',
            }),
          }),
        }),
      )
    })

    spyRetry.mockClear()
    handler.throwThisError(
      new SomeOtherError(
        'I am going to retry, notify client turned off..',
      ).setNotifyClient(false),
    )

    const fooCustomDlqEvtName = `foo_custom_dlq_evt_${Date.now()}`

    await publish.getPublisher(BarCustomDLQMsg)({
      name: fooCustomDlqEvtName,
    })

    await vi.waitFor(() => {
      expect(spyBarDlqCustom).toHaveBeenCalledTimes(1)
      expect(spyRetry).toHaveBeenCalledTimes(1)
      expect(spyRetry).toHaveBeenNthCalledWith(
        1,
        { name: fooCustomDlqEvtName },
        expect.anything(),
      )

      expect(spyRetry.mock.calls.at(0)![1]).toEqual(
        expect.objectContaining({
          fields: expect.objectContaining({
            routingKey: 'retry',
          }),

          properties: expect.objectContaining({
            headers: expect.objectContaining({
              'x-original-exchange': 'event-bar-dlq-custom-deadletter',
              'x-original-routing-key': 'bar-custom-dlq',
              'x-max-retries':
                constants.CONNECTION_DEFAULT_OPTONS.maxMessageRetryCount,
              'x-event-type': 'event-bar-dlq-custom-deadletter',
              'x-dead-letter-exchange': 'dead.bar-died',
              'x-dead-letter-routing-key': `dead.${helper.getServiceName()}.event-bar-dlq-custom-deadletter.bar-custom-dlq`,
              'x-notify-client': false,
              'x-error-code': 'SomeOtherError',
              'x-error-message':
                'I am going to retry, notify client turned off..',
              'x-error-type': 'BAD_REQUEST',
            }),
          }),
        }),
      )
    })
  })

  test('A message should be immediately sent to default DQL when rejected via RejectMsgError', async () => {
    const spyRetry = vi.spyOn(handler, 'listenOnRetry')
    const spyFooDlq = vi.spyOn(handler, 'handleFooDqlMsg')
    const spyDefaultDlq = vi.spyOn(handler, 'listenOnDefaultDlq')
    const spyCustomDlq = vi.spyOn(handler, 'listenOnCustomDlq')

    const fooEvtName = `foo_evt_${Date.now()}`

    handler.throwThisError(
      new errors.RejectMsgError('I am going directly to default DLQ'),
    )
    await publish.getPublisher(FooDlqMsq)(
      { name: fooEvtName },
      { routingKey: 'foo' },
    )

    await vi.waitFor(() => {
      expect(spyFooDlq).toHaveBeenCalledTimes(1)
      // running tests in parallel can cause more than 1 message to be sent to default DLQ
      expect(spyDefaultDlq).toHaveBeenCalled()
      expect(spyRetry).toHaveBeenCalledTimes(0)
      expect(spyCustomDlq).toHaveBeenCalledTimes(0)

      const dlqMsg = spyDefaultDlq.mock.calls.find(
        (msg) => (<{ name: string }>msg[0]).name === fooEvtName,
      )

      expect(dlqMsg).toBeDefined()

      expect(dlqMsg![1]).toEqual(
        expect.objectContaining({
          fields: expect.objectContaining({
            exchange: constants.MANAGED_EXCHANGES.DEAD_LETTER.EXCHANGE,
            routingKey: `dead.${helper.getServiceName()}.event-foo-dlq`,
          }),
          properties: expect.objectContaining({
            headers: expect.objectContaining({
              'x-current-service-id': helper.getServiceName(),
              'x-event-type': 'event-foo-dlq',
              'x-first-death-exchange': 'event-foo-dlq',
              'x-first-death-reason': 'rejected',
              'x-instance-id': helper.getHostName(),
              'x-origin-service-id': helper.getServiceName(),
            }),
          }),
        }),
      )
    })
  })

  test('A message should be immediately sent to custom DQL when rejected via RejectMsgError', async () => {
    const spyRetry = vi.spyOn(handler, 'listenOnRetry')
    const spyBarCustomDlq = vi.spyOn(handler, 'handleBarCustomDlqMsg')
    const spyDefaultDlq = vi.spyOn(handler, 'listenOnDefaultDlq')
    const spyCustomDlq = vi.spyOn(handler, 'listenOnCustomDlq')

    const barEvtName = `bar_evt_${Date.now()}`

    handler.throwThisError(
      new errors.RejectMsgError('I am going directly to custom DLQ'),
    )
    await publish.getPublisher(BarCustomDLQMsg)({ name: barEvtName })

    await vi.waitFor(() => {
      expect(spyBarCustomDlq).toHaveBeenCalledTimes(1)
      expect(spyCustomDlq).toHaveBeenCalledTimes(1)
      expect(spyDefaultDlq).toHaveBeenCalledTimes(0)
      expect(spyRetry).toHaveBeenCalledTimes(0)

      expect(spyCustomDlq.mock.calls.at(0)![1]).toEqual(
        expect.objectContaining({
          fields: expect.objectContaining({
            exchange: 'dead.bar-died',
            routingKey: `dead.${helper.getServiceName()}.event-bar-dlq-custom-deadletter.bar-custom-dlq`,
          }),
          properties: expect.objectContaining({
            headers: expect.objectContaining({
              'x-current-service-id': helper.getServiceName(),
              'x-event-type': 'event-bar-dlq-custom-deadletter',
              'x-first-death-exchange': 'event-bar-dlq-custom-deadletter',
              'x-first-death-reason': 'rejected',
              'x-instance-id': helper.getHostName(),
              'x-origin-service-id': helper.getServiceName(),
            }),
          }),
        }),
      )
    })
  })
})
