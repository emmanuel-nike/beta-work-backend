import type { HttpContext } from '@adonisjs/core/http'
import GeocodingService from '#services/geocoding_service'

export default class GeocodingController {
  /**
   * Address suggestions for a partial query: `GET /geocoding/autocomplete?q=`.
   * Optional `sessionToken` groups autocomplete + details calls for billing.
   */
  async autocomplete({ request, response }: HttpContext) {
    const query = String(request.input('q', '')).trim()
    const sessionToken = request.input('sessionToken')
    const predictions = await GeocodingService.autocomplete(query, sessionToken)
    return response.ok({ data: predictions })
  }

  /**
   * Resolve a selected prediction to a formatted address + coordinates:
   * `GET /geocoding/place/:placeId`.
   */
  async place({ params, request, response }: HttpContext) {
    const sessionToken = request.input('sessionToken')
    const place = await GeocodingService.placeDetails(params.placeId, sessionToken)
    return response.ok({ data: place })
  }
}
