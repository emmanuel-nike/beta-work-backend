import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import BookingStatus from '#enums/booking_status'
import VerificationStatus from '#enums/verification_status'
import Booking from '#models/booking'
import ArtisanProfile from '#models/artisan_profile'
import User from '#models/user'
import ArtisanLocationService, { type Coordinates } from '#services/artisan_location_service'
import { createBookingValidator, updateBookingValidator } from '#validators/booking'

const BOOKING_STATUSES = Object.values(BookingStatus) as string[]

export default class BookingsController {
  /**
   * List the authenticated client's bookings, newest scheduled first. Supports
   * an optional `?status=` filter matching the booking status enum.
   */
  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()

    const query = Booking.query()
      .where('clientId', user.id)
      .preload('artisan', (artisanQuery) => artisanQuery.preload('artisanProfile'))
      .orderBy('scheduledAt', 'desc')
      .orderBy('createdAt', 'desc')

    const status = request.input('status')
    if (status && BOOKING_STATUSES.includes(status)) {
      query.where('status', status)
    }

    const bookings = await query

    const origin = this.originFrom(user)
    return response.ok({
      data: bookings.map((booking) => this.serializeBooking(booking, origin)),
    })
  }

  /**
   * Create a booking request for an approved artisan. The caller is the client;
   * the artisan is resolved from the public profile id, and the booking opens in
   * the `pending` state for the artisan to accept.
   */
  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(createBookingValidator)

    const profile = await ArtisanProfile.query()
      .where('id', payload.artisanProfileId)
      .preload('user')
      .first()

    if (!profile || profile.verificationStatus !== VerificationStatus.APPROVED) {
      return response.notFound({ message: 'Artisan not found' })
    }

    if (profile.userId === user.id) {
      return response.badRequest({ message: 'You cannot book yourself' })
    }

    let scheduledAt: DateTime | null = null
    if (payload.scheduledAt) {
      scheduledAt = DateTime.fromISO(payload.scheduledAt)
      if (!scheduledAt.isValid) {
        return response.unprocessableEntity({ message: 'Invalid scheduled date' })
      }
    }

    const booking = await Booking.create({
      clientId: user.id,
      artisanId: profile.userId,
      status: BookingStatus.PENDING,
      trade: profile.trade,
      service: payload.service,
      jobDescription: payload.jobDescription,
      budget: payload.budget ?? null,
      languages: payload.languages ?? null,
      messageToArtisan: payload.messageToArtisan ?? null,
      scheduledAt,
      location: payload.location ?? null,
      address: payload.address ?? null,
      awaitingConfirmation: false,
    })

    await booking.load('artisan', (artisanQuery) => artisanQuery.preload('artisanProfile'))

    return response.created({
      booking: this.serializeBooking(booking, this.originFrom(user)),
    })
  }

  /**
   * Show a single booking the authenticated client owns.
   */
  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()

    const booking = await Booking.query()
      .where('id', params.id)
      .where('clientId', user.id)
      .preload('artisan', (artisanQuery) => artisanQuery.preload('artisanProfile'))
      .first()

    if (!booking) {
      return response.notFound({ message: 'Booking not found' })
    }

    return response.ok({ booking: this.serializeBooking(booking, this.originFrom(user)) })
  }

  /**
   * Edit a booking the authenticated client owns. Only pending bookings (not yet
   * accepted by the artisan) can be changed; the artisan cannot be reassigned.
   */
  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(updateBookingValidator)

    const booking = await Booking.query()
      .where('id', params.id)
      .where('clientId', user.id)
      .preload('artisan', (artisanQuery) => artisanQuery.preload('artisanProfile'))
      .first()

    if (!booking) {
      return response.notFound({ message: 'Booking not found' })
    }

    if (booking.status !== BookingStatus.PENDING) {
      return response.badRequest({ message: 'Only pending bookings can be edited' })
    }

    if (payload.scheduledAt !== undefined) {
      if (payload.scheduledAt === null) {
        booking.scheduledAt = null
      } else {
        const scheduledAt = DateTime.fromISO(payload.scheduledAt)
        if (!scheduledAt.isValid) {
          return response.unprocessableEntity({ message: 'Invalid scheduled date' })
        }
        booking.scheduledAt = scheduledAt
      }
    }

    if (payload.service !== undefined) {
      booking.service = payload.service
    }
    if (payload.jobDescription !== undefined) {
      booking.jobDescription = payload.jobDescription
    }
    if (payload.budget !== undefined) {
      booking.budget = payload.budget
    }
    if (payload.languages !== undefined) {
      booking.languages = payload.languages
    }
    if (payload.messageToArtisan !== undefined) {
      booking.messageToArtisan = payload.messageToArtisan
    }
    if (payload.location !== undefined) {
      booking.location = payload.location
    }
    if (payload.address !== undefined) {
      booking.address = payload.address
    }

    await booking.save()

    return response.ok({
      booking: this.serializeBooking(booking, this.originFrom(user)),
    })
  }

  private originFrom(user: User): Coordinates | null {
    if (user.latitude === null || user.longitude === null) {
      return null
    }
    return { latitude: user.latitude, longitude: user.longitude }
  }

  /**
   * Shape a booking for the mobile client: the booking fields plus a compact
   * artisan summary (name, trade, photo, rating) and the distance to surface.
   */
  private serializeBooking(booking: Booking, origin: Coordinates | null) {
    const artisan = booking.artisan
    const profile = artisan?.artisanProfile ?? null

    const distanceKm = ArtisanLocationService.resolveDistanceKm(
      origin,
      { latitude: profile?.latitude ?? null, longitude: profile?.longitude ?? null },
      booking.artisanId
    )

    return {
      id: booking.id,
      status: booking.status,
      trade: booking.trade,
      service: booking.service,
      jobDescription: booking.jobDescription,
      budget: booking.budget,
      languages: booking.languages,
      messageToArtisan: booking.messageToArtisan,
      scheduledAt: booking.scheduledAt?.toISO() ?? null,
      location: booking.location,
      address: booking.address,
      awaitingConfirmation: booking.awaitingConfirmation,
      cancelledBy: booking.cancelledBy,
      cancellationReason: booking.cancellationReason,
      cancelledAt: booking.cancelledAt?.toISO() ?? null,
      createdAt: booking.createdAt?.toISO() ?? null,
      artisan: {
        // The public artisan profile id (what the client books against), not
        // the owning user id, so the client can reopen the booking form.
        id: profile?.id ?? booking.artisanId,
        name: artisan ? `${artisan.firstName} ${artisan.lastName}`.trim() : null,
        trade: profile?.trade ?? booking.trade,
        photoUrl: profile?.photoUrl ?? null,
        rating: profile?.rating ?? 0,
        reviewsCount: profile?.reviewsCount ?? 0,
        distanceKm,
      },
    }
  }
}
