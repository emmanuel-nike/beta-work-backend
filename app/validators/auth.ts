import vine from '@vinejs/vine'
import UserRole from '#enums/user_role'

export const registerValidator = vine.compile(
  vine.object({
    firstName: vine.string().trim().minLength(1).maxLength(100),
    lastName: vine.string().trim().minLength(1).maxLength(100),
    email: vine
      .string()
      .trim()
      .email()
      .normalizeEmail()
      .unique({ table: 'users', column: 'email' }),
    phoneNumber: vine
      .string()
      .trim()
      .minLength(7)
      .maxLength(30)
      .unique({ table: 'users', column: 'phone_number' }),
    password: vine.string().minLength(8).maxLength(72),
    role: vine.enum([UserRole.USER, UserRole.ARTISAN]).optional(),
    artisanProfile: vine
      .object({
        trade: vine.string().trim().minLength(1).maxLength(120),
        businessName: vine.string().trim().maxLength(150).optional(),
        bio: vine.string().trim().maxLength(2000).optional(),
        yearsOfExperience: vine.number().min(0).max(80).optional(),
        city: vine.string().trim().maxLength(100).optional(),
        state: vine.string().trim().maxLength(100).optional(),
        address: vine.string().trim().maxLength(255).optional(),
        serviceRadiusKm: vine.number().min(0).optional(),
        verificationDocumentUrl: vine.string().trim().url().optional(),
      })
      .optional(),
  })
)

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().normalizeEmail(),
    password: vine.string(),
  })
)
