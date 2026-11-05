import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Domain error raised by BookingService. It carries an HTTP status so the
 * service stays free of request/response concerns, and renders the same
 * `{ message }` body the controllers return directly.
 */
export default class BookingException extends Exception {
  constructor(message: string, status: number) {
    super(message, { status })
  }

  async handle(error: this, ctx: HttpContext) {
    ctx.response.status(error.status).send({ message: error.message })
  }
}
