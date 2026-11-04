import vine from '@vinejs/vine'

/**
 * Validates the payload a client sends to request a booking. `artisanProfileId`
 * is the public artisan profile id (as served by `GET /artisans/:id`); the
 * controller resolves it to the owning user and derives the trade.
 */
export const createBookingValidator = vine.compile(
  vine.object({
    artisanProfileId: vine.number().positive(),
    service: vine.string().trim().minLength(1).maxLength(150),
    jobDescription: vine.string().trim().minLength(1).maxLength(2000),
    scheduledAt: vine.string().trim().optional().nullable(),
    budget: vine.number().min(0).nullable().optional(),
    languages: vine.string().trim().maxLength(120).nullable().optional(),
    messageToArtisan: vine.string().trim().maxLength(2000).nullable().optional(),
    location: vine.string().trim().maxLength(255).nullable().optional(),
    address: vine.string().trim().maxLength(255).nullable().optional(),
  })
)
