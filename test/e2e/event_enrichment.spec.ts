import { Type } from 'class-transformer'
import {
  IsDate,
  IsInstance,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator'
import { AmqpMessage, Message, MessageHandler, publish } from '../../src'
import { irisTesting } from '../setup'

@Message({ name: 'event-one' })
class EvtBase {
  @IsNumber() @IsOptional() idx?: number
  @IsString({ each: true }) callStack!: string[]
}

@Message({ name: 'event-two' })
class EvtTwo extends EvtBase {}

@Message({ name: 'event-three' })
class EvtThree extends EvtBase {}

@Message({ name: 'collected-evts' }, { classTransform: {} })
class EvtCollected {
  @IsInstance(EvtBase) @Type(() => EvtBase) collectedEvents!: EvtBase
}

@Message({ name: 'end-result' })
class EvtResult {
  @IsInstance(EvtCollected) @Type(() => EvtCollected) collected!: EvtCollected
  @IsDate() @Type(() => Date) timestamp!: Date
}

class Handler {
  static timestamp: Date = new Date()
  static statiCallstackTag = 'static-access-works'

  @MessageHandler({}, EvtTwo)
  static handleOne(evt: EvtBase): EvtTwo {
    return Handler.enrich(evt, Handler.statiCallstackTag)
  }

  @MessageHandler()
  handleTwo(evt: EvtTwo, msg: AmqpMessage): void {
    setTimeout(() => {
      publish
        .publishReply(msg, EvtThree, this.enrich(evt, 'two'), {
          amqpPublishOpts: { headers: { 'handler-two': 'additional header' } },
        })
        .catch((e) => {
          throw e
        })
    }, 1000)
  }

  @MessageHandler({}, EvtCollected)
  handleThree(evt: EvtThree): EvtCollected {
    return {
      collectedEvents: this.enrich(evt, 'three'),
    }
  }

  @MessageHandler({}, EvtResult)
  static async handleCollected(evt: EvtCollected): Promise<EvtResult> {
    return new Promise((resolve) => {
      setTimeout(() => {
        evt.collectedEvents.callStack.push('final')
        resolve({
          collected: evt,
          // static method should also be properly bound to class
          timestamp: Handler.timestamp,
        })
      }, 340)
    })
  }

  @MessageHandler()
  handleEvtResult(_evt: EvtResult, _amqp: AmqpMessage) {}

  private enrich(evt: EvtBase, tag: string): EvtBase {
    return Handler.enrich(evt, tag)
  }
  private static enrich(evt: EvtBase, tag: string): EvtBase {
    return {
      ...evt,
      callStack: [...evt.callStack, tag],
      idx: (evt.idx ?? 0) + 1,
    }
  }
}

describe('Event Enrichment using reply mechanism', () => {
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

  test('Event propagation through multiple handlers', async () => {
    const spyResult = vi.spyOn(handler, 'handleEvtResult')

    await publish.getPublisher(EvtBase)(
      { callStack: ['snowball'] },
      {
        amqpPublishOpts: {
          headers: {
            'my-foo-header': 'should be propagated',
          },
        },
      },
    )

    await vi.waitFor(() => {
      expect(spyResult).toHaveBeenCalledOnce()
      expect(
        JSON.parse(JSON.stringify(spyResult.mock.calls[0][0])),
      ).toMatchObject({
        collected: {
          collectedEvents: {
            callStack: [
              'snowball',
              Handler.statiCallstackTag,
              'two',
              'three',
              'final',
            ],
            idx: 3,
          },
        },
        timestamp: Handler.timestamp.toISOString(),
      })
      expect(spyResult.mock.calls[0][1]).toMatchObject({
        properties: {
          headers: {
            'my-foo-header': 'should be propagated',
            'handler-two': 'additional header',
          },
        },
      })
    }, 3000)
  })
})
