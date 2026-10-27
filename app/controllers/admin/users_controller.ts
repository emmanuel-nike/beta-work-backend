import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import cache from '@adonisjs/cache/services/main'
import UserRole from '#enums/user_role'
import VerificationStatus from '#enums/verification_status'
import ArtisanProfile from '#models/artisan_profile'
import User from '#models/user'
import { convertToArtisanValidator } from '#validators/artisan_profile'

const updateRoleValidator = vine.compile(
  vine.object({
    role: vine.enum([UserRole.USER, UserRole.ARTISAN, UserRole.ADMIN]),
  })
)

export default class UsersController {
  /**
   * List all users for the admin dashboard.
   */
  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = Math.min(Number(request.input('limit', 20)), 100)
    const role = request.input('role')

    const query = User.query().preload('artisanProfile').orderBy('created_at', 'desc')

    if (role && Object.values(UserRole).includes(role)) {
      query.where('role', role)
    }

    const users = await query.paginate(page, limit)

    return response.ok(users.serialize())
  }

  /**
   * Show a single user.
   */
  async show({ params, response }: HttpContext) {
    const user = await User.query().where('id', params.id).preload('artisanProfile').firstOrFail()

    return response.ok({ user: user.serialize() })
  }

  /**
   * Update a user's role.
   *
   * This only flips the role flag. To turn a user into a working artisan use
   * `convertToArtisan`, which also provisions the artisan profile the rest of
   * the platform depends on.
   */
  async updateRole({ params, request, response }: HttpContext) {
    const { role } = await request.validateUsing(updateRoleValidator)
    const user = await User.findOrFail(params.id)

    user.role = role
    await user.save()
    await user.load('artisanProfile')

    return response.ok({ user: user.serialize() })
  }

  /**
   * Convert an existing user into an artisan.
   *
   * Promotes the user to the artisan role and provisions a pending artisan
   * profile in a single transaction. The profile starts unverified; an admin
   * approves it later via the artisan verification endpoint. Location and
   * coordinates are seeded from the user's own details when not supplied so a
   * freshly converted artisan can surface in proximity search once approved.
   */
  async convertToArtisan({ params, request, response }: HttpContext) {
    const payload = await request.validateUsing(convertToArtisanValidator)
    const user = await User.query().where('id', params.id).preload('artisanProfile').firstOrFail()

    if (user.artisanProfile) {
      return response.conflict({ message: 'User already has an artisan profile' })
    }

    const servicePricing = ArtisanProfile.defaultServicePricing(payload.trade)
    const bounds = ArtisanProfile.computePriceBounds(servicePricing)

    await db.transaction(async (trx) => {
      user.useTransaction(trx)
      user.role = UserRole.ARTISAN
      await user.save()

      await ArtisanProfile.create(
        {
          userId: user.id,
          trade: payload.trade,
          businessName: payload.businessName ?? null,
          bio: payload.bio ?? null,
          yearsOfExperience: payload.yearsOfExperience ?? 0,
          city: payload.city ?? user.city,
          state: payload.state ?? user.state,
          address: payload.address ?? user.address,
          latitude: user.latitude,
          longitude: user.longitude,
          serviceRadiusKm: payload.serviceRadiusKm ?? null,
          verificationStatus: VerificationStatus.PENDING,
          isAvailable: true,
          servicePricing,
          priceFrom: bounds.priceFrom,
          priceTo: bounds.priceTo,
        },
        { client: trx }
      )
    })

    await cache.clear()
    await user.load('artisanProfile')

    return response.created({ user: user.serialize() })
  }
}
