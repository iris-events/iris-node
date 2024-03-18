import { IsString } from 'class-validator'
import {
  constants,
  AmqpMessage,
  Message,
  MessageHandler,
  Scope,
  publish,
} from '../../src'
import { irisTesting } from '../setup'

@Message({
  name: constants.MANAGED_EXCHANGES.USER.EXCHANGE,
  exchangeType: constants.MANAGED_EXCHANGES.USER.EXCHANGE_TYPE,
  routingKey: 'user',
})
class EvtUser {
  @IsString() msg!: string
}

@Message({
  name: 'session-msg',
  scope: Scope.SESSION,
})
class EvtSession {
  @IsString() msg!: string
}

@Message({ name: 'internal-msg' })
class EvtInternal {
  @IsString() msg!: string
}

class Handler {
  @MessageHandler({ bindingKeys: '#' })
  async publishInternalToUser(evt: EvtUser, amqpMsg: AmqpMessage) {
    if (evt.msg === 'do-publish-internal-to-user') {
      await publish.getUserPublisher(EvtInternal)({ msg: 'hello' }, amqpMsg)
    }
  }
}

describe('Publishing non Scope.USER messages to user via publish.[publishToUser/getUserPublisher]', () => {
  let suite: irisTesting.integration.RegisterAndConnectReturnT
  let handler: Handler

  beforeAll(async () => {
    suite = await irisTesting.integration.registerAndConnect(Handler)
    handler = suite.getHandlerFor(Handler)!
  })

  afterAll(async () => {
    await suite.deleteQueues()
  })

  test('Sending SESSION event to USER should work', async () => {
    const spyHandler = vi.spyOn(handler, 'publishInternalToUser')
    const headers = { foo: `bar_${Date.now()}` }

    await publish.publishToUser(
      EvtSession,
      { msg: 'do-publish-internal-to-user' },
      'user-id',
      { amqpPublishOpts: { headers } },
    )

    await vi.waitFor(() => {
      expect(spyHandler).toHaveBeenCalledTimes(2)
      expect(spyHandler).toHaveBeenNthCalledWith(
        1,
        { msg: 'do-publish-internal-to-user' },
        expect.anything(),
      )
      expect(spyHandler).toHaveBeenNthCalledWith(
        2,
        { msg: 'hello' },
        expect.objectContaining({
          fields: expect.any(Object),
          content: expect.any(Buffer),
          properties: expect.objectContaining({
            headers: expect.objectContaining(headers),
          }),
        }),
      )
    })
  })

  test('Sending INTERNAL event to USER should work', async () => {
    const spyHandler = vi.spyOn(handler, 'publishInternalToUser')
    const headers = { foo: `bar_${Date.now()}` }

    await publish.publishToUser(
      EvtInternal,
      { msg: 'do-publish-internal-to-user' },
      'user-id',
      { amqpPublishOpts: { headers } },
    )

    await vi.waitFor(() => {
      expect(spyHandler).toHaveBeenCalledTimes(2)
      expect(spyHandler).toHaveBeenNthCalledWith(
        1,
        { msg: 'do-publish-internal-to-user' },
        expect.anything(),
      )
      expect(spyHandler).toHaveBeenNthCalledWith(
        2,
        { msg: 'hello' },
        expect.objectContaining({
          fields: expect.any(Object),
          content: expect.any(Buffer),
          properties: expect.objectContaining({
            headers: expect.objectContaining(headers),
          }),
        }),
      )
    })
  })

  test('Should throw if user-id is missing', async () => {
    await expect(
      publish.publishToUser(
        EvtInternal,
        { msg: 'do-publish-internal-to-user' },
        // @ts-ignore
        {},
      ),
    ).rejects.toThrow('ERR_IRIS_PUBLISHER_USER_ID_NOT_RESOLVED')

    await expect(
      publish.publishToUser(
        EvtInternal,
        { msg: 'do-publish-internal-to-user' },
        // @ts-ignore
        new EvtInternal(),
      ),
    ).rejects.toThrow('ERR_IRIS_PUBLISHER_USER_ID_NOT_RESOLVED')
  })
})
