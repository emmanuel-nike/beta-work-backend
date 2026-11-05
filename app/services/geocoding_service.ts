import env from '#start/env'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json'
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json'
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

export interface AddressPrediction {
  placeId: string
  description: string
}

export interface ResolvedPlace {
  address: string
  latitude: number
  longitude: number
}

/**
 * Raised when geocoding fails. 503 when the key is not configured, 502 when
 * Google returns an error; renders as `{ message }`.
 */
export class GeocodingException extends Exception {
  constructor(message: string, status: number) {
    super(message, { status })
  }

  async handle(error: this, ctx: HttpContext) {
    ctx.response.status(error.status).send({ message: error.message })
  }
}

/**
 * Server-side proxy to the Google Maps Platform Places API. The API key lives
 * only on the server (set `GOOGLE_MAPS_API_KEY`), so it never ships in the
 * mobile app and can be IP-restricted to this host.
 */
export default class GeocodingService {
  /** Address suggestions for a partial query (Places Autocomplete). */
  static async autocomplete(query: string, sessionToken?: string): Promise<AddressPrediction[]> {
    const trimmed = query.trim()
    if (trimmed.length < 3) {
      return []
    }

    const params = new URLSearchParams({
      input: trimmed,
      key: this.apiKey(),
      language: 'en',
      // Bias results to Nigeria, where the service operates.
      components: 'country:ng',
    })
    if (sessionToken) {
      params.set('sessiontoken', sessionToken)
    }

    const body = await this.request(`${AUTOCOMPLETE_URL}?${params.toString()}`)
    if (body.status === 'ZERO_RESULTS') {
      return []
    }
    this.assertOk(body)

    const predictions = Array.isArray(body.predictions) ? body.predictions : []
    return predictions
      .filter((item: { place_id?: string }) => typeof item.place_id === 'string')
      .map((item: { place_id: string; description?: string }) => ({
        placeId: item.place_id,
        description: item.description ?? '',
      }))
  }

  /** Resolve a selected prediction to a formatted address + coordinates. */
  static async placeDetails(placeId: string, sessionToken?: string): Promise<ResolvedPlace> {
    const params = new URLSearchParams({
      place_id: placeId,
      key: this.apiKey(),
      fields: 'geometry,formatted_address',
      language: 'en',
    })
    if (sessionToken) {
      params.set('sessiontoken', sessionToken)
    }

    const body = await this.request(`${DETAILS_URL}?${params.toString()}`)
    this.assertOk(body)

    const location = body.result?.geometry?.location
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      throw new GeocodingException('Place has no coordinates', 502)
    }

    return {
      address: body.result?.formatted_address ?? '',
      latitude: location.lat,
      longitude: location.lng,
    }
  }

  /**
   * Reverse geocode coordinates to a formatted address (Geocoding API). Returns
   * the coordinates with an empty address when Google finds no match.
   */
  static async reverse(latitude: number, longitude: number): Promise<ResolvedPlace> {
    const params = new URLSearchParams({
      latlng: `${latitude},${longitude}`,
      key: this.apiKey(),
      language: 'en',
    })

    const body = await this.request(`${GEOCODE_URL}?${params.toString()}`)
    if (body.status === 'ZERO_RESULTS') {
      return { address: '', latitude, longitude }
    }
    this.assertOk(body)

    const results = Array.isArray(body.results) ? body.results : []
    return {
      address: results[0]?.formatted_address ?? '',
      latitude,
      longitude,
    }
  }

  private static apiKey(): string {
    const key = env.get('GOOGLE_MAPS_API_KEY')
    if (!key) {
      throw new GeocodingException('Address lookup is not configured', 503)
    }
    return key
  }

  private static async request(url: string): Promise<Record<string, any>> {
    let response: Response
    try {
      response = await fetch(url)
    } catch {
      throw new GeocodingException('Address lookup is unavailable', 502)
    }
    if (!response.ok) {
      throw new GeocodingException('Address lookup is unavailable', 502)
    }
    return (await response.json()) as Record<string, any>
  }

  /** Google returns 200 with a `status` field; anything but OK is an error. */
  private static assertOk(body: Record<string, any>) {
    if (body.status !== 'OK') {
      throw new GeocodingException('Address lookup failed', 502)
    }
  }
}
