import { test } from '@japa/runner'
import GeocodingService, { GeocodingException } from '#services/geocoding_service'

/**
 * These tests exercise the deterministic, no-network branches of the service:
 * the short-query short-circuit and the missing-key guard. The test env does
 * not set GOOGLE_MAPS_API_KEY, so any call that reaches Google raises a 503
 * before a request is made.
 */
test.group('GeocodingService', () => {
  test('autocomplete returns [] for queries shorter than 3 characters', async ({ assert }) => {
    assert.deepEqual(await GeocodingService.autocomplete(''), [])
    assert.deepEqual(await GeocodingService.autocomplete('ab'), [])
    assert.deepEqual(await GeocodingService.autocomplete('  a '), [])
  })

  test('autocomplete raises 503 when the API key is not configured', async ({ assert }) => {
    await assert.rejects(async () => {
      await GeocodingService.autocomplete('Jabi Lake Mall')
    }, 'Address lookup is not configured')
  })

  test('placeDetails raises 503 when the API key is not configured', async ({ assert }) => {
    try {
      await GeocodingService.placeDetails('ChIJN1t_tDeuEmsRUsoyG83frY4')
      assert.fail('expected GeocodingException')
    } catch (error) {
      assert.instanceOf(error, GeocodingException)
      assert.equal((error as GeocodingException).status, 503)
    }
  })

  test('reverse raises 503 when the API key is not configured', async ({ assert }) => {
    try {
      await GeocodingService.reverse(9.0579, 7.4951)
      assert.fail('expected GeocodingException')
    } catch (error) {
      assert.instanceOf(error, GeocodingException)
      assert.equal((error as GeocodingException).status, 503)
    }
  })
})
