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
