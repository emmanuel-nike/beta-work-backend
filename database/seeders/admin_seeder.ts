import { BaseSeeder } from '@adonisjs/lucid/seeders'
import UserRole from '#enums/user_role'
import User from '#models/user'

export default class extends BaseSeeder {
  async run() {
    await User.updateOrCreate(
      { email: 'admin@betawork.app' },
      {
        firstName: 'BetaWork',
        lastName: 'Admin',
        email: 'admin@betawork.app',
        phoneNumber: '+10000000000',
        password: 'password123',
        role: UserRole.ADMIN,
      }
    )
  }
}
