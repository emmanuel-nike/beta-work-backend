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
    city: vine.string().trim().maxLength(100).optional(),
    state: vine.string().trim().maxLength(100).optional(),
    address: vine.string().trim().maxLength(255).optional(),
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
        nin: vine
          .string()
          .trim()
          .regex(/^\d{11}$/)
          .unique({ table: 'artisan_profiles', column: 'nin' }),
        bvn: vine
          .string()
          .trim()
          .regex(/^\d{11}$/)
          .unique({ table: 'artisan_profiles', column: 'bvn' }),
        verificationDocumentUrl: vine.string().trim().url().optional(),
        guarantor: vine
          .object({
            fullName: vine.string().trim().minLength(1).maxLength(150),
            email: vine.string().trim().email().normalizeEmail(),
            phoneNumber: vine.string().trim().minLength(7).maxLength(30),
            city: vine.string().trim().minLength(1).maxLength(100),
            state: vine.string().trim().minLength(1).maxLength(100),
            address: vine.string().trim().minLength(1).maxLength(255),
          })
          .optional(),
      })
      .optional(),
  })
)

/**
 * Pre-registration check for name, contact, and address fields.
 */
export const validateRegistrationValidator = vine.compile(
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
    city: vine.string().trim().maxLength(100).optional(),
    state: vine.string().trim().maxLength(100).optional(),
    address: vine.string().trim().maxLength(255).optional(),
  })
)

/**
 * Placeholder NIN/BVN validation. Currently only checks format and uniqueness.
 */
export const validateIdentityValidator = vine.compile(
  vine.object({
    nin: vine
      .string()
      .trim()
      .regex(/^\d{10,15}$/)
      .unique({ table: 'artisan_profiles', column: 'nin' }),
    bvn: vine
      .string()
      .trim()
      .regex(/^\d{11}$/)
      .unique({ table: 'artisan_profiles', column: 'bvn' }),
  })
)

export const sendOtpValidator = vine.compile(
  vine.object({
    phoneNumber: vine.string().trim().minLength(7).maxLength(30),
  })
)

export const verifyOtpValidator = vine.compile(
  vine.object({
    phoneNumber: vine.string().trim().minLength(7).maxLength(30),
    otp: vine.string().trim().fixedLength(6),
  })
)

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().normalizeEmail(),
    password: vine.string(),
  })
)
