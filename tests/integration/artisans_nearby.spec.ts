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

  test('nearby filters by text query across trade', async ({ client, assert }) => {
    await createArtisan({ trade: 'Electrician' })
    await createArtisan({ trade: 'Plumber' })

    const response = await client.get('/api/v1/artisans/nearby').qs({ q: 'electric' })
    response.assertStatus(200)

    const trades = (response.body().data as Array<{ trade: string }>).map((i) => i.trade)
    assert.deepEqual(trades, ['Electrician'])
  })

  test('nearby filters by minimum rating', async ({ client, assert }) => {
    await createArtisan({ trade: 'HighRated', rating: 4.8 })
    await createArtisan({ trade: 'LowRated', rating: 3.2 })

    const response = await client.get('/api/v1/artisans/nearby').qs({ minRating: 4.5 })
    response.assertStatus(200)

    const trades = (response.body().data as Array<{ trade: string }>).map((i) => i.trade)
    assert.include(trades, 'HighRated')
    assert.notInclude(trades, 'LowRated')
  })

  test('nearby filters by price range', async ({ client, assert }) => {
    await createArtisan({ trade: 'Cheap', priceFrom: 5000 })
    await createArtisan({ trade: 'Pricey', priceFrom: 80000 })

    const response = await client
      .get('/api/v1/artisans/nearby')
      .qs({ minPrice: 1000, maxPrice: 20000 })
    response.assertStatus(200)

    const trades = (response.body().data as Array<{ trade: string }>).map((i) => i.trade)
    assert.include(trades, 'Cheap')
    assert.notInclude(trades, 'Pricey')
  })

  test('nearby sorts by top rating when requested', async ({ client, assert }) => {
    await createArtisan({ trade: 'A', rating: 4.1 })
    await createArtisan({ trade: 'B', rating: 4.9 })
    await createArtisan({ trade: 'C', rating: 4.5 })

    const response = await client.get('/api/v1/artisans/nearby').qs({ sort: 'top-rated' })
    response.assertStatus(200)

    const ratings = (response.body().data as Array<{ rating: number }>).map((i) => i.rating)
    const descending = [...ratings].sort((a, b) => b - a)
    assert.deepEqual(ratings, descending)
  })

  test('nearby sorts by lowest price when requested', async ({ client, assert }) => {
    await createArtisan({ trade: 'A', priceFrom: 30000 })
    await createArtisan({ trade: 'B', priceFrom: 8000 })
    await createArtisan({ trade: 'C', priceFrom: 15000 })

    const response = await client.get('/api/v1/artisans/nearby').qs({ sort: 'lowest-price' })
    response.assertStatus(200)

    const prices = (response.body().data as Array<{ priceFrom: number }>).map((i) => i.priceFrom)
    const ascending = [...prices].sort((a, b) => a - b)
    assert.deepEqual(prices, ascending)
  })
})
