import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import UserRole from '#enums/user_role'
import ArtisanProfile from '#models/artisan_profile'
import User from '#models/user'
import { createArtisan, createUser } from '#tests/helpers'

async function tokenFor(user: User) {
  const token = await User.accessTokens.create(user)
  return token.value!.release()
}

test.group('Artisan portfolio API', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('PUT /artisan/portfolio requires authentication', async ({ client }) => {
    const response = await client.put('/api/v1/artisan/portfolio')
    response.assertStatus(401)
  })

  test('PUT /artisan/portfolio rejects non-artisan users', async ({ client }) => {
    const user = await createUser({ role: UserRole.USER })
    const token = await tokenFor(user)

    const response = await client
      .put('/api/v1/artisan/portfolio')
      .field('trade', 'Plumber')
      .bearerToken(token)

    response.assertStatus(403)
  })

  test('PUT /artisan/portfolio saves the full portfolio payload', async ({ client, assert }) => {
    const { user, profile } = await createArtisan({ trade: 'Plumber' })
    const token = await tokenFor(user)

    const weeklySchedule = {
      Monday: { enabled: true, start: '09:00', end: '17:00' },
      Sunday: { enabled: false, start: '', end: '' },
    }
    const servicePricing = [{ service: 'Fittings', minPrice: 3000, maxPrice: 120000 }]

    const response = await client
      .put('/api/v1/artisan/portfolio')
      .field('trade', 'Electrician')
      .field('bio', 'Skilled electrician specialising in rewiring.')
      .field('yearsOfExperience', '8')
      .field('isAvailable', 'false')
      .field('minimumLeadTimeHours', '2')
      .field('additionalServices', JSON.stringify(['Plumber', 'Carpenter']))
      .field('languages', JSON.stringify(['English', 'Yoruba']))
      .field('servicePricing', JSON.stringify(servicePricing))
      .field('weeklySchedule', JSON.stringify(weeklySchedule))
      .bearerToken(token)

    response.assertStatus(200)
    response.assertBodyContains({
      artisanProfile: {
        trade: 'Electrician',
        yearsOfExperience: 8,
        isAvailable: false,
        minimumLeadTimeHours: 2,
      },
    })

    const refreshed = await ArtisanProfile.findOrFail(profile.id)
    assert.equal(refreshed.trade, 'Electrician')
    assert.equal(refreshed.yearsOfExperience, 8)
    assert.isFalse(refreshed.isAvailable)
    assert.equal(refreshed.minimumLeadTimeHours, 2)
    assert.deepEqual(refreshed.additionalServices, ['Plumber', 'Carpenter'])
    assert.deepEqual(refreshed.languages, ['English', 'Yoruba'])
    assert.deepEqual(refreshed.servicePricing, servicePricing)
    assert.deepEqual(refreshed.weeklySchedule, weeklySchedule)
  })

  test('PUT /artisan/portfolio rejects a missing primary skill', async ({ client }) => {
    const { user } = await createArtisan()
    const token = await tokenFor(user)

    const response = await client
      .put('/api/v1/artisan/portfolio')
      .field('bio', 'No trade provided')
      .bearerToken(token)

    response.assertStatus(422)
  })

  test('PUT /artisan/portfolio stores uploaded photo and portfolio images', async ({
    client,
    assert,
  }) => {
    const { user, profile } = await createArtisan()
    const token = await tokenFor(user)

    const response = await client
      .put('/api/v1/artisan/portfolio')
      .field('trade', 'Painter')
      .field('keepPortfolioImages', JSON.stringify([]))
      .file('photo', 'tests/fixtures/photo.jpg', {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      })
      .file('portfolioImages', 'tests/fixtures/photo.jpg', {
        filename: 'work-1.jpg',
        contentType: 'image/jpeg',
      })
      .bearerToken(token)

    response.assertStatus(200)

    const refreshed = await ArtisanProfile.findOrFail(profile.id)
    assert.match(refreshed.photoUrl, /^\/api\/v1\/uploads\/artisans\//)
    assert.isArray(refreshed.portfolioImages)
    assert.lengthOf(refreshed.portfolioImages!, 1)
    assert.match(refreshed.portfolioImages![0], /^\/api\/v1\/uploads\/artisans\//)
  })

  test('PUT /artisan/portfolio keeps already-hosted portfolio images', async ({ client }) => {
    const { user } = await createArtisan()
    const token = await tokenFor(user)
    const existing = 'https://cdn.example.com/portfolio/existing.jpg'

    const response = await client
      .put('/api/v1/artisan/portfolio')
      .field('trade', 'Tailor')
      .field('keepPortfolioImages', JSON.stringify([existing]))
      .bearerToken(token)

    response.assertStatus(200)
    response.assertBodyContains({
      artisanProfile: { portfolioImages: [existing] },
    })
  })
})
