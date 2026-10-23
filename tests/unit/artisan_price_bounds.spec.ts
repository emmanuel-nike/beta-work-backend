import { test } from '@japa/runner'
import ArtisanProfile from '#models/artisan_profile'

test.group('ArtisanProfile price bounds', () => {
  test('defaultServicePricing uses the trade with 1000-10000 range', ({ assert }) => {
    assert.deepEqual(ArtisanProfile.defaultServicePricing('Plumber'), [
      { service: 'Plumber', minPrice: 1000, maxPrice: 10000 },
    ])
  })

  test('computePriceBounds takes min of minPrice and max of maxPrice', ({ assert }) => {
    const bounds = ArtisanProfile.computePriceBounds([
      { service: 'A', minPrice: 3000, maxPrice: 8000 },
      { service: 'B', minPrice: 1000, maxPrice: 120000 },
      { service: 'C', minPrice: 5000, maxPrice: null },
    ])

    assert.equal(bounds.priceFrom, 1000)
    assert.equal(bounds.priceTo, 120000)
  })

  test('computePriceBounds returns nulls for empty pricing', ({ assert }) => {
    assert.deepEqual(ArtisanProfile.computePriceBounds([]), {
      priceFrom: null,
      priceTo: null,
    })
    assert.deepEqual(ArtisanProfile.computePriceBounds(null), {
      priceFrom: null,
      priceTo: null,
    })
  })
})
