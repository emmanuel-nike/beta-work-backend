import type { HttpContext } from '@adonisjs/core/http'
import cache from '@adonisjs/cache/services/main'
import db from '@adonisjs/lucid/services/db'
import UserRole from '#enums/user_role'
import VerificationStatus from '#enums/verification_status'
import ArtisanProfile from '#models/artisan_profile'
import LocalPhotoService from '#services/local_photo_service'
import User from '#models/user'
import {
  loginValidator,
  registerValidator,
  sendOtpValidator,
  validateIdentityValidator,
  validateRegistrationValidator,
  verifyOtpValidator,
} from '#validators/auth'

export default class AuthController {
  /**
   * Validate name, email, phone, and address before registration.
   */
  async validateRegistration({ request, response }: HttpContext) {
    const payload = await request.validateUsing(validateRegistrationValidator)

    return response.ok({
      message: 'User information is valid',
      data: payload,
    })
  }

  /**
   * Validate NIN, BVN, and photo before artisan registration.
   * Currently a stub: format + uniqueness + photo upload. Platform verification comes later.
   */
  async validateIdentity({ request, response }: HttpContext) {
    const payload = await request.validateUsing(validateIdentityValidator)

    const photo = request.file('photo', {
      size: LocalPhotoService.MAX_SIZE,
      extnames: [...LocalPhotoService.EXTNAMES],
    })

    if (!photo) {
      return response.unprocessableEntity({
        message: 'Photo is required',
      })
    }

    if (!photo.isValid) {
      return response.unprocessableEntity({
        message: photo.errors[0]?.message ?? 'Invalid photo upload',
        errors: photo.errors,
      })
    }

    let photoUrl: string

    try {
      photoUrl = await LocalPhotoService.storeArtisanPhoto(photo)
    } catch (error) {
      return response.badRequest({
        message: error instanceof Error ? error.message : 'Unable to store photo',
      })
    }

    return response.ok({
      message: 'NIN, BVN and photo are valid',
      verified: true,
      data: {
        nin: payload.nin,
        bvn: payload.bvn,
        photoUrl,
      },
    })
  }

  /**
   * Dummy OTP send for phone verification. Returns a generated OTP for now.
   */
  async sendOtp({ request, response }: HttpContext) {
    const { phoneNumber } = await request.validateUsing(sendOtpValidator)
    const otp = String(Math.floor(100000 + Math.random() * 900000))

    await cache.set({
      key: this.otpCacheKey(phoneNumber),
      value: otp,
      ttl: '10m',
    })

    return response.ok({
      message: 'OTP sent successfully',
      phoneNumber,
      otp,
    })
  }

  /**
   * Verify a phone number OTP issued by sendOtp.
   */
  async verifyOtp({ request, response }: HttpContext) {
    const { phoneNumber, otp } = await request.validateUsing(verifyOtpValidator)
    const cachedOtp = await cache.get({ key: this.otpCacheKey(phoneNumber) })

    if (!cachedOtp || cachedOtp !== otp) {
      return response.unprocessableEntity({
        message: 'Invalid or expired OTP',
      })
    }

    await cache.delete({ key: this.otpCacheKey(phoneNumber) })
    await cache.set({
      key: this.verifiedPhoneCacheKey(phoneNumber),
      value: true,
      ttl: '30m',
    })

    return response.ok({
      message: 'Phone number verified successfully',
      phoneNumber,
      verified: true,
    })
  }

  private otpCacheKey(phoneNumber: string) {
    return `otp:phone:${phoneNumber}`
  }

  private verifiedPhoneCacheKey(phoneNumber: string) {
    return `otp:verified:${phoneNumber}`
  }

  /**
   * Register a normal user or artisan and return an access token.
   * Artisan registration expects multipart/form-data with a `photo` file.
   */
  async register({ request, response }: HttpContext) {
    const payload = await request.validateUsing(registerValidator)
    const role = payload.role ?? UserRole.USER

    if (role === UserRole.ARTISAN && !payload.artisanProfile?.trade) {
      return response.unprocessableEntity({
        message: 'Artisan registration requires artisanProfile.trade',
      })
    }

    let photoUrl: string | null = null

    if (role === UserRole.ARTISAN) {
      const photo = request.file('photo', {
        size: LocalPhotoService.MAX_SIZE,
        extnames: [...LocalPhotoService.EXTNAMES],
      })

      if (!photo) {
        return response.unprocessableEntity({
          message: 'Artisan registration requires a photo',
        })
      }

      if (!photo.isValid) {
        return response.unprocessableEntity({
          message: photo.errors[0]?.message ?? 'Invalid photo upload',
          errors: photo.errors,
        })
      }

      try {
        photoUrl = await LocalPhotoService.storeArtisanPhoto(photo)
      } catch (error) {
        return response.badRequest({
          message: error instanceof Error ? error.message : 'Unable to store photo',
        })
      }
    }

    const user = await db.transaction(async (trx) => {
      const createdUser = await User.create(
        {
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          phoneNumber: payload.phoneNumber,
          password: payload.password,
          city: payload.city ?? null,
          state: payload.state ?? null,
          address: payload.address ?? null,
          role,
        },
        { client: trx }
      )

      if (role === UserRole.ARTISAN && payload.artisanProfile && photoUrl) {
        const guarantor = payload.artisanProfile.guarantor

        await ArtisanProfile.create(
          {
            userId: createdUser.id,
            trade: payload.artisanProfile.trade,
            businessName: payload.artisanProfile.businessName ?? null,
            bio: payload.artisanProfile.bio ?? null,
            yearsOfExperience: payload.artisanProfile.yearsOfExperience ?? 0,
            city: payload.artisanProfile.city ?? null,
            state: payload.artisanProfile.state ?? null,
            address: payload.artisanProfile.address ?? null,
            serviceRadiusKm: payload.artisanProfile.serviceRadiusKm ?? null,
            nin: payload.artisanProfile.nin,
            bvn: payload.artisanProfile.bvn,
            photoUrl,
            guarantorFullName: guarantor?.fullName ?? null,
            guarantorEmail: guarantor?.email ?? null,
            guarantorPhoneNumber: guarantor?.phoneNumber ?? null,
            guarantorCity: guarantor?.city ?? null,
            guarantorState: guarantor?.state ?? null,
            guarantorAddress: guarantor?.address ?? null,
            verificationDocumentUrl: payload.artisanProfile.verificationDocumentUrl ?? null,
            verificationStatus: VerificationStatus.PENDING,
            isAvailable: true,
          },
          { client: trx }
        )
      }

      return createdUser
    })

    await user.load('artisanProfile')
    const token = await User.accessTokens.create(user)

    return response.created({
      type: 'bearer',
      value: token.value!.release(),
      expiresAt: token.expiresAt,
      user: user.serialize(),
    })
  }

  /**
   * Authenticate with email/password and issue an access token.
   */
  async login({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)
    const user = await User.verifyCredentials(email, password)
    await user.load('artisanProfile')

    const token = await User.accessTokens.create(user)

    return response.ok({
      type: 'bearer',
      value: token.value!.release(),
      expiresAt: token.expiresAt,
      user: user.serialize(),
    })
  }

  /**
   * Revoke the current access token.
   */
  async logout({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const token = user.currentAccessToken

    if (!token) {
      return response.badRequest({ message: 'Token not found' })
    }

    await User.accessTokens.delete(user, token.identifier)

    return response.ok({ message: 'Logged out successfully' })
  }

  /**
   * Return the authenticated user profile.
   */
  async me({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    await user.load('artisanProfile')

    return response.ok({ user: user.serialize() })
  }
}
