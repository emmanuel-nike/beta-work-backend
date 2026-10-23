import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import VerificationStatus from '#enums/verification_status'
import { createArtisan } from '#tests/helpers'

test.group('Artisans nearby API', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('GET /artisans/nearby returns approved, available artisans ranked by distance', async ({
    client,
    assert,
  }) => {
    await createArtisan({ verificationStatus: VerificationStatus.APPROVED, trade: 'Electrician' })
    await createArtisan({ verificationStatus: VerificationStatus.APPROVED, trade: 'Plumber' })
    await createArtisan({ verificationStatus: VerificationStatus.PENDING, trade: 'Painter' })

    const response = await client.get('/api/v1/artisans/nearby')
    response.assertStatus(200)

    const data = response.body().data as Array<{ trade: string; distanceKm: number }>
    const trades = data.map((item) => item.trade)
    assert.include(trades, 'Electrician')
    assert.include(trades, 'Plumber')
    assert.notInclude(trades, 'Painter')

    // Every artisan carries a distance, and results are sorted nearest-first.
    for (const item of data) {
      assert.isNumber(item.distanceKm)
      assert.isAbove(item.distanceKm, 0)
    }
    const distances = data.map((item) => item.distanceKm)
    const sorted = [...distances].sort((a, b) => a - b)
    assert.deepEqual(distances, sorted)
  })

  test('GET /artisans/nearby respects the limit parameter', async ({ client, assert }) => {
    await createArtisan({ verificationStatus: VerificationStatus.APPROVED })
    await createArtisan({ verificationStatus: VerificationStatus.APPROVED })
    await createArtisan({ verificationStatus: VerificationStatus.APPROVED })

    const response = await client.get('/api/v1/artisans/nearby').qs({ limit: 2 })
    response.assertStatus(200)
    assert.lengthOf(response.body().data, 2)
  })

  test('GET /artisans attaches a distance to each listed artisan', async ({ client, assert }) => {
    await createArtisan({ verificationStatus: VerificationStatus.APPROVED, trade: 'Welder' })

    const response = await client.get('/api/v1/artisans')
    response.assertStatus(200)

    const data = response.body().data as Array<{ distanceKm: number }>
    assert.isNotEmpty(data)
    assert.isNumber(data[0].distanceKm)
  })
})
