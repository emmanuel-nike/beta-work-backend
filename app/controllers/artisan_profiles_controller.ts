import type { HttpContext } from '@adonisjs/core/http'
import cache from '@adonisjs/cache/services/main'
import VerificationStatus from '#enums/verification_status'
import ArtisanProfile from '#models/artisan_profile'
import { updateArtisanProfileValidator } from '#validators/artisan_profile'

export default class ArtisanProfilesController {
  /**
   * Public search of verified, available artisans.
   */
  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = Math.min(Number(request.input('limit', 20)), 50)
    const trade = request.input('trade')
    const city = request.input('city')

    const cacheKey = `artisans:search:${trade ?? 'all'}:${city ?? 'all'}:${page}:${limit}`

    const result = await cache.getOrSet({
      key: cacheKey,
      ttl: '2m',
      factory: async () => {
        const query = ArtisanProfile.query()
          .where('verificationStatus', VerificationStatus.APPROVED)
          .where('isAvailable', true)
          .preload('user')

        if (trade) {
          query.whereILike('trade', `%${trade}%`)
        }

        if (city) {
          query.whereILike('city', `%${city}%`)
        }

        const paginated = await query.orderBy('created_at', 'desc').paginate(page, limit)
        return paginated.serialize()
      },
    })

    return response.ok(result)
  }

  /**
   * Show a single artisan profile (public for approved artisans).
   */
  async show({ params, response }: HttpContext) {
    const profile = await ArtisanProfile.query()
      .where('id', params.id)
      .preload('user')
      .firstOrFail()

    if (profile.verificationStatus !== VerificationStatus.APPROVED) {
      return response.notFound({ message: 'Artisan profile not found' })
    }

    return response.ok({ artisanProfile: profile.serialize() })
  }

  /**
   * Get the authenticated artisan's own profile.
   */
  async mine({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    await user.load('artisanProfile')

    if (!user.artisanProfile) {
      return response.notFound({ message: 'Artisan profile not found' })
    }

    return response.ok({ artisanProfile: user.artisanProfile.serialize() })
  }

  /**
   * Update the authenticated artisan's profile.
   */
  async update({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    await user.load('artisanProfile')

    if (!user.artisanProfile) {
      return response.notFound({ message: 'Artisan profile not found' })
    }

    const payload = await request.validateUsing(updateArtisanProfileValidator)
    user.artisanProfile.merge(payload)
    await user.artisanProfile.save()

    await cache.clear()

    return response.ok({ artisanProfile: user.artisanProfile.serialize() })
  }
}
