import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getMessaging, type Messaging } from 'firebase-admin/messaging'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

/**
 * Lazily boots the Firebase Admin SDK from service-account credentials in the
 * environment. When the credentials are absent (local dev, CI) the SDK is never
 * initialised and {@link messaging} returns null, so push delivery degrades to
 * a logged no-op instead of throwing — notifications stay best-effort.
 */
export default class FirebaseService {
  private static app: App | null = null
  private static initialised = false

  /** The messaging instance, or null when Firebase is not configured. */
  static messaging(): Messaging | null {
    const app = this.resolveApp()
    return app ? getMessaging(app) : null
  }

  static isConfigured(): boolean {
    return this.resolveApp() !== null
  }

  private static resolveApp(): App | null {
    if (this.initialised) {
      return this.app
    }
    this.initialised = true

    const projectId = env.get('FIREBASE_PROJECT_ID')
    const clientEmail = env.get('FIREBASE_CLIENT_EMAIL')
    const privateKey = env.get('FIREBASE_PRIVATE_KEY')

    if (!projectId || !clientEmail || !privateKey) {
      logger.info('Firebase not configured; push notifications disabled')
      return null
    }

    try {
      // Reuse an app if one was already registered (e.g. across HMR reloads).
      const existing = getApps()[0]
      this.app =
        existing ??
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            // Env stores the PEM with escaped newlines on a single line.
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        })
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialise Firebase Admin SDK')
      this.app = null
    }

    return this.app
  }
}
