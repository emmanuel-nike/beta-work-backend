/*
|--------------------------------------------------------------------------
| Transmit (SSE) routes and channel authorization
|--------------------------------------------------------------------------
|
| Registers the Server-Sent-Events endpoints and restricts the per-user
| channel so a client may only subscribe to its own `users/:id` stream.
| Booking events are broadcast to these channels by NotificationService.
|
*/

import type { HttpContext } from '@adonisjs/core/http'
import transmit from '@adonisjs/transmit/services/main'
import { middleware } from '#start/kernel'

// Require authentication to open the SSE stream and to (un)subscribe.
transmit.registerRoutes((route) => {
  route.use(middleware.auth())
})

/**
 * A user may only subscribe to their own channel. `auth.check()` populates the
 * user from the bearer token sent with the subscribe request; the subscription
 * is rejected unless the channel id matches the authenticated user.
 */
transmit.authorize<{ id: string }>('users/:id', async (ctx: HttpContext, { id }) => {
  await ctx.auth.check()
  return ctx.auth.user?.id === Number(id)
})
