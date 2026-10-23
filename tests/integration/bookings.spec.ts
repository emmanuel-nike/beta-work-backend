import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import BookingStatus from '#enums/booking_status'
import UserRole from '#enums/user_role'
import User from '#models/user'
import { createArtisan, createBooking, createUser } from '#tests/helpers'

test.group('Bookings API', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('GET /bookings requires authentication', async ({ client }) => {
    const response = await client.get('/api/v1/bookings')
    response.assertStatus(401)
  })

  test('GET /bookings returns the authenticated client bookings with an artisan summary', async ({
    client,
    assert,
  }) => {
    const customer = await createUser({ role: UserRole.USER })
    const { user: artisan } = await createArtisan({ trade: 'Electrician' })
    await createBooking({
      client: customer,
      artisan,
      trade: 'Electrician',
      service: 'Rewiring',
    })

    const token = await issueToken(customer)
    const response = await client.get('/api/v1/bookings').bearerToken(token)

    response.assertStatus(200)
    const bookings = response.body().data
    assert.lengthOf(bookings, 1)
    assert.equal(bookings[0].service, 'Rewiring')
    assert.equal(bookings[0].artisan.id, artisan.id)
    assert.equal(bookings[0].artisan.trade, 'Electrician')
    // A distance is always surfaced (placeholder until coordinates exist).
    assert.isNumber(bookings[0].artisan.distanceKm)
    assert.isAbove(bookings[0].artisan.distanceKm, 0)
  })

  test('GET /bookings filters by status', async ({ client, assert }) => {
    const customer = await createUser({ role: UserRole.USER })
    await createBooking({ client: customer, status: BookingStatus.PENDING, service: 'Pending job' })
    await createBooking({
      client: customer,
      status: BookingStatus.COMPLETED,
      service: 'Completed job',
    })

    const token = await issueToken(customer)
    const response = await client
      .get('/api/v1/bookings')
      .qs({ status: BookingStatus.COMPLETED })
      .bearerToken(token)

    response.assertStatus(200)
    const bookings = response.body().data
    assert.lengthOf(bookings, 1)
    assert.equal(bookings[0].status, BookingStatus.COMPLETED)
  })

  test('GET /bookings never returns another client bookings', async ({ client, assert }) => {
    const owner = await createUser({ role: UserRole.USER })
    const otherCustomer = await createUser({ role: UserRole.USER })
    await createBooking({ client: otherCustomer, service: 'Not mine' })

    const token = await issueToken(owner)
    const response = await client.get('/api/v1/bookings').bearerToken(token)

    response.assertStatus(200)
    assert.lengthOf(response.body().data, 0)
  })
})

async function issueToken(user: User) {
  const token = await User.accessTokens.create(user)
  return token.value!.release()
}
