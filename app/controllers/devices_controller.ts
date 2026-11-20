import type { HttpContext } from '@adonisjs/core/http'
import DeviceToken from '#models/device_token'
import { registerDeviceValidator } from '#validators/device'

/**
 * Registers and unregisters a device's FCM token so the authenticated user can
 * receive push notifications. Tokens are unique: re-registering an existing
 * token reassigns it to the current user (e.g. after a device switches
 * accounts) rather than creating a duplicate.
 */
export default class DevicesController {
  /** Register (or refresh) the caller's device token. */
  async register({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { token, platform } = await request.validateUsing(registerDeviceValidator)

    await DeviceToken.updateOrCreate(
      { token },
      { token, userId: user.id, platform: platform ?? 'unknown' }
    )

    return response.ok({ registered: true })
  }

  /** Unregister one of the caller's device tokens (called on logout). */
  async unregister({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    await DeviceToken.query().where('userId', user.id).where('token', params.token).delete()

    return response.noContent()
  }
}
