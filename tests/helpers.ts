import { randomBytes } from 'node:crypto'
import UserRole from '#enums/user_role'
import VerificationStatus from '#enums/verification_status'
import ArtisanProfile from '#models/artisan_profile'
import User from '#models/user'

export function uniquePhone(prefix = '+23480') {
  return `${prefix}${String(Math.floor(Math.random() * 1_000_00000)).padStart(8, '0')}`
}

export function uniqueEmail(prefix = 'user') {
  return `${prefix}.${randomBytes(4).toString('hex')}@example.com`
}

export function uniqueDigits(length = 11) {
  let value = ''
  while (value.length < length) {
    value += Math.floor(Math.random() * 10)
  }
  return value.slice(0, length)
}

export async function createUser(
  overrides: Partial<{
    firstName: string
    lastName: string
    email: string
    phoneNumber: string
    password: string
    city: string | null
    state: string | null
    address: string | null
    role: UserRole
  }> = {}
) {
  return User.create({
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? 'User',
    email: overrides.email ?? uniqueEmail(),
    phoneNumber: overrides.phoneNumber ?? uniquePhone(),
    password: overrides.password ?? 'password123',
    city: overrides.city ?? 'Lagos',
    state: overrides.state ?? 'Lagos',
    address: overrides.address ?? '12 Test Street',
    role: overrides.role ?? UserRole.USER,
  })
}

export async function createArtisan(
  overrides: Partial<{
    user: User
    trade: string
    nin: string
    bvn: string
    photoUrl: string
    verificationStatus: VerificationStatus
  }> = {}
) {
  const user =
    overrides.user ??
    (await createUser({
      role: UserRole.ARTISAN,
      email: uniqueEmail('artisan'),
    }))

  const profile = await ArtisanProfile.create({
    userId: user.id,
    trade: overrides.trade ?? 'Plumber',
    yearsOfExperience: 3,
    nin: overrides.nin ?? uniqueDigits(11),
    bvn: overrides.bvn ?? uniqueDigits(11),
    photoUrl: overrides.photoUrl ?? '/api/v1/uploads/artisans/test.jpg',
    verificationStatus: overrides.verificationStatus ?? VerificationStatus.APPROVED,
    isAvailable: true,
  })

  await user.load('artisanProfile')
  return { user, profile }
}
