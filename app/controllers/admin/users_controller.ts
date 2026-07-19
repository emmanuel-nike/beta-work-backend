import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import UserRole from '#enums/user_role'
import User from '#models/user'

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
   */
  async updateRole({ params, request, response }: HttpContext) {
    const { role } = await request.validateUsing(updateRoleValidator)
    const user = await User.findOrFail(params.id)

    user.role = role
    await user.save()
    await user.load('artisanProfile')

    return response.ok({ user: user.serialize() })
  }
}
