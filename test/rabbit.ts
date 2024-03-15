import { v4 } from 'uuid'

const RABBIT_ADMIN_PORT = '15672'
const RABBIT_TEST_USER_PREFIX = 'rtestuser_'

export function getAmqpUrl() {
  return process.env.AMQP_URL!
}

export const adminGetConnectionNames = async (
  amqpUrl = getAmqpUrl(),
): Promise<string[]> => {
  const [url, opts] = getAdminFetchOpts(`${amqpUrl}/api/connections`)
  const res = await (await fetch(url, opts)).json()

  return (<{ name: string }[]>res).map(({ name }) => name)
}

export const adminCloseAllConnections = async () => {
  const connections = await adminGetConnectionNames()

  await Promise.all(connections.map(async (cn) => adminCloseConnection(cn)))
}

export const adminCloseConnection = async (
  connectionName: string,
  amqpUrl = getAmqpUrl(),
) => {
  const [url, opts] = getAdminFetchOpts(
    `${amqpUrl}/api/connections/${encodeURIComponent(connectionName)}`,
  )

  await fetch(url, { ...opts, method: 'DELETE' })
}

export const adminUpsertUser = async (
  user?: string,
  pass?: string,
  amqpUrl = getAmqpUrl(),
): Promise<{ username: string; password: string }> => {
  const username = user ?? `${RABBIT_TEST_USER_PREFIX}${v4()}`
  const usernameParam = encodeURIComponent(username)
  const vhostParam = encodeURIComponent('/')
  const password = pass ?? v4()

  const [url, opts] = getAdminFetchOpts(`${amqpUrl}/api/users/${usernameParam}`)
  await fetch(url, {
    ...opts,
    method: 'PUT',
    body: JSON.stringify({
      username,
      password,
      tags: 'tests',
    }),
  })

  await fetch(`${url.origin}/api/permissions/${vhostParam}/${usernameParam}`, {
    ...opts,
    method: 'PUT',
    body: JSON.stringify({
      username,
      vhost: '/',
      configure: '.*',
      write: '.*',
      read: '.*',
    }),
  })

  return { username, password }
}

export const adminDeleteAllTestUsers = async (
  amqpUrl = getAmqpUrl(),
): Promise<void> => {
  const [url, opts] = getAdminFetchOpts(`${amqpUrl}/api/users`)

  const users = await (await fetch(url, opts)).json()

  await Promise.all(
    (<{ name: string }[]>users)
      .filter(({ name }) => name.startsWith(RABBIT_TEST_USER_PREFIX))
      .map(async ({ name }) => adminDeleteUser(name, amqpUrl)),
  )
}

export const adminDeleteUser = async (
  username: string,
  amqpUrl = getAmqpUrl(),
): Promise<void> => {
  const usernameParam = encodeURIComponent(username)
  const [url, opts] = getAdminFetchOpts(`${amqpUrl}/api/users/${usernameParam}`)

  await fetch(url, { ...opts, method: 'DELETE' })
}

const getAdminFetchOpts = (
  amqpUrl = getAmqpUrl(),
): [URL, Record<string, any>] => {
  const url = new URL(amqpUrl)
  url.port = RABBIT_ADMIN_PORT

  const urlNoCreds = new URL(
    // proto can not be chaned via URL class
    // https://nodejs.org/api/url.html#special-schemes
    url
      .toString()
      .replace('amqps:', 'https:')
      .replace('amqp:', 'http:'),
  )

  urlNoCreds.username = ''
  urlNoCreds.password = ''

  return [urlNoCreds, getBasicAuthHeaders(url.username, url.password)]
}

function getBasicAuthHeaders(username: string, password: string) {
  return {
    headers: {
      Authorization: `Basic ${btoa(`${username}:${password}`)}`,
    },
  }
}
