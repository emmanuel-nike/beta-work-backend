import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import cache from '@adonisjs/cache/services/main'
import UserRole from '#enums/user_role'
import VerificationStatus from '#enums/verification_status'
import ArtisanProfile from '#models/artisan_profile'
import { verifyArtisanValidator } from '#validators/artisan_profile'

export default class ArtisansController {
  /**
   * List artisan profiles (optionally filter by verification status).
   */
  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = Math.min(Number(request.input('limit', 20)), 100)
    const status = request.input('verificationStatus')

    const query = ArtisanProfile.query().preload('user').orderBy('created_at', 'desc')

    if (status && Object.values(VerificationStatus).includes(status)) {
      query.where('verificationStatus', status)
    }

    const artisans = await query.paginate(page, limit)

    return response.ok(artisans.serialize())
  }

  /**
   * Approve, reject, or reset artisan verification.
   */
  async verify({ auth, params, request, response }: HttpContext) {
    const admin = auth.getUserOrFail()
    const payload = await request.validateUsing(verifyArtisanValidator)
    const profile = await ArtisanProfile.query()
      .where('id', params.id)
      .preload('user')
      .firstOrFail()

    profile.verificationStatus = payload.verificationStatus
    profile.verificationNotes = payload.verificationNotes ?? null

    if (payload.verificationStatus === VerificationStatus.APPROVED) {
      profile.verifiedAt = DateTime.now()
      profile.verifiedBy = admin.id

      // Activating an artisan also guarantees they carry the artisan role, in
      // case the profile was created before the role was applied.
      if (profile.user.role !== UserRole.ARTISAN) {
        profile.user.role = UserRole.ARTISAN
        await profile.user.save()
      }
    } else {
      profile.verifiedAt = null
      profile.verifiedBy = null
    }

    await profile.save()
    await cache.clear()

    return response.ok({ artisanProfile: profile.serialize() })
  }
}
