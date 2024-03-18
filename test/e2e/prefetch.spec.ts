import { IsString } from 'class-validator'
import { Message, MessageHandler, publish } from '../../src'
import { Pausable } from '../helpers'
import { irisTesting } from '../setup'

@Message({ name: 'ping-1' })
class Ping1 {
  @IsString() msg!: string
}
@Message({ name: 'ping-2' })
class Ping2 {
  @IsString() msg!: string
}
@Message({ name: 'ping-4' })
class Ping4 {
  @IsString() msg!: string
}

class Handler extends Pausable {
  private receivedMessages: string[] = []

  constructor() {
    super()
    this.pause()
  }

  public getReceivedMessages(): string[] {
    return this.receivedMessages
  }

  @MessageHandler({ prefetch: 1 })
  async ping1(evt: Ping1): Promise<void> {
    this.receivedMessages.push(evt.msg)
    await this.paused
  }

  @MessageHandler({ prefetch: 2 })
  async ping2(evt: Ping2): Promise<void> {
    this.receivedMessages.push(evt.msg)
    await this.paused
  }

  @MessageHandler({ prefetch: 4 })
  async ping4(evt: Ping4): Promise<void> {
    this.receivedMessages.push(evt.msg)
    await this.paused
  }
}

describe('Prefetch', () => {
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

  test('Prefetch should only allow specified number of not handled messages being handled at same time', async () => {
    const pub1 = publish.getPublisher(Ping1)
    const pub2 = publish.getPublisher(Ping2)
    const pub4 = publish.getPublisher(Ping4)

    const messages = new Array(10).fill('msg')
    const msgs1 = messages.map((msg) => `${msg}_1`)
    const msgs2 = messages.map((msg) => `${msg}_2`)
    const msgs4 = messages.map((msg) => `${msg}_4`)

    const expectedWhenBlocking = [
      ...msgs1.slice(0, 1),
      ...msgs2.slice(0, 2),
      ...msgs4.slice(0, 4),
    ]
    const expectedWhenBlockingSecondTime = [
      ...msgs1.slice(0, 2),
      ...msgs2.slice(0, 4),
      ...msgs4.slice(0, 8),
    ]
    const expectedWhenUnblocked = [...msgs1, ...msgs2, ...msgs4]

    await Promise.all([
      ...msgs1.map(async (msg) => pub1({ msg })),
      ...msgs2.map(async (msg) => pub2({ msg })),
      ...msgs4.map(async (msg) => pub4({ msg })),
    ])

    await vi.waitFor(() => {
      expect(handler.getReceivedMessages().sort()).toEqual(
        expectedWhenBlocking.sort(),
      )
    })

    handler.resume()
    handler.pause()

    await vi.waitFor(() => {
      expect(handler.getReceivedMessages().sort()).toEqual(
        expectedWhenBlockingSecondTime.sort(),
      )
    })

    handler.resume()

    await vi.waitFor(() => {
      expect(handler.getReceivedMessages().sort()).toEqual(
        expectedWhenUnblocked.sort(),
      )
    })
  })
})
