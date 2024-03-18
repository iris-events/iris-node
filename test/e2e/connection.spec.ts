import { ConnectionConfigI, connection } from '../../src'
import '../setup'

const urlOrOpts = <string>process.env.AMQP_URL

describe('Connection', () => {
  afterEach(async () => {
    await connection.disconnect()
  })

  test('Call to disconnect will wait until connected if needed, before disconnecting', async () => {
    const connCfg: ConnectionConfigI = { urlOrOpts }

    await Promise.all([
      connection.connect(connCfg),
      connection.connect(connCfg),
      connection.connect(connCfg),
      connection.connect(connCfg),
      connection.disconnect(),
      connection.disconnect(),
      connection.connect(connCfg),
      connection.connect(connCfg),
    ])

    expect(connection.getConnection()).toBeUndefined()

    // should just ignore if already disconnected
    await connection.disconnect()
  })

  test('Call to connect will wait until disconnected if needed, before connecting', async () => {
    const connCfg: ConnectionConfigI = { urlOrOpts }
    await connection.connect(connCfg)

    await Promise.all([
      connection.disconnect(),
      connection.disconnect(),
      connection.disconnect(),
      connection.connect(connCfg),
      connection.connect(connCfg),
      connection.disconnect(),
      connection.disconnect(),
    ])

    expect(connection.getConnection()).toBeDefined()

    // should just ignore if already connected
    await connection.connect(connCfg)
  })

  test('assureChannel() will wait until connected if needed', async () => {
    const connCfg: ConnectionConfigI = { urlOrOpts }
    connection.connect(connCfg)

    expect(connection.getConnection()).toBeUndefined()
    await expect(connection.assureChannel('foo')).resolves.toHaveProperty(
      'assertQueue',
    )
  })
})
