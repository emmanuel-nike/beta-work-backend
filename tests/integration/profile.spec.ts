import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import UserRole from '#enums/user_role'
import User from '#models/user'
import { createUser, uniqueEmail, uniquePhone } from '#tests/helpers'

async function tokenFor(user: User) {
  const token = await User.accessTokens.create(user)
  return token.value!.release()
}

test.group('Profile API - update profile', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('PUT /auth/me requires authentication', async ({ client }) => {
    const response = await client.put('/api/v1/auth/me').json({ firstName: 'Nope' })
    response.assertStatus(401)
  })

  test('PUT /auth/me updates the authenticated user profile', async ({ client, assert }) => {
    const user = await createUser({ role: UserRole.USER })
    const token = await tokenFor(user)

    const payload = {
      firstName: 'Updated',
      lastName: 'Name',
      email: uniqueEmail('updated'),
      phoneNumber: uniquePhone(),
      address: '99 New Road, Abuja',
    }

    const response = await client.put('/api/v1/auth/me').json(payload).bearerToken(token)

    response.assertStatus(200)
    response.assertBodyContains({
      user: {
        id: user.id,
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phoneNumber: payload.phoneNumber,
        address: payload.address,
      },
    })

    const refreshed = await User.findOrFail(user.id)
    assert.equal(refreshed.firstName, payload.firstName)
    assert.equal(refreshed.email, payload.email)
    assert.equal(refreshed.phoneNumber, payload.phoneNumber)
    assert.equal(refreshed.address, payload.address)
  })

  test('PUT /auth/me allows a partial update', async ({ client, assert }) => {
    const user = await createUser({ role: UserRole.USER, firstName: 'Original' })
    const originalEmail = user.email
    const token = await tokenFor(user)

    const response = await client
      .put('/api/v1/auth/me')
      .json({ firstName: 'Renamed' })
      .bearerToken(token)

    response.assertStatus(200)

    const refreshed = await User.findOrFail(user.id)
    assert.equal(refreshed.firstName, 'Renamed')
    assert.equal(refreshed.email, originalEmail)
  })

  test('PUT /auth/me keeps the user\'s own email and phone', async ({ client }) => {
    const user = await createUser({ role: UserRole.USER })
    const token = await tokenFor(user)

    const response = await client
      .put('/api/v1/auth/me')
      .json({ email: user.email, phoneNumber: user.phoneNumber, firstName: 'Same' })
      .bearerToken(token)

    response.assertStatus(200)
    response.assertBodyContains({ user: { firstName: 'Same', email: user.email } })
  })

  test('PUT /auth/me rejects an email already used by another user', async ({ client }) => {
    const other = await createUser({ role: UserRole.USER, email: uniqueEmail('taken') })
    const user = await createUser({ role: UserRole.USER })
    const token = await tokenFor(user)

    const response = await client
      .put('/api/v1/auth/me')
      .json({ email: other.email })
      .bearerToken(token)

    response.assertStatus(422)
    response.assertBodyContains({ message: 'Email already in use' })
  })

  test('PUT /auth/me rejects a phone already used by another user', async ({ client }) => {
    const other = await createUser({ role: UserRole.USER, phoneNumber: uniquePhone() })
    const user = await createUser({ role: UserRole.USER })
    const token = await tokenFor(user)

    const response = await client
      .put('/api/v1/auth/me')
      .json({ phoneNumber: other.phoneNumber })
      .bearerToken(token)

    response.assertStatus(422)
    response.assertBodyContains({ message: 'Phone number already in use' })
  })

  test('PUT /auth/me rejects an invalid email', async ({ client }) => {
    const user = await createUser({ role: UserRole.USER })
    const token = await tokenFor(user)

    const response = await client
      .put('/api/v1/auth/me')
      .json({ email: 'not-an-email' })
      .bearerToken(token)

    response.assertStatus(422)
  })
})

test.group('Profile API - change password', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('PUT /auth/password requires authentication', async ({ client }) => {
    const response = await client
      .put('/api/v1/auth/password')
      .json({ currentPassword: 'password123', newPassword: 'newpassword456' })
    response.assertStatus(401)
  })

  test('PUT /auth/password changes the password and the new one logs in', async ({ client }) => {
    const email = uniqueEmail('pw')
    const user = await createUser({ email, password: 'password123', role: UserRole.USER })
    const token = await tokenFor(user)

    const response = await client
      .put('/api/v1/auth/password')
      .json({ currentPassword: 'password123', newPassword: 'newpassword456' })
      .bearerToken(token)

    response.assertStatus(200)
    response.assertBodyContains({ message: 'Password updated successfully' })

    const loginNew = await client
      .post('/api/v1/auth/login')
      .json({ email, password: 'newpassword456' })
    loginNew.assertStatus(200)
    loginNew.assertBodyContains({ type: 'bearer', user: { email } })
  })

  test('PUT /auth/password no longer accepts the old password for login', async ({ client }) => {
    const email = uniqueEmail('pw-old')
    const user = await createUser({ email, password: 'password123', role: UserRole.USER })
    const token = await tokenFor(user)

    await client
      .put('/api/v1/auth/password')
      .json({ currentPassword: 'password123', newPassword: 'newpassword456' })
      .bearerToken(token)

    const loginOld = await client
      .post('/api/v1/auth/login')
      .json({ email, password: 'password123' })
    loginOld.assertStatus(400)
  })

  test('PUT /auth/password rejects a wrong current password', async ({ client }) => {
    const user = await createUser({ password: 'password123', role: UserRole.USER })
    const token = await tokenFor(user)

    const response = await client
      .put('/api/v1/auth/password')
      .json({ currentPassword: 'wrongpassword', newPassword: 'newpassword456' })
      .bearerToken(token)

    response.assertStatus(422)
    response.assertBodyContains({ message: 'Current password is incorrect' })
  })

  test('PUT /auth/password rejects a too-short new password', async ({ client }) => {
    const user = await createUser({ password: 'password123', role: UserRole.USER })
    const token = await tokenFor(user)

    const response = await client
      .put('/api/v1/auth/password')
      .json({ currentPassword: 'password123', newPassword: 'short' })
      .bearerToken(token)

    response.assertStatus(422)
  })
})
