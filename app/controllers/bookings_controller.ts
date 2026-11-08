import type { HttpContext } from '@adonisjs/core/http'
import Booking from '#models/booking'
import User from '#models/user'
import ArtisanLocationService, { type Coordinates } from '#services/artisan_location_service'
import BookingService from '#services/booking_service'
import BookingTimelineService from '#services/booking_timeline_service'
import { createBookingValidator, updateBookingValidator } from '#validators/booking'

export default class BookingsController {
  /**
   * List the authenticated client's bookings, newest scheduled first. Supports
   * an optional `?status=` filter matching the booking status enum.
   */
  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const bookings = await BookingService.listForClient(user, request.input('status'))

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
    const booking = await BookingService.createForClient(user, payload)

    return response.created({
      booking: this.serializeBooking(booking, this.originFrom(user)),
    })
  }

  /**
   * List bookings assigned to the authenticated artisan, newest scheduled first.
   * The caller must have the artisan role (enforced on the route).
   */
  async jobs({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const bookings = await BookingService.listForArtisan(user)

    return response.ok({
      data: bookings.map((booking) => this.serializeJob(booking, this.originFrom(user))),
    })
  }

  /**
   * Show a single booking assigned to the authenticated artisan.
   */
  async showJob({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const booking = await BookingService.findForArtisan(user, params.id)

    if (!booking) {
      return response.notFound({ message: 'Job not found' })
    }

    return response.ok({
      job: this.serializeJob(booking, this.originFrom(user)),
    })
  }

  /**
   * Accept a pending job assigned to the authenticated artisan.
   */
  async acceptJob({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const booking = await BookingService.acceptForArtisan(user, params.id)

    return response.ok({
      job: this.serializeJob(booking, this.originFrom(user)),
    })
  }

  /**
   * Decline a pending job assigned to the authenticated artisan. An optional
   * `reason` is stored on the cancellation.
   */
  async declineJob({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const booking = await BookingService.declineForArtisan(user, params.id, request.input('reason'))

    return response.ok({
      job: this.serializeJob(booking, this.originFrom(user)),
    })
  }

  /**
   * Show a single booking the authenticated client owns.
   */
  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const booking = await BookingService.findForClient(user, params.id)

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
    const booking = await BookingService.updateForClient(user, params.id, payload)

    return response.ok({
      booking: this.serializeBooking(booking, this.originFrom(user)),
    })
  }

  /**
   * Mark a booking the authenticated client owns as completed. Only an accepted
   * or ongoing booking can be completed; the client confirms the work is done.
   */
  async complete({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const booking = await BookingService.completeForClient(user, params.id)

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
      latitude: booking.latitude,
      longitude: booking.longitude,
      awaitingConfirmation: booking.awaitingConfirmation,
      cancelledBy: booking.cancelledBy,
      cancellationReason: booking.cancellationReason,
      cancelledAt: booking.cancelledAt?.toISO() ?? null,
      createdAt: booking.createdAt?.toISO() ?? null,
      timeline: BookingTimelineService.build(booking),
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

  /**
   * Shape a booking for the artisan's My Jobs list: the job fields plus a
   * compact client summary and the distance from the artisan to the job.
   */
  private serializeJob(booking: Booking, origin: Coordinates | null) {
    const client = booking.client
    const destination = {
      latitude: booking.latitude ?? client?.latitude ?? null,
      longitude: booking.longitude ?? client?.longitude ?? null,
    }
    const distanceKm = ArtisanLocationService.resolveDistanceKm(
      origin,
      destination,
      booking.clientId
    )

    return {
      id: booking.id,
      status: booking.status,
      trade: booking.trade,
      service: booking.service,
      jobDescription: booking.jobDescription,
      budget: booking.budget,
      messageToArtisan: booking.messageToArtisan,
      scheduledAt: booking.scheduledAt?.toISO() ?? null,
      location: booking.location,
      address: booking.address ?? client?.address ?? null,
      distanceKm,
      client: {
        id: client?.id ?? booking.clientId,
        name: client ? `${client.firstName} ${client.lastName}`.trim() : null,
        phone: client?.phoneNumber ?? null,
        address: booking.address ?? client?.address ?? null,
      },
    }
  }
}
