import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import UserRole from '#enums/user_role'
import User from '#models/user'
import { createUser } from '#tests/helpers'

function addressPayload(overrides: Record<string, unknown> = {}) {
  return {
    address: '12 Allen Avenue, Ikeja, Lagos, Nigeria',
    line1: '12 Allen Avenue',
    city: 'Ikeja',
    state: 'Lagos',
    latitude: 6.6018,
    longitude: 3.3515,
    ...overrides,
  }
}

test.group('Addresses API', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('GET /addresses requires authentication', async ({ client }) => {
    const response = await client.get('/api/v1/addresses')
    response.assertStatus(401)
  })

  test('GET /addresses is empty for a new user', async ({ client, assert }) => {
    const user = await createUser({ role: UserRole.USER })
    const token = await issueToken(user)

    const response = await client.get('/api/v1/addresses').bearerToken(token)
    response.assertStatus(200)
    assert.lengthOf(response.body().data, 0)
  })

  test('POST /addresses saves an address and returns the recent list', async ({
    client,
    assert,
  }) => {
    const user = await createUser({ role: UserRole.USER })
    const token = await issueToken(user)

    const response = await client
      .post('/api/v1/addresses')
      .json(addressPayload())
      .bearerToken(token)

    response.assertStatus(201)
    const data = response.body().data
    assert.lengthOf(data, 1)
    assert.equal(data[0].city, 'Ikeja')
    assert.equal(data[0].state, 'Lagos')
    assert.equal(data[0].latitude, 6.6018)
  })

  test('re-saving the same address does not duplicate it', async ({ client, assert }) => {
    const user = await createUser({ role: UserRole.USER })
    const token = await issueToken(user)

    await client.post('/api/v1/addresses').json(addressPayload()).bearerToken(token)
    const response = await client
      .post('/api/v1/addresses')
      .json(addressPayload())
      .bearerToken(token)

    response.assertStatus(201)
    assert.lengthOf(response.body().data, 1)
  })

  test('the recent list is capped at 10, newest first', async ({ client, assert }) => {
    const user = await createUser({ role: UserRole.USER })
    const token = await issueToken(user)

    for (let i = 1; i <= 12; i++) {
      await client
        .post('/api/v1/addresses')
        .json(addressPayload({ address: `${i} Test Road, Ikeja, Lagos`, line1: `${i} Test Road` }))
        .bearerToken(token)
    }

    const response = await client.get('/api/v1/addresses').bearerToken(token)
    response.assertStatus(200)
    const data = response.body().data
    assert.lengthOf(data, 10)
    // Newest first: the last one saved is at the top.
    assert.equal(data[0].address, '12 Test Road, Ikeja, Lagos')
  })

  test('addresses are kept separate per scope', async ({ client, assert }) => {
    const user = await createUser({ role: UserRole.USER })
    const token = await issueToken(user)

    await client
      .post('/api/v1/addresses')
      .json(addressPayload({ scope: 'client', address: 'Client Rd, Ikeja, Lagos' }))
      .bearerToken(token)
    await client
      .post('/api/v1/addresses')
      .json(addressPayload({ scope: 'artisan', address: 'Artisan Rd, Ikeja, Lagos' }))
      .bearerToken(token)

    const clientList = await client
      .get('/api/v1/addresses')
      .qs({ scope: 'client' })
      .bearerToken(token)
    clientList.assertStatus(200)
    assert.lengthOf(clientList.body().data, 1)
    assert.equal(clientList.body().data[0].address, 'Client Rd, Ikeja, Lagos')

    const artisanList = await client
      .get('/api/v1/addresses')
      .qs({ scope: 'artisan' })
      .bearerToken(token)
    assert.lengthOf(artisanList.body().data, 1)
    assert.equal(artisanList.body().data[0].address, 'Artisan Rd, Ikeja, Lagos')
  })
})

async function issueToken(user: User) {
  const token = await User.accessTokens.create(user)
  return token.value!.release()
}
