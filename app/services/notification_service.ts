import transmit from '@adonisjs/transmit/services/main'
import logger from '@adonisjs/core/services/logger'
import Booking from '#models/booking'
import MailerService from '#services/mailer_service'
import PushService from '#services/push_service'

/**
 * The machine-readable event types shared with the mobile client. The client
 * uses these (delivered as the `type` field of a push data payload and SSE
 * message) to decide which part of its state to refetch.
 */
export const NotificationType = {
  BookingRequested: 'booking.requested',
  BookingAccepted: 'booking.accepted',
  BookingDeclined: 'booking.declined',
  BookingCompleted: 'booking.completed',
} as const

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType]

/** Per-user SSE channel. A client subscribes to its own channel only. */
export function userChannel(userId: number): string {
  return `users/${userId}`
}

interface EventPayload {
  type: NotificationType
  bookingId: number
  status: string
}

/**
 * Fans a domain event out to a user across three channels: an FCM push
 * notification, a notification email, and an SSE broadcast for live in-app
 * updates. Every path is best-effort and wrapped so a notification failure can
 * never break the request that triggered it. Call these fire-and-forget (the
 * methods never throw).
 */
export default class NotificationService {
  /** A new booking request reached the artisan. */
  static async bookingRequested(booking: Booking): Promise<void> {
    await this.dispatch(booking, 'artisan', NotificationType.BookingRequested, {
      title: 'New booking request',
      body: (b) => `${this.firstName(b.client)} requested ${b.service}.`,
      heading: 'You have a new booking request',
      message: (b) =>
        `${this.fullName(b.client)} requested "${b.service}". Open the app to accept or decline it.`,
    })
  }

  /** The artisan accepted the client's booking. */
  static async bookingAccepted(booking: Booking): Promise<void> {
    await this.dispatch(booking, 'client', NotificationType.BookingAccepted, {
      title: 'Booking accepted',
      body: (b) => `${this.firstName(b.artisan)} accepted your booking.`,
      heading: 'Your booking was accepted',
      message: (b) =>
        `${this.fullName(b.artisan)} accepted your "${b.service}" booking. You'll be notified as the job progresses.`,
    })
  }

  /** The artisan declined the client's booking. */
  static async bookingDeclined(booking: Booking): Promise<void> {
    await this.dispatch(booking, 'client', NotificationType.BookingDeclined, {
      title: 'Booking declined',
      body: (b) => `${this.firstName(b.artisan)} declined your booking.`,
      heading: 'Your booking was declined',
      message: (b) =>
        `${this.fullName(b.artisan)} declined your "${b.service}" booking. You can book another artisan from the app.`,
    })
  }

  /** The client confirmed the job is complete. */
  static async bookingCompleted(booking: Booking): Promise<void> {
    await this.dispatch(booking, 'artisan', NotificationType.BookingCompleted, {
      title: 'Job completed',
      body: (b) => `${this.firstName(b.client)} marked the job as completed.`,
      heading: 'A job was marked completed',
      message: (b) =>
        `${this.fullName(b.client)} confirmed that "${b.service}" is complete. Nice work!`,
    })
  }

  /**
   * Resolve the recipient, build the three messages and fan them out. SSE and
   * the queued email run inline (both are fast / non-blocking); the FCM call is
   * fired without awaiting so a slow network never delays the request.
   */
  private static async dispatch(
    booking: Booking,
    recipient: 'client' | 'artisan',
    type: NotificationType,
    content: {
      title: string
      body: (booking: Booking) => string
      heading: string
      message: (booking: Booking) => string
    }
  ): Promise<void> {
    try {
      await this.loadParties(booking)
      const user = recipient === 'client' ? booking.client : booking.artisan
      if (!user) {
        return
      }

      const payload: EventPayload = {
        type,
        bookingId: booking.id,
        status: booking.status,
      }

      // Live in-app update for any open client on this user's channel.
      transmit.broadcast(userChannel(user.id), {
        type: payload.type,
        bookingId: payload.bookingId,
        status: payload.status,
      })

      // Background email (queued, best-effort).
      await MailerService.queueNotificationEmail(user.email, content.title, {
        heading: content.heading,
        message: content.message(booking),
      })

      // Push (fire-and-forget so the FCM round-trip never blocks the request).
      void PushService.sendToUser(user.id, {
        title: content.title,
        body: content.body(booking),
        data: {
          type: payload.type,
          bookingId: String(payload.bookingId),
          status: payload.status,
        },
      })
    } catch (error) {
      logger.error({ err: error, bookingId: booking.id, type }, 'Failed to dispatch notification')
    }
  }

  /** Ensure both parties are loaded so names and emails are available. */
  private static async loadParties(booking: Booking): Promise<void> {
    if (!booking.client) {
      await booking.load('client')
    }
    if (!booking.artisan) {
      await booking.load('artisan')
    }
  }

  private static firstName(user: { firstName?: string } | null | undefined): string {
    return user?.firstName?.trim() || 'Someone'
  }

  private static fullName(user: { firstName?: string; lastName?: string } | null | undefined) {
    const name = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
    return name || 'A BetaWork user'
  }
}
