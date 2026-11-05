import BookingStatus from '#enums/booking_status'
import Booking from '#models/booking'

/**
 * Stage states, from least to most progressed:
 * - `inactive`  — not reached yet
 * - `pending`   — reached, but awaiting activation (e.g. awaiting the artisan)
 * - `active`    — in progress right now
 * - `done`      — completed
 * - `cancelled` — the stage at which the booking was cancelled
 */
export type TimelineState = 'inactive' | 'pending' | 'active' | 'done' | 'cancelled'

/** One stage of the booking progress stepper rendered by the client. */
export interface BookingTimelineStep {
  key: string
  label: string
  state: TimelineState
  detail: string
  /** ISO timestamp for the stage event, when known (else null). */
  at: string | null
}

const STEP_KEYS = [
  'request-sent',
  'artisan-reviewing',
  'job-accepted',
  'job-ongoing',
  'job-completed',
] as const

const STEP_LABELS = [
  'Request sent',
  'Artisan reviewing',
  'Job accepted',
  'Job ongoing',
  'Job completed',
] as const

/**
 * Builds the status timeline for a booking: one entry per stage, each with the
 * state (done / active / pending / cancelled), a label, a short detail line and
 * a timestamp where one exists. The client renders this directly, so the state
 * machine lives here rather than being reconstructed per platform.
 */
export default class BookingTimelineService {
  static build(booking: Booking): BookingTimelineStep[] {
    const states = this.statesFor(booking)
    const firstName = booking.artisan?.firstName?.trim() || 'the artisan'
    const createdAt = booking.createdAt?.toISO() ?? null
    const cancelledAt = booking.cancelledAt?.toISO() ?? null

    return STEP_KEYS.map((key, index) => {
      const state = states[index]
      const cancelled = state === 'cancelled'
      return {
        key,
        label: key === 'job-accepted' && cancelled ? 'Job cancelled' : STEP_LABELS[index],
        state,
        detail: this.detailFor(key, firstName, cancelled),
        at: this.timestampFor(key, cancelled, createdAt, cancelledAt),
      }
    })
  }

  /**
   * Per-stage states derived from the booking status (and awaiting flag).
   * Stages are: request-sent, artisan-reviewing, job-accepted, job-ongoing,
   * job-completed.
   */
  private static statesFor(booking: Booking): TimelineState[] {
    switch (booking.status) {
      case BookingStatus.PENDING:
        // Request sent; the artisan has the request but hasn't started reviewing.
        return ['done', 'pending', 'inactive', 'inactive', 'inactive']
      case BookingStatus.ACCEPTED:
        // Accepted and scheduled; the job itself has not started yet.
        return ['done', 'done', 'done', 'pending', 'inactive']
      case BookingStatus.ONGOING:
        return booking.awaitingConfirmation
          ? // Artisan reported the work done; awaiting the client to confirm.
            ['done', 'done', 'done', 'done', 'pending']
          : // The job is actively in progress.
            ['done', 'done', 'done', 'active', 'inactive']
      case BookingStatus.COMPLETED:
        return ['done', 'done', 'done', 'done', 'done']
      case BookingStatus.CANCELLED:
        return ['done', 'done', 'cancelled', 'inactive', 'inactive']
      default:
        return ['inactive', 'inactive', 'inactive', 'inactive', 'inactive']
    }
  }

  private static detailFor(key: string, firstName: string, cancelled: boolean): string {
    switch (key) {
      case 'request-sent':
        return `Your booking request has been sent to ${firstName}.`
      case 'artisan-reviewing':
        return `${firstName} is reviewing your request.`
      case 'job-accepted':
        return cancelled
          ? `${firstName} cancelled this booking.`
          : `${firstName} will confirm the booking.`
      case 'job-ongoing':
        return 'Work is in progress.'
      case 'job-completed':
        return 'The job will be marked as completed.'
      default:
        return ''
    }
  }

  private static timestampFor(
    key: string,
    cancelled: boolean,
    createdAt: string | null,
    cancelledAt: string | null
  ): string | null {
    if (key === 'request-sent') {
      return createdAt
    }
    if (key === 'job-accepted' && cancelled) {
      return cancelledAt
    }
    return null
  }
}
