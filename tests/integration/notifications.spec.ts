import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import BookingStatus from '#enums/booking_status'
import UserRole from '#enums/user_role'
import User from '#models/user'
import { createArtisan, createBooking, createUser } from '#tests/helpers'

/**
 * Covers the notification side effects of booking events. Push is a no-op here
 * (Firebase is unconfigured in tests) and SSE has no subscribers, so these
 * assert the user-facing email that each event queues. The email is queued
 * synchronously within the request, so it is observable right after the call.
 */
test.group('Booking notifications', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a new booking request emails the artisan', async ({ client }) => {
    const mails = mail.fake()
    const customer = await createUser({ role: UserRole.USER })
    const { profile, user: artisan } = await createArtisan({
      user: await createUser({ role: UserRole.ARTISAN, email: 'artisan-req@example.com' }),
    })

    await client
      .post('/api/v1/bookings')
      .json({
        artisanProfileId: profile.id,
        service: 'Rewiring',
        jobDescription: 'Full house rewire',
      })
      .bearerToken(await issueToken(customer))

    mails.messages.assertQueued({ to: artisan.email, subject: 'New booking request' })
    mail.restore()
  })

  test('accepting a booking emails the client', async ({ client }) => {
    const mails = mail.fake()
    const customer = await createUser({ role: UserRole.USER, email: 'client-accept@example.com' })
    const { user: artisan } = await createArtisan()
    const booking = await createBooking({
      client: customer,
      artisan,
      status: BookingStatus.PENDING,
    })

    await client
      .post(`/api/v1/artisan/jobs/${booking.id}/accept`)
      .bearerToken(await issueToken(artisan))

    mails.messages.assertQueued({ to: customer.email, subject: 'Booking accepted' })
    mail.restore()
  })

  test('declining a booking emails the client', async ({ client }) => {
    const mails = mail.fake()
    const customer = await createUser({ role: UserRole.USER, email: 'client-decline@example.com' })
    const { user: artisan } = await createArtisan()
    const booking = await createBooking({
      client: customer,
      artisan,
      status: BookingStatus.PENDING,
    })

    await client
      .post(`/api/v1/artisan/jobs/${booking.id}/decline`)
      .bearerToken(await issueToken(artisan))

    mails.messages.assertQueued({ to: customer.email, subject: 'Booking declined' })
    mail.restore()
  })

  test('completing a booking emails the artisan', async ({ client }) => {
    const mails = mail.fake()
    const customer = await createUser({ role: UserRole.USER })
    const { user: artisan } = await createArtisan({
      user: await createUser({ role: UserRole.ARTISAN, email: 'artisan-complete@example.com' }),
    })
    const booking = await createBooking({
      client: customer,
      artisan,
      status: BookingStatus.ACCEPTED,
    })

    await client
      .post(`/api/v1/bookings/${booking.id}/complete`)
      .bearerToken(await issueToken(customer))

    mails.messages.assertQueued({ to: artisan.email, subject: 'Job completed' })
    mail.restore()
  })
})

async function issueToken(user: User) {
  const token = await User.accessTokens.create(user)
  return token.value!.release()
}
