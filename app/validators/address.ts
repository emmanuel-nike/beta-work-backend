import vine from '@vinejs/vine'

/** Validates a saved address submitted by the client (from geocoding results). */
export const saveAddressValidator = vine.compile(
  vine.object({
    address: vine.string().trim().minLength(1).maxLength(500),
    line1: vine.string().trim().maxLength(255).optional(),
    city: vine.string().trim().maxLength(120).optional(),
    state: vine.string().trim().maxLength(120).optional(),
    postalCode: vine.string().trim().maxLength(20).nullable().optional(),
    latitude: vine.number().min(-90).max(90),
    longitude: vine.number().min(-180).max(180),
  })
)
