import { test } from '@japa/runner'
import UserRole from '#enums/user_role'
import User from '#models/user'

test.group('User model helpers', () => {
  test('fullName concatenates first and last name', ({ assert }) => {
    const user = new User()
    user.firstName = 'Ada'
    user.lastName = 'Okeke'

    assert.equal(user.fullName, 'Ada Okeke')
  })

  test('role helpers reflect assigned role', ({ assert }) => {
    const user = new User()

    user.role = UserRole.USER
    assert.isTrue(user.isUser)
    assert.isFalse(user.isArtisan)
    assert.isFalse(user.isAdmin)

    user.role = UserRole.ARTISAN
    assert.isTrue(user.isArtisan)

    user.role = UserRole.ADMIN
    assert.isTrue(user.isAdmin)
  })
})
