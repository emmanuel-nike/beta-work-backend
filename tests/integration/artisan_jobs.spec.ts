import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import BookingStatus from '#enums/booking_status'
import UserRole from '#enums/user_role'
import User from '#models/user'
import { createArtisan, createBooking, createUser } from '#tests/helpers'

test.group('Artisan jobs API', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('GET /artisan/jobs requires authentication', async ({ client }) => {
    const response = await client.get('/api/v1/artisan/jobs')
    response.assertStatus(401)
  })

  test('GET /artisan/jobs rejects a non-artisan', async ({ client }) => {
    const customer = await createUser({ role: UserRole.USER })
    const token = await issueToken(customer)

    const response = await client.get('/api/v1/artisan/jobs').bearerToken(token)
    response.assertStatus(403)
  })

  test('GET /artisan/jobs returns bookings assigned to the artisan', async ({ client, assert }) => {
    const { user: artisan } = await createArtisan({ trade: 'Electrician' })
    const customer = await createUser({
      role: UserRole.USER,
      firstName: 'Funke',
      lastName: 'Adebayo',
      phoneNumber: '+2348012345678',
      address: '41 Amino crescent',
    })
    await createBooking({
      client: customer,
      artisan,
      trade: 'Electrician',
      service: 'Rewiring',
      status: BookingStatus.PENDING,
    })

    const token = await issueToken(artisan)
    const response = await client.get('/api/v1/artisan/jobs').bearerToken(token)

    response.assertStatus(200)
    const jobs = response.body().data
    assert.lengthOf(jobs, 1)
    assert.equal(jobs[0].service, 'Rewiring')
    assert.equal(jobs[0].status, BookingStatus.PENDING)
    assert.equal(jobs[0].trade, 'Electrician')
    assert.equal(jobs[0].client.name, 'Funke Adebayo')
    assert.equal(jobs[0].client.phone, '+2348012345678')
    assert.isNumber(jobs[0].distanceKm)
  })

  test('GET /artisan/jobs never returns another artisan jobs', async ({ client, assert }) => {
    const { user: artisan } = await createArtisan()
    const { user: other } = await createArtisan()
    await createBooking({ artisan: other, service: 'Not mine' })

    const token = await issueToken(artisan)
    const response = await client.get('/api/v1/artisan/jobs').bearerToken(token)

    response.assertStatus(200)
    assert.lengthOf(response.body().data, 0)
  })

  test('GET /artisan/jobs/:id returns one assigned job', async ({ client, assert }) => {
    const { user: artisan } = await createArtisan()
    const booking = await createBooking({ artisan, service: 'Pipe repair' })

    const token = await issueToken(artisan)
    const response = await client.get(`/api/v1/artisan/jobs/${booking.id}`).bearerToken(token)

    response.assertStatus(200)
    assert.equal(response.body().job.id, booking.id)
    assert.equal(response.body().job.service, 'Pipe repair')
  })

  test('GET /artisan/jobs/:id hides a job assigned to someone else', async ({ client }) => {
    const { user: artisan } = await createArtisan()
    const { user: other } = await createArtisan()
    const booking = await createBooking({ artisan: other })

    const token = await issueToken(artisan)
    const response = await client.get(`/api/v1/artisan/jobs/${booking.id}`).bearerToken(token)

    response.assertStatus(404)
  })
})

async function issueToken(user: User) {
  const token = await User.accessTokens.create(user)
  return token.value!.release()
}
