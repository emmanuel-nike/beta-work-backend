/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import UserRole from '#enums/user_role'

const AuthController = () => import('#controllers/auth_controller')
const ArtisanProfilesController = () => import('#controllers/artisan_profiles_controller')
const AdminUsersController = () => import('#controllers/admin/users_controller')
const AdminArtisansController = () => import('#controllers/admin/artisans_controller')

router.get('/', async () => {
  return {
    name: 'BetaWork API',
    version: '1.0.0',
  }
})

router
  .group(() => {
    router.post('/auth/validate', [AuthController, 'validateRegistration'])
    router.post('/auth/validate/identity', [AuthController, 'validateIdentity'])
    router.post('/auth/otp/send', [AuthController, 'sendOtp'])
    router.post('/auth/otp/verify', [AuthController, 'verifyOtp'])
    router.post('/auth/register', [AuthController, 'register'])
    router.post('/auth/login', [AuthController, 'login'])

    router
      .group(() => {
        router.post('/auth/logout', [AuthController, 'logout'])
        router.get('/auth/me', [AuthController, 'me'])

        router
          .group(() => {
            router.get('/artisan/profile', [ArtisanProfilesController, 'mine'])
            router.put('/artisan/profile', [ArtisanProfilesController, 'update'])
          })
          .use(middleware.role({ roles: [UserRole.ARTISAN] }))

        router
          .group(() => {
            router.get('/users', [AdminUsersController, 'index'])
            router.get('/users/:id', [AdminUsersController, 'show'])
            router.patch('/users/:id/role', [AdminUsersController, 'updateRole'])

            router.get('/artisans', [AdminArtisansController, 'index'])
            router.patch('/artisans/:id/verification', [AdminArtisansController, 'verify'])
          })
          .prefix('/admin')
          .use(middleware.role({ roles: [UserRole.ADMIN] }))
      })
      .use(middleware.auth())

    router.get('/artisans', [ArtisanProfilesController, 'index'])
    router.get('/artisans/:id', [ArtisanProfilesController, 'show'])
    router.get('/uploads/artisans/:fileName', [ArtisanProfilesController, 'photo'])
  })
  .prefix('/api/v1')
