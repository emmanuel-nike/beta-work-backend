import vine from '@vinejs/vine'
import VerificationStatus from '#enums/verification_status'

export const updateArtisanProfileValidator = vine.compile(
  vine.object({
    trade: vine.string().trim().minLength(1).maxLength(120).optional(),
    businessName: vine.string().trim().maxLength(150).nullable().optional(),
    bio: vine.string().trim().maxLength(2000).nullable().optional(),
    yearsOfExperience: vine.number().min(0).max(80).optional(),
    city: vine.string().trim().maxLength(100).nullable().optional(),
    state: vine.string().trim().maxLength(100).nullable().optional(),
    address: vine.string().trim().maxLength(255).nullable().optional(),
    serviceRadiusKm: vine.number().min(0).nullable().optional(),
    isAvailable: vine.boolean().optional(),
    nin: vine
      .string()
      .trim()
      .regex(/^\d{10,16}$/)
      .optional(),
    bvn: vine
      .string()
      .trim()
      .regex(/^\d{11}$/)
      .optional(),
    verificationDocumentUrl: vine.string().trim().url().nullable().optional(),
    guarantorFullName: vine.string().trim().minLength(1).maxLength(150).nullable().optional(),
    guarantorEmail: vine.string().trim().email().normalizeEmail().nullable().optional(),
    guarantorPhoneNumber: vine.string().trim().minLength(7).maxLength(30).nullable().optional(),
    guarantorCity: vine.string().trim().minLength(1).maxLength(100).nullable().optional(),
    guarantorState: vine.string().trim().minLength(1).maxLength(100).nullable().optional(),
    guarantorAddress: vine.string().trim().minLength(1).maxLength(255).nullable().optional(),
  })
)

const dayScheduleSchema = vine.object({
  enabled: vine.boolean(),
  start: vine.string().trim().maxLength(10).optional(),
  end: vine.string().trim().maxLength(10).optional(),
})

/**
 * Validates the parsed portfolio payload. The controller decodes the JSON
 * string fields that arrive over multipart before handing the object here.
 */
export const updateArtisanPortfolioValidator = vine.compile(
  vine.object({
    trade: vine.string().trim().minLength(1).maxLength(120),
    bio: vine.string().trim().maxLength(2000).nullable().optional(),
    yearsOfExperience: vine.number().min(0).max(80).optional(),
    isAvailable: vine.boolean().optional(),
    minimumLeadTimeHours: vine.number().min(0).max(720).nullable().optional(),
    additionalServices: vine.array(vine.string().trim().maxLength(120)).optional(),
    languages: vine.array(vine.string().trim().maxLength(60)).optional(),
    servicePricing: vine
      .array(
        vine.object({
          service: vine.string().trim().minLength(1).maxLength(120),
          minPrice: vine.number().min(0).nullable().optional(),
          maxPrice: vine.number().min(0).nullable().optional(),
        })
      )
      .optional(),
    weeklySchedule: vine.record(dayScheduleSchema).optional(),
  })
)

/**
 * Validates an admin request to convert an existing user into an artisan.
 * Only the trade is required; everything else falls back to the user's own
 * details or sensible defaults, and the artisan completes the rest of their
 * profile during onboarding.
 */
export const convertToArtisanValidator = vine.compile(
  vine.object({
    trade: vine.string().trim().minLength(1).maxLength(120),
    businessName: vine.string().trim().maxLength(150).nullable().optional(),
    bio: vine.string().trim().maxLength(2000).nullable().optional(),
    yearsOfExperience: vine.number().min(0).max(80).optional(),
    city: vine.string().trim().maxLength(100).nullable().optional(),
    state: vine.string().trim().maxLength(100).nullable().optional(),
    address: vine.string().trim().maxLength(255).nullable().optional(),
    serviceRadiusKm: vine.number().min(0).nullable().optional(),
  })
)

export const verifyArtisanValidator = vine.compile(
  vine.object({
    verificationStatus: vine.enum([
      VerificationStatus.APPROVED,
      VerificationStatus.REJECTED,
      VerificationStatus.PENDING,
    ]),
    verificationNotes: vine.string().trim().maxLength(2000).nullable().optional(),
  })
)
