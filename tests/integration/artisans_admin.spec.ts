import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import UserRole from '#enums/user_role'
import VerificationStatus from '#enums/verification_status'
import User from '#models/user'
import { createArtisan, createUser, uniqueDigits, uniqueEmail, uniquePhone } from '#tests/helpers'

test.group('Artisan & Admin API', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('GET /artisans returns approved artisans only', async ({ client, assert }) => {
    await createArtisan({ verificationStatus: VerificationStatus.APPROVED, trade: 'Electrician' })
    await createArtisan({ verificationStatus: VerificationStatus.PENDING, trade: 'Painter' })

    const response = await client.get('/api/v1/artisans')

    response.assertStatus(200)
    const trades = (response.body().data ?? []).map((item: { trade: string }) => item.trade)
    assert.include(trades, 'Electrician')
    assert.notInclude(trades, 'Painter')
  })

  test('artisan can fetch own profile', async ({ client }) => {
    const { user } = await createArtisan({ verificationStatus: VerificationStatus.PENDING })
    const token = await issueToken(user)

    const response = await client.get('/api/v1/artisan/profile').bearerToken(token)

    response.assertStatus(200)
    response.assertBodyContains({
      artisanProfile: {
        userId: user.id,
      },
    })
  })

  test('non-artisan cannot access artisan profile route', async ({ client }) => {
    const user = await createUser({ role: UserRole.USER })
    const token = await issueToken(user)

    const response = await client.get('/api/v1/artisan/profile').bearerToken(token)
    response.assertStatus(403)
  })

  test('admin can list users and update roles', async ({ client }) => {
    const admin = await createUser({
      role: UserRole.ADMIN,
      email: uniqueEmail('admin'),
      phoneNumber: uniquePhone('+23481'),
    })
    const member = await createUser({
      role: UserRole.USER,
      email: uniqueEmail('member'),
      phoneNumber: uniquePhone('+23482'),
    })
    const token = await issueToken(admin)

    const listResponse = await client.get('/api/v1/admin/users').bearerToken(token)
    listResponse.assertStatus(200)

    const roleResponse = await client
      .patch(`/api/v1/admin/users/${member.id}/role`)
      .bearerToken(token)
      .json({ role: UserRole.ARTISAN })

    roleResponse.assertStatus(200)
    roleResponse.assertBodyContains({
      user: {
        id: member.id,
        role: UserRole.ARTISAN,
      },
    })
  })

  test('admin can verify an artisan', async ({ client }) => {
    const admin = await createUser({ role: UserRole.ADMIN, email: uniqueEmail('admin2') })
    const { profile } = await createArtisan({
      verificationStatus: VerificationStatus.PENDING,
      nin: uniqueDigits(11),
      bvn: uniqueDigits(11),
    })
    const token = await issueToken(admin)

    const response = await client
      .patch(`/api/v1/admin/artisans/${profile.id}/verification`)
      .bearerToken(token)
      .json({
        verificationStatus: VerificationStatus.APPROVED,
        verificationNotes: 'Looks good',
      })

    response.assertStatus(200)
    response.assertBodyContains({
      artisanProfile: {
        id: profile.id,
        verificationStatus: VerificationStatus.APPROVED,
      },
    })
  })

  test('POST /auth/register creates an artisan with guarantor and photo', async ({
    client,
    assert,
  }) => {
    const email = uniqueEmail('artisan-reg')
    const phoneNumber = uniquePhone('+23483')
    const nin = uniqueDigits(11)
    const bvn = uniqueDigits(11)

    const response = await client
      .post('/api/v1/auth/register')
      .field('firstName', 'Bola')
      .field('lastName', 'Ade')
      .field('email', email)
      .field('phoneNumber', phoneNumber)
      .field('password', 'password123')
      .field('city', 'Abuja')
      .field('state', 'FCT')
      .field('address', '1 Unity Road')
      .field('role', UserRole.ARTISAN)
      .field('artisanProfile[trade]', 'Carpenter')
      .field('artisanProfile[nin]', nin)
      .field('artisanProfile[bvn]', bvn)
      .field('artisanProfile[guarantor][fullName]', 'Guarantor Person')
      .field('artisanProfile[guarantor][email]', uniqueEmail('guarantor'))
      .field('artisanProfile[guarantor][phoneNumber]', uniquePhone('+23484'))
      .field('artisanProfile[guarantor][city]', 'Abuja')
      .field('artisanProfile[guarantor][state]', 'FCT')
      .field('artisanProfile[guarantor][address]', '2 Guarantor Street')
      .file('photo', 'tests/fixtures/photo.jpg', {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      })

    response.assertStatus(201)
    response.assertBodyContains({
      type: 'bearer',
      user: {
        email,
        role: UserRole.ARTISAN,
        artisanProfile: {
          trade: 'Carpenter',
          guarantorFullName: 'Guarantor Person',
        },
      },
    })
    assert.match(response.body().user.artisanProfile.photoUrl, /^\/api\/v1\/uploads\/artisans\//)
  })
})

async function issueToken(user: User) {
  const token = await User.accessTokens.create(user)
  return token.value!.release()
}
