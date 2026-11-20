import logger from '@adonisjs/core/services/logger'
import DeviceToken from '#models/device_token'
import FirebaseService from '#services/firebase_service'

/** A push message: a visible notification plus a machine-readable data payload. */
export interface PushMessage {
  title: string
  body: string
  /** String map delivered to the app; used to trigger the right data refresh. */
  data?: Record<string, string>
}

/**
 * Sends FCM push notifications to every device a user has registered. Delivery
 * is best-effort: with Firebase unconfigured, or on transport errors, it logs
 * and returns. Tokens Firebase reports as permanently invalid are pruned so the
 * table does not accumulate dead devices.
 */
export default class PushService {
  static async sendToUser(userId: number, message: PushMessage): Promise<void> {
    const messaging = FirebaseService.messaging()
    if (!messaging) {
      return
    }

    const devices = await DeviceToken.query().where('userId', userId)
    if (devices.length === 0) {
      return
    }

    const tokens = devices.map((device) => device.token)

    try {
      const response = await messaging.sendEachForMulticast({
        tokens,
        notification: { title: message.title, body: message.body },
        data: message.data ?? {},
        android: { priority: 'high' },
        apns: {
          // `content-available` lets the app refresh data on delivery.
          payload: { aps: { contentAvailable: true, sound: 'default' } },
        },
      })

      await this.pruneInvalidTokens(response.responses, tokens)
    } catch (error) {
      logger.error({ err: error, userId }, 'Failed to send push notification')
    }
  }

  /**
   * Remove tokens FCM rejected as unregistered/invalid so stale devices stop
   * being targeted. Other failures (rate limits, transient) are left in place.
   */
  private static async pruneInvalidTokens(
    responses: Array<{ success: boolean; error?: { code?: string } }>,
    tokens: string[]
  ): Promise<void> {
    const dead: string[] = []
    responses.forEach((result, index) => {
      const code = result.error?.code
      if (
        !result.success &&
        (code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/invalid-argument')
      ) {
        dead.push(tokens[index])
      }
    })

    if (dead.length > 0) {
      await DeviceToken.query().whereIn('token', dead).delete()
    }
  }
}
