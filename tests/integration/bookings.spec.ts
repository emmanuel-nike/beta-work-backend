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
    const { user: artisan, profile } = await createArtisan({ trade: 'Electrician' })
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
    // The public profile id the client books against, not the owning user id.
    assert.equal(bookings[0].artisan.id, profile.id)
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

  test('POST /bookings creates a pending booking with a status timeline', async ({
    client,
    assert,
  }) => {
    const customer = await createUser({ role: UserRole.USER })
    const { profile } = await createArtisan({ trade: 'Electrician' })

    const token = await issueToken(customer)
    const response = await client
      .post('/api/v1/bookings')
      .json({
        artisanProfileId: profile.id,
        service: 'Rewiring',
        jobDescription: 'Replace the kitchen wiring.',
      })
      .bearerToken(token)

    response.assertStatus(201)
    const booking = response.body().booking
    assert.equal(booking.status, BookingStatus.PENDING)
    assert.equal(booking.service, 'Rewiring')
    // Timeline: request sent is done; reviewing is pending (reached, awaiting
    // the artisan); later stages are inactive (not reached).
    assert.lengthOf(booking.timeline, 5)
    assert.equal(booking.timeline[0].key, 'request-sent')
    assert.equal(booking.timeline[0].state, 'done')
    assert.equal(booking.timeline[1].state, 'pending')
    assert.equal(booking.timeline[2].state, 'inactive')
    // Each step carries the booking's createdAt and its last-updated time (at).
    for (const step of booking.timeline) {
      assert.equal(step.createdAt, booking.createdAt)
      assert.isString(step.at)
    }
  })

  test('POST /bookings stores and returns the service location coordinates', async ({
    client,
    assert,
  }) => {
    const customer = await createUser({ role: UserRole.USER })
    const { profile } = await createArtisan({ trade: 'Electrician' })

    const token = await issueToken(customer)
    const response = await client
      .post('/api/v1/bookings')
      .json({
        artisanProfileId: profile.id,
        service: 'Rewiring',
        jobDescription: 'Replace the kitchen wiring.',
        location: 'Current location',
        latitude: 6.5244,
        longitude: 3.3792,
      })
      .bearerToken(token)

    response.assertStatus(201)
    const booking = response.body().booking
    assert.equal(booking.latitude, 6.5244)
    assert.equal(booking.longitude, 3.3792)
  })

  test('PATCH /bookings/:id edits a pending booking', async ({ client, assert }) => {
    const customer = await createUser({ role: UserRole.USER })
    const booking = await createBooking({
      client: customer,
      status: BookingStatus.PENDING,
      service: 'Pipe repair',
    })

    const token = await issueToken(customer)
    const response = await client
      .patch(`/api/v1/bookings/${booking.id}`)
      .json({ service: 'Pipe replacement', jobDescription: 'Replace the burst pipe.' })
      .bearerToken(token)

    response.assertStatus(200)
    assert.equal(response.body().booking.service, 'Pipe replacement')
    assert.equal(response.body().booking.jobDescription, 'Replace the burst pipe.')
  })

  test('PATCH /bookings/:id rejects editing a non-pending booking', async ({ client, assert }) => {
    const customer = await createUser({ role: UserRole.USER })
    const booking = await createBooking({
      client: customer,
      status: BookingStatus.ACCEPTED,
      service: 'Pipe repair',
    })

    const token = await issueToken(customer)
    const response = await client
      .patch(`/api/v1/bookings/${booking.id}`)
      .json({ service: 'Too late to change' })
      .bearerToken(token)

    response.assertStatus(400)
    await booking.refresh()
    assert.equal(booking.service, 'Pipe repair')
  })

  test('PATCH /bookings/:id cannot edit another client booking', async ({ client }) => {
    const owner = await createUser({ role: UserRole.USER })
    const intruder = await createUser({ role: UserRole.USER })
    const booking = await createBooking({ client: owner, status: BookingStatus.PENDING })

    const token = await issueToken(intruder)
    const response = await client
      .patch(`/api/v1/bookings/${booking.id}`)
      .json({ service: 'Hijack attempt' })
      .bearerToken(token)

    response.assertStatus(404)
  })

  test('timeline reflects a completed booking as fully done', async ({ client, assert }) => {
    const customer = await createUser({ role: UserRole.USER })
    await createBooking({ client: customer, status: BookingStatus.COMPLETED })

    const token = await issueToken(customer)
    const response = await client.get('/api/v1/bookings').bearerToken(token)

    response.assertStatus(200)
    const timeline = response.body().data[0].timeline
    assert.isTrue(timeline.every((step: { state: string }) => step.state === 'done'))
  })
})

async function issueToken(user: User) {
  const token = await User.accessTokens.create(user)
  return token.value!.release()
}
