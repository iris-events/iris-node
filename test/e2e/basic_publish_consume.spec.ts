import { IsNumber, IsString } from 'class-validator'
import { ExchangeType, Message, MessageHandler, publish } from '../../src'
import { irisTesting } from '../setup'

@Message({ name: 'foo' })
class Foo {
  @IsString() name!: string
}

@Message({ name: 'bar', exchangeType: ExchangeType.direct })
class Bar {
  @IsNumber() age!: number
}

@Message({ name: 'car' })
class Car {
  @IsString() car!: string
  @IsNumber() carSize!: number
}

class Handler {
  @MessageHandler()
  async handleFoo(_evt: Foo): Promise<void> {}

  @MessageHandler()
  async handleBar(_evt: Bar): Promise<void> {}

  @MessageHandler()
  async handleCar(_evt: Car): Promise<void> {}
}

describe('Publish and Consume events', () => {
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

  test('Each handler should receive its own events', async () => {
    const spyFoo = vi.spyOn(handler, 'handleFoo')
    const spyBar = vi.spyOn(handler, 'handleBar')
    const spyCar = vi.spyOn(handler, 'handleCar')

    await publish.getPublisher(Foo)({ name: 'foo_evt' })
    await publish.getPublisher(Foo)({ name: 'foo_evt2' })

    await publish.getPublisher(Bar)({ age: -41 })

    await publish.getPublisher(Car)({ car: 'car1', carSize: 1 })
    await publish.getPublisher(Car)({ car: 'car2', carSize: 2 })

    await vi.waitFor(() => {
      expect(spyFoo).toHaveBeenCalledTimes(2)
      expect(spyFoo).toHaveBeenNthCalledWith(1, { name: 'foo_evt' })
      expect(spyFoo).toHaveBeenNthCalledWith(2, { name: 'foo_evt2' })

      expect(spyBar).toHaveBeenCalledTimes(1)
      expect(spyBar).toHaveBeenNthCalledWith(1, { age: -41 })

      expect(spyCar).toHaveBeenCalledTimes(2)
      expect(spyCar).toHaveBeenNthCalledWith(1, { car: 'car1', carSize: 1 })
      expect(spyCar).toHaveBeenNthCalledWith(2, { car: 'car2', carSize: 2 })
    })
  })
})
