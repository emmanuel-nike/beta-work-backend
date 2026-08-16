import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import UserRole from '#enums/user_role'
import User from '#models/user'
import { createUser, uniqueDigits, uniqueEmail, uniquePhone } from '#tests/helpers'

test.group('Auth API', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('GET / returns API metadata', async ({ client }) => {
    const response = await client.get('/')

    response.assertStatus(200)
    response.assertBodyContains({
      name: 'BetaWork API',
      version: '1.0.0',
    })
  })

  test('POST /auth/validate accepts valid registration details', async ({ client }) => {
    const payload = {
      firstName: 'Ada',
      lastName: 'Okeke',
      email: uniqueEmail('validate'),
      phoneNumber: uniquePhone(),
      city: 'Lagos',
      state: 'Lagos',
      address: '12 Example Street',
    }

    const response = await client.post('/api/v1/auth/validate').json(payload)

    response.assertStatus(200)
    response.assertBodyContains({
      message: 'User information is valid',
      data: {
        email: payload.email,
        phoneNumber: payload.phoneNumber,
      },
    })
  })

  test('POST /auth/otp/send and verify succeed', async ({ client }) => {
    const phoneNumber = uniquePhone()

    const sendResponse = await client.post('/api/v1/auth/otp/send').json({ phoneNumber })
    sendResponse.assertStatus(200)
    sendResponse.assertBodyContains({ message: 'OTP sent successfully', phoneNumber })

    const otp = sendResponse.body().otp as string

    const verifyResponse = await client.post('/api/v1/auth/otp/verify').json({ phoneNumber, otp })
    verifyResponse.assertStatus(200)
    verifyResponse.assertBodyContains({
      message: 'Phone number verified successfully',
      verified: true,
    })
  })

  test('POST /auth/otp/verify rejects invalid otp', async ({ client }) => {
    const phoneNumber = uniquePhone()
    await client.post('/api/v1/auth/otp/send').json({ phoneNumber })

    const response = await client.post('/api/v1/auth/otp/verify').json({
      phoneNumber,
      otp: '000000',
    })

    response.assertStatus(422)
    response.assertBodyContains({ message: 'Invalid or expired OTP' })
  })

  test('POST /auth/register creates a normal user and returns a token', async ({ client }) => {
    const email = uniqueEmail('register')
    const phoneNumber = uniquePhone()

    const response = await client.post('/api/v1/auth/register').json({
      firstName: 'Ada',
      lastName: 'Okeke',
      email,
      phoneNumber,
      password: 'password123',
      city: 'Lagos',
      state: 'Lagos',
      address: '12 Example Street',
      role: UserRole.USER,
    })

    response.assertStatus(201)
    response.assertBodyContains({
      type: 'bearer',
      user: {
        email,
        role: UserRole.USER,
      },
    })
  })

  test('POST /auth/login returns a bearer token', async ({ client }) => {
    const email = uniqueEmail('login')
    const password = 'password123'
    await createUser({ email, password, role: UserRole.USER })

    const response = await client.post('/api/v1/auth/login').json({ email, password })

    response.assertStatus(200)
    response.assertBodyContains({
      type: 'bearer',
      user: { email },
    })
  })

  test('GET /auth/me requires authentication', async ({ client }) => {
    const response = await client.get('/api/v1/auth/me')
    response.assertStatus(401)
  })

  test('GET /auth/me returns the authenticated user', async ({ client }) => {
    const user = await createUser({ role: UserRole.USER })
    const token = await User.accessTokens.create(user)

    const response = await client.get('/api/v1/auth/me').bearerToken(token.value!.release())

    response.assertStatus(200)
    response.assertBodyContains({
      user: {
        id: user.id,
        email: user.email,
      },
    })
  })

  test('POST /auth/validate/identity validates nin/bvn and stores photo', async ({
    client,
    assert,
  }) => {
    const nin = uniqueDigits(11)
    const bvn = uniqueDigits(11)

    const response = await client
      .post('/api/v1/auth/validate/identity')
      .field('nin', nin)
      .field('bvn', bvn)
      .file('photo', 'tests/fixtures/photo.jpg', {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      })

    response.assertStatus(200)
    response.assertBodyContains({
      verified: true,
      data: { nin, bvn },
    })
    assert.match(response.body().data.photoUrl, /^\/api\/v1\/uploads\/artisans\//)
  })
})
