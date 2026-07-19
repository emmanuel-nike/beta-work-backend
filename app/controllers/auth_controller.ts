import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import UserRole from '#enums/user_role'
import VerificationStatus from '#enums/verification_status'
import ArtisanProfile from '#models/artisan_profile'
import User from '#models/user'
import { loginValidator, registerValidator } from '#validators/auth'

export default class AuthController {
  /**
   * Register a normal user or artisan and return an access token.
   */
  async register({ request, response }: HttpContext) {
    const payload = await request.validateUsing(registerValidator)
    const role = payload.role ?? UserRole.USER

    if (role === UserRole.ARTISAN && !payload.artisanProfile?.trade) {
      return response.unprocessableEntity({
        message: 'Artisan registration requires artisanProfile.trade',
      })
    }

    const user = await db.transaction(async (trx) => {
      const createdUser = await User.create(
        {
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          phoneNumber: payload.phoneNumber,
          password: payload.password,
          role,
        },
        { client: trx }
      )

      if (role === UserRole.ARTISAN && payload.artisanProfile) {
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
