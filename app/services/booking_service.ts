import { DateTime } from 'luxon'
import BookingStatus from '#enums/booking_status'
import VerificationStatus from '#enums/verification_status'
import ArtisanProfile from '#models/artisan_profile'
import Booking from '#models/booking'
import User from '#models/user'
import BookingException from '#exceptions/booking_exception'

const BOOKING_STATUSES = Object.values(BookingStatus) as string[]

/** Fields a client supplies to request a new booking. */
export interface CreateBookingInput {
  artisanProfileId: number
  service: string
  jobDescription: string
  scheduledAt?: string | null
  budget?: number | null
  languages?: string | null
  messageToArtisan?: string | null
  location?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
}

/** Editable fields of a booking; every field is optional. */
export interface UpdateBookingInput {
  service?: string
  jobDescription?: string
  scheduledAt?: string | null
  budget?: number | null
  languages?: string | null
  messageToArtisan?: string | null
  location?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
}

/**
 * Owns the booking domain rules — resolving the artisan, enforcing who may
 * create/edit a booking, and parsing scheduling — so the controller is left
 * with request parsing and response serialization. Errors are raised as
 * {@link BookingException}, which carries the HTTP status.
 */
export default class BookingService {
  /** The authenticated client's bookings, newest scheduled first. */
  static listForClient(client: User, status?: string | null): Promise<Booking[]> {
    const query = Booking.query()
      .where('clientId', client.id)
      .preload('artisan', (artisanQuery) => artisanQuery.preload('artisanProfile'))
      .orderBy('scheduledAt', 'desc')
      .orderBy('createdAt', 'desc')

    if (status && BOOKING_STATUSES.includes(status)) {
      query.where('status', status)
    }

    return query
  }

  /** Bookings assigned to the authenticated artisan, newest scheduled first. */
  static listForArtisan(artisan: User): Promise<Booking[]> {
    return Booking.query()
      .where('artisanId', artisan.id)
      .preload('client')
      .orderBy('scheduledAt', 'desc')
      .orderBy('createdAt', 'desc')
  }

  /** A single booking assigned to the artisan, or null. */
  static findForArtisan(artisan: User, id: string | number): Promise<Booking | null> {
    return Booking.query().where('id', id).where('artisanId', artisan.id).preload('client').first()
  }

  /** A single booking the client owns, or null. */
  static findForClient(client: User, id: string | number): Promise<Booking | null> {
    return Booking.query()
      .where('id', id)
      .where('clientId', client.id)
      .preload('artisan', (artisanQuery) => artisanQuery.preload('artisanProfile'))
      .first()
  }

  /**
   * Create a pending booking for the client against an approved artisan. The
   * artisan is resolved from the public profile id and the trade is derived
   * from the profile.
   */
  static async createForClient(client: User, input: CreateBookingInput): Promise<Booking> {
    const profile = await ArtisanProfile.query()
      .where('id', input.artisanProfileId)
      .preload('user')
      .first()

    if (!profile || profile.verificationStatus !== VerificationStatus.APPROVED) {
      throw new BookingException('Artisan not found', 404)
    }

    if (profile.userId === client.id) {
      throw new BookingException('You cannot book yourself', 400)
    }

    const booking = await Booking.create({
      clientId: client.id,
      artisanId: profile.userId,
      status: BookingStatus.PENDING,
      trade: profile.trade,
      service: input.service,
      jobDescription: input.jobDescription,
      budget: input.budget ?? null,
      languages: input.languages ?? null,
      messageToArtisan: input.messageToArtisan ?? null,
      scheduledAt: this.parseScheduledAt(input.scheduledAt),
      location: input.location ?? null,
      address: input.address ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      awaitingConfirmation: false,
    })

    await booking.load('artisan', (artisanQuery) => artisanQuery.preload('artisanProfile'))
    return booking
  }

  /**
   * Edit a booking the client owns. Only pending bookings (not yet accepted by
   * the artisan) may be changed; the artisan cannot be reassigned.
   */
  static async updateForClient(
    client: User,
    id: string | number,
    input: UpdateBookingInput
  ): Promise<Booking> {
    const booking = await this.findForClient(client, id)

    if (!booking) {
      throw new BookingException('Booking not found', 404)
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new BookingException('Only pending bookings can be edited', 400)
    }

    if (input.scheduledAt !== undefined) {
      booking.scheduledAt = this.parseScheduledAt(input.scheduledAt)
    }
    if (input.service !== undefined) {
      booking.service = input.service
    }
    if (input.jobDescription !== undefined) {
      booking.jobDescription = input.jobDescription
    }
    if (input.budget !== undefined) {
      booking.budget = input.budget
    }
    if (input.languages !== undefined) {
      booking.languages = input.languages
    }
    if (input.messageToArtisan !== undefined) {
      booking.messageToArtisan = input.messageToArtisan
    }
    if (input.location !== undefined) {
      booking.location = input.location
    }
    if (input.address !== undefined) {
      booking.address = input.address
    }
    if (input.latitude !== undefined) {
      booking.latitude = input.latitude
    }
    if (input.longitude !== undefined) {
      booking.longitude = input.longitude
    }

    await booking.save()
    return booking
  }

  /** Parse an optional ISO slot time, raising a 422 on a malformed value. */
  private static parseScheduledAt(value?: string | null): DateTime | null {
    if (!value) {
      return null
    }
    const scheduledAt = DateTime.fromISO(value)
    if (!scheduledAt.isValid) {
      throw new BookingException('Invalid scheduled date', 422)
    }
    return scheduledAt
  }
}
