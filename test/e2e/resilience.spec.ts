import { IsString } from 'class-validator'
import _ from 'lodash'
import { v4 } from 'uuid'
import { MockInstance } from 'vitest'
import * as rabbit from '../rabbit'
import { irisTesting } from '../setup'

import {
  constants,
  AmqpMessage,
  Message,
  MessageHandler,
  connection,
  publish,
} from '../../src'

@Message({ name: 'ping' })
class Ping {
  @IsString() msg!: string
}

@Message({ name: 'pong' })
class Pong {
  @IsString() msg!: string
}

class ResilienceHandler {
  @MessageHandler({}, Pong)
  ping(evt: Ping): Pong {
    return { msg: evt.msg }
  }

  @MessageHandler()
  pong(_evt: Pong, _amqpMsg: AmqpMessage) {}
}

// rabbit's admin APIs do not return actual state immediately
const RABBIT_ADMIN_REFRESH_DELAY = 4000

describe.runIf(process.env.TESTS_SKIP_RESILIENCE !== '1')('Resilience', () => {
  let suite: irisTesting.integration.RegisterAndConnectReturnT
  let handler: ResilienceHandler

  let spyPong: MockInstance

  const reinitializationDelay = constants.getReinitializationDelay()

  beforeAll(async () => {
    suite = await irisTesting.integration.registerAndConnect(ResilienceHandler)
    handler = suite.getHandlerFor(ResilienceHandler)!
    spyPong = vi.spyOn(handler, 'pong')

    constants.setReinitializationDelay(100)
  })

  async function waitForReinitialization(): Promise<void> {
    const reinitDelay = constants.getReinitializationDelay()
    // give it some time to re-assert queues, re-open channesl etc
    const waitForAssertions = 400

    return new Promise((resolve) =>
      setTimeout(resolve, reinitDelay + waitForAssertions),
    )
  }

  async function testConnectionViaMessage(msg: string): Promise<void> {
    const uniqueMsg = `${msg}_${v4()}`
    await publish.getPublisher(Ping)({ msg: uniqueMsg })
    await vi.waitFor(() => {
      expect(spyPong).toHaveBeenCalledWith(
        { msg: uniqueMsg },
        expect.anything(),
      )
    }, 20000)

    expect(spyPong).toHaveBeenCalledOnce()
  }

  function expectConnected() {
    expect(connection.isDisconnected()).toEqual(false)
    expect(connection.isReconnecting()).toEqual(false)
  }

  afterAll(async () => {
    constants.setReinitializationDelay(reinitializationDelay)
    await rabbit.adminDeleteAllTestUsers()
    if (connection.isDisconnected()) {
      await irisTesting.utilities.connect()
    }
    suite.deleteQueues()
  })

  describe('Reconnect', () => {
    test('Test setup', async () => {
      const msg = 'foo'
      await testConnectionViaMessage(msg)
    })

    test('Service should recover when channels are closed', async () => {
      const msg = 'foo_after_channel_close'
      const channel = await irisTesting.utilities.getChannelForMessage(Ping)
      await channel.close()
      await waitForReinitialization()

      await testConnectionViaMessage(msg)
      expectConnected()
    })

    test('Service should recover when queues are deleted', async () => {
      const msg = 'foo_after_queue_delete'
      await suite.deleteQueues(true)

      await waitForReinitialization()

      await testConnectionViaMessage(msg)
      expectConnected()
    })

    test("Service should recover when queue and it's exchange are deleted", async () => {
      const msg = 'foo_after_queue_delete'
      await suite.deleteQueues(true)
      await suite.deleteExchange(Ping)

      await waitForReinitialization()

      await testConnectionViaMessage(msg)
      expectConnected()
    })

    test('Service should recover when connection is closed', async () => {
      const msg = 'foo_after_connection_close'

      await connection.getConnection()!.close()
      await waitForReinitialization()

      await testConnectionViaMessage(msg)
      expectConnected()
    })

    test('Service should recover when connection is closed with error', async () => {
      const msg = 'foo_after_connection_close_with_error'
      expectConnected()

      await vi.waitFor(async () => {
        const connectionNames = await rabbit.adminGetConnectionNames()
        expect(connectionNames.length).toBeGreaterThan(0)
      }, 10000) // it can take long time for rabbit to return something

      // kill connection via admin api which results in
      // 'error' being present on 'close' event
      await rabbit.adminCloseAllConnections()
      await waitForReinitialization()

      await testConnectionViaMessage(msg)
      expectConnected()
    }, 10000)
  })

  // test this in a loop, making sure that lib can be
  // reused after disconnected
  test.each([1, 2, 3])(
    'Service should NOT recover when connection is closed intentionally, pass %i',
    async (idx) => {
      await irisTesting.integration.registerAndConnect(ResilienceHandler)
      await connection.disconnect()
      await waitForReinitialization()
      await expect(
        publish.getPublisher(Ping)({ msg: `will fail ${idx}` }),
      ).rejects.toThrow('ERR_IRIS_CONNECTION_NOT_ESTABLISHED')
      expect(connection.isDisconnected()).toEqual(true)
      expect(connection.isReconnecting()).toEqual(false)
    },
  )

  describe('Reconnect retrying', () => {
    const reconnectInterval = 300
    const reconnectTries = 4
    let testCredentials: { username: string; password: string }

    beforeEach(async () => {
      const amqpUrl = new URL(rabbit.getAmqpUrl())
      testCredentials = await rabbit.adminUpsertUser()
      await connection.disconnect()
      expect(connection.isReconnecting()).toEqual(false)

      suite = await irisTesting.integration.registerAndConnect(
        ResilienceHandler,
        {
          // can not use spread with URL class
          urlOrOpts: _.merge({}, amqpUrl, {
            username: testCredentials.username,
            password: testCredentials.password,
            protocol: amqpUrl.protocol.replace(':', ''),
          }),
          reconnectInterval,
          reconnectTries,
          reconnectFactor: 0, // less math timing the tests
        },
      )

      handler = suite.getHandlerFor(ResilienceHandler)!
      spyPong = vi.spyOn(handler, 'pong')

      expectConnected()
    })

    test('Service should recover after a while when connection is closed with error', async () => {
      let msg = `foo_after_connection_recovered_via_reconnect_retries_${v4()}`
      await vi.waitFor(async () => {
        const connectionNames = await rabbit.adminGetConnectionNames()
        expect(connectionNames.length).toBeGreaterThan(0)
      }, 10000)

      await testConnectionViaMessage(`${msg}_initial`)
      spyPong.mockReset()

      // change user's password and kill the connection
      // so that recoonecting will fail
      await rabbit.adminUpsertUser(testCredentials.username, v4())
      await rabbit.adminCloseAllConnections()

      // Publish now but not wait.
      // Requesting a channel during reconnect flow should
      // wait until conneciton is re-established and then
      // work correctly.
      msg = `foo_after_connection_recovered_via_reconnect_retries_${v4()}`
      const pendingPublish = (async () => {
        await publish.getPublisher(Ping)({ msg })
      })()

      const approxMidReconnectTry = reconnectInterval * 2 + 5

      setTimeout(() => {
        // change password back to the one used by current connection
        rabbit.adminUpsertUser(
          testCredentials.username,
          testCredentials.password,
        )
      }, approxMidReconnectTry)

      await vi.waitFor(
        async () => {
          const connectionNames = await rabbit.adminGetConnectionNames()
          expect(connectionNames.length).toBeGreaterThan(0)
          expectConnected()
        },
        {
          timeout:
            reconnectInterval * reconnectTries + RABBIT_ADMIN_REFRESH_DELAY,
          interval: reconnectInterval / 2,
        },
      )

      await pendingPublish
      await vi.waitFor(() => {
        expect(spyPong).toHaveBeenCalledWith({ msg }, expect.anything())
      }, 20000)
    }, 20000)

    test('Service should NOT recover after maximum reconnect tries', async () => {
      const msg = `foo_after_connection_should_not_recover_${v4()}`
      await vi.waitFor(async () => {
        const connectionNames = await rabbit.adminGetConnectionNames()
        expect(connectionNames.length).toBeGreaterThan(0)
      }, 10000)

      await testConnectionViaMessage(`${msg}_initial`)

      // change user's password and kill the connection
      // so that recoonecting will fail
      await rabbit.adminUpsertUser(testCredentials.username, v4())
      await rabbit.adminCloseAllConnections()

      await vi.waitFor(async () => {
        const connectionNames = await rabbit.adminGetConnectionNames()
        expect(connectionNames.length).toBe(0)
      })

      await expect(publish.getPublisher(Ping)({ msg })).rejects.toThrow(
        'ERR_IRIS_CONNECTION_NOT_ESTABLISHED',
      )
    }, 10000)
  })
})
