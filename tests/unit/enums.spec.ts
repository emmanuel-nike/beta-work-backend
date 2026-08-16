import { test } from '@japa/runner'
import UserRole from '#enums/user_role'
import VerificationStatus from '#enums/verification_status'

test.group('Enums', () => {
  test('UserRole exposes expected values', ({ assert }) => {
    assert.equal(UserRole.USER, 'user')
    assert.equal(UserRole.ARTISAN, 'artisan')
    assert.equal(UserRole.ADMIN, 'admin')
  })

  test('VerificationStatus exposes expected values', ({ assert }) => {
    assert.equal(VerificationStatus.PENDING, 'pending')
    assert.equal(VerificationStatus.APPROVED, 'approved')
    assert.equal(VerificationStatus.REJECTED, 'rejected')
  })
})
