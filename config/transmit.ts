import { defineConfig } from '@adonisjs/transmit'
import { redis } from '@adonisjs/transmit/transports'
import env from '#start/env'

/**
 * Server-Sent Events (SSE) config powering near-real-time updates. The Redis
 * transport synchronises broadcasts and subscriptions across every API
 * instance, so a booking change handled by one process reaches clients
 * connected to another. The client is `@adonisjs/transmit-client`.
 */
export default defineConfig({
  // Keep long-lived SSE connections warm through proxies/load balancers.
  pingInterval: '30s',

  transport: {
    driver: redis({
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      password: env.get('REDIS_PASSWORD', ''),
    }),
  },
})
