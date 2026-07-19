import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import UserRole from '#enums/user_role'

/**
 * Ensures the authenticated user has one of the allowed roles.
 */
export default class RoleMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      roles?: UserRole[]
    } = {}
  ) {
    const user = ctx.auth.getUserOrFail()
    const allowedRoles = options.roles ?? []

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return ctx.response.forbidden({
        message: 'You do not have permission to access this resource',
      })
    }

    return next()
  }
}
