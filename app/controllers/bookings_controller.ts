import type { HttpContext } from '@adonisjs/core/http'
import BookingStatus from '#enums/booking_status'
import Booking from '#models/booking'
import User from '#models/user'
import ArtisanLocationService, { type Coordinates } from '#services/artisan_location_service'

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
        id: booking.artisanId,
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
