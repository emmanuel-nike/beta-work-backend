import vine from '@vinejs/vine'

/**
 * Validates a device registering its FCM token for push notifications. The
 * platform is optional and defaults to `unknown` when omitted.
 */
export const registerDeviceValidator = vine.compile(
  vine.object({
    token: vine.string().trim().minLength(1).maxLength(512),
    platform: vine.enum(['ios', 'android', 'web']).optional(),
  })
)
