import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import app from '@adonisjs/core/services/app'
import cache from '@adonisjs/cache/services/main'
import db from '@adonisjs/lucid/services/db'
import UserRole from '#enums/user_role'
import VerificationStatus from '#enums/verification_status'
import ArtisanProfile from '#models/artisan_profile'
import LocalPhotoService from '#services/local_photo_service'
import MailerService from '#services/mailer_service'
import User from '#models/user'
import {
  changePasswordValidator,
  forgotPasswordValidator,
  loginValidator,
  registerValidator,
  resetPasswordValidator,
  sendOtpValidator,
  updateProfileValidator,
  validateIdentityValidator,
  validateRegistrationValidator,
  verifyOtpValidator,
  verifyPasswordOtpValidator,
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

  /*
   * ---------------------------------------------------------------------------
   * Phone-based OTP (replaced by email OTP below). Kept, commented out, for
   * reference should SMS verification return.
   * ---------------------------------------------------------------------------
   *
   * async sendOtp({ request, response }: HttpContext) {
   *   const { phoneNumber } = await request.validateUsing(sendOtpValidator)
   *   const otp = String(Math.floor(100000 + Math.random() * 900000))
   *
   *   await cache.set({ key: this.otpCacheKey(phoneNumber), value: otp, ttl: '10m' })
   *
   *   return response.ok({ message: 'OTP sent successfully', phoneNumber, otp })
   * }
   *
   * async verifyOtp({ request, response }: HttpContext) {
   *   const { phoneNumber, otp } = await request.validateUsing(verifyOtpValidator)
   *   const cachedOtp = await cache.get({ key: this.otpCacheKey(phoneNumber) })
   *
   *   if (!cachedOtp || cachedOtp !== otp) {
   *     return response.unprocessableEntity({ message: 'Invalid or expired OTP' })
   *   }
   *
   *   await cache.delete({ key: this.otpCacheKey(phoneNumber) })
   *   await cache.set({ key: this.verifiedPhoneCacheKey(phoneNumber), value: true, ttl: '30m' })
   *
   *   return response.ok({ message: 'Phone number verified successfully', phoneNumber, verified: true })
   * }
   *
   * private otpCacheKey(phoneNumber: string) {
   *   return `otp:phone:${phoneNumber}`
   * }
   *
   * private verifiedPhoneCacheKey(phoneNumber: string) {
   *   return `otp:verified:${phoneNumber}`
   * }
   */

  /**
   * Send an email OTP for signup / artisan onboarding verification.
   * The code is cached (TTL 10m) and emailed; outside production it is also
   * returned in the response to ease development and testing.
   */
  async sendOtp({ request, response }: HttpContext) {
    const { email } = await request.validateUsing(sendOtpValidator)
    const otp = this.generateOtp()

    await cache.set({
      key: this.otpCacheKey(email),
      value: otp,
      ttl: '10m',
    })

    await MailerService.sendOtpEmail(email, otp)

    return response.ok({
      message: 'OTP sent successfully',
      email,
      ...this.devOtp(otp),
    })
  }

  /**
   * Verify an email OTP issued by sendOtp.
   */
  async verifyOtp({ request, response }: HttpContext) {
    const { email, otp } = await request.validateUsing(verifyOtpValidator)
    const cachedOtp = await cache.get({ key: this.otpCacheKey(email) })

    if (!cachedOtp || cachedOtp !== otp) {
      return response.unprocessableEntity({
        message: 'Invalid or expired OTP',
      })
    }

    await cache.delete({ key: this.otpCacheKey(email) })
    await cache.set({
      key: this.verifiedEmailCacheKey(email),
      value: true,
      ttl: '30m',
    })

    return response.ok({
      message: 'Email verified successfully',
      email,
      verified: true,
    })
  }

  /**
   * Start a password reset. Always responds 200 with the same message whether
   * or not an account exists (anti-enumeration); a code is generated, cached
   * under a reset-only namespace (TTL 10m), and emailed only when the account
   * actually exists. Outside production the code is returned in the response.
   */
  async forgotPassword({ request, response }: HttpContext) {
    const { email } = await request.validateUsing(forgotPasswordValidator)
    const message = 'If an account exists for that email, a reset code has been sent'

    const user = await User.findBy('email', email)

    if (!user) {
      return response.ok({ message })
    }

    const otp = this.generateOtp()

    await cache.set({
      key: this.passwordResetCacheKey(email),
      value: otp,
      ttl: '10m',
    })

    await MailerService.sendPasswordResetEmail(email, otp)

    return response.ok({
      message,
      ...this.devOtp(otp),
    })
  }

  /**
   * Verify a password-reset OTP without consuming it. The reset step re-checks
   * and consumes the code.
   */
  async verifyPasswordOtp({ request, response }: HttpContext) {
    const { email, otp } = await request.validateUsing(verifyPasswordOtpValidator)
    const cachedOtp = await cache.get({ key: this.passwordResetCacheKey(email) })

    if (!cachedOtp || cachedOtp !== otp) {
      return response.unprocessableEntity({
        message: 'Invalid or expired OTP',
      })
    }

    return response.ok({
      message: 'OTP verified successfully',
      verified: true,
    })
  }

  /**
   * Complete a password reset: validate the OTP, set the new password, delete
   * the reset code, and revoke any existing access tokens.
   */
  async resetPassword({ request, response }: HttpContext) {
    const { email, otp, password } = await request.validateUsing(resetPasswordValidator)
    const cachedOtp = await cache.get({ key: this.passwordResetCacheKey(email) })

    if (!cachedOtp || cachedOtp !== otp) {
      return response.unprocessableEntity({
        message: 'Invalid or expired OTP',
      })
    }

    const user = await User.findBy('email', email)

    if (!user) {
      // The code was valid but the account is gone; treat as expired.
      await cache.delete({ key: this.passwordResetCacheKey(email) })
      return response.unprocessableEntity({
        message: 'Invalid or expired OTP',
      })
    }

    user.password = password
    await user.save()

    await cache.delete({ key: this.passwordResetCacheKey(email) })

    // Revoke existing sessions so the reset also signs the user out everywhere.
    const tokens = await User.accessTokens.all(user)
    await Promise.all(tokens.map((token) => User.accessTokens.delete(user, token.identifier)))

    return response.ok({ message: 'Password reset successfully' })
  }

  private generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000))
  }

  /**
   * Expose the OTP in the response only outside production.
   */
  private devOtp(otp: string) {
    return app.inProduction ? {} : { otp }
  }

  private otpCacheKey(email: string) {
    return `otp:email:${email}`
  }

  private verifiedEmailCacheKey(email: string) {
    return `otp:verified:${email}`
  }

  private passwordResetCacheKey(email: string) {
    return `pwreset:email:${email}`
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

  /**
   * Update the authenticated user's own profile.
   */
  async updateProfile({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(updateProfileValidator)

    if (payload.email && payload.email !== user.email) {
      const taken = await User.query().where('email', payload.email).whereNot('id', user.id).first()

      if (taken) {
        return response.unprocessableEntity({
          message: 'Email already in use',
          errors: [{ field: 'email', message: 'Email already in use' }],
        })
      }
    }

    if (payload.phoneNumber && payload.phoneNumber !== user.phoneNumber) {
      const taken = await User.query()
        .where('phone_number', payload.phoneNumber)
        .whereNot('id', user.id)
        .first()

      if (taken) {
        return response.unprocessableEntity({
          message: 'Phone number already in use',
          errors: [{ field: 'phoneNumber', message: 'Phone number already in use' }],
        })
      }
    }

    user.merge(payload)
    await user.save()
    await user.load('artisanProfile')

    return response.ok({ user: user.serialize() })
  }

  /**
   * Change the authenticated user's password.
   */
  async changePassword({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { currentPassword, newPassword } = await request.validateUsing(changePasswordValidator)

    const isValid = await hash.verify(user.password, currentPassword)

    if (!isValid) {
      return response.unprocessableEntity({
        message: 'Current password is incorrect',
        errors: [{ field: 'currentPassword', message: 'Current password is incorrect' }],
      })
    }

    user.password = newPassword
    await user.save()

    return response.ok({ message: 'Password updated successfully' })
  }
}
