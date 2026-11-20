import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import UserRole from '#enums/user_role'
import DeviceToken from '#models/device_token'
import User from '#models/user'
import { createUser } from '#tests/helpers'

test.group('Devices API', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('POST /devices requires authentication', async ({ client }) => {
    const response = await client.post('/api/v1/devices').json({ token: 'abc' })
    response.assertStatus(401)
  })

  test('POST /devices registers a device token for the caller', async ({ client, assert }) => {
    const user = await createUser({ role: UserRole.USER })
    const token = await issueToken(user)

    const response = await client
      .post('/api/v1/devices')
      .json({ token: 'fcm-token-1', platform: 'ios' })
      .bearerToken(token)

    response.assertStatus(200)
    const devices = await DeviceToken.query().where('userId', user.id)
    assert.lengthOf(devices, 1)
    assert.equal(devices[0].token, 'fcm-token-1')
    assert.equal(devices[0].platform, 'ios')
  })

  test('POST /devices is idempotent and reassigns a token to the latest user', async ({
    client,
    assert,
  }) => {
    const first = await createUser({ role: UserRole.USER })
    const second = await createUser({ role: UserRole.USER })

    await client
      .post('/api/v1/devices')
      .json({ token: 'shared-token', platform: 'android' })
      .bearerToken(await issueToken(first))

    // The same physical device now signs in as another user.
    await client
      .post('/api/v1/devices')
      .json({ token: 'shared-token', platform: 'android' })
      .bearerToken(await issueToken(second))

    const rows = await DeviceToken.query().where('token', 'shared-token')
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].userId, second.id)
  })

  test('POST /devices rejects an empty token', async ({ client }) => {
    const user = await createUser({ role: UserRole.USER })
    const response = await client
      .post('/api/v1/devices')
      .json({ token: '' })
      .bearerToken(await issueToken(user))

    response.assertStatus(422)
  })

  test('DELETE /devices/:token removes the caller token', async ({ client, assert }) => {
    const user = await createUser({ role: UserRole.USER })
    await DeviceToken.create({ userId: user.id, token: 'to-remove', platform: 'ios' })

    const response = await client
      .delete('/api/v1/devices/to-remove')
      .bearerToken(await issueToken(user))

    response.assertStatus(204)
    const rows = await DeviceToken.query().where('token', 'to-remove')
    assert.lengthOf(rows, 0)
  })

  test('DELETE /devices/:token never removes another user token', async ({ client, assert }) => {
    const owner = await createUser({ role: UserRole.USER })
    const intruder = await createUser({ role: UserRole.USER })
    await DeviceToken.create({ userId: owner.id, token: 'owned', platform: 'ios' })

    const response = await client
      .delete('/api/v1/devices/owned')
      .bearerToken(await issueToken(intruder))

    response.assertStatus(204)
    const rows = await DeviceToken.query().where('token', 'owned')
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].userId, owner.id)
  })
})

async function issueToken(user: User) {
  const token = await User.accessTokens.create(user)
  return token.value!.release()
}
