import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

// Places API (New) — https://developers.google.com/maps/documentation/places/web-service
const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete'
const PLACE_DETAILS_URL = 'https://places.googleapis.com/v1/places'
// Reverse geocoding still uses the (separate) Geocoding API, which is unaffected
// by the Places API migration.
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
 * Server-side proxy to the Google Maps Platform APIs. The API key lives only on
 * the server (set `GOOGLE_MAPS_API_KEY`), so it never ships in the mobile app
 * and can be IP-restricted to this host.
 *
 * Address search uses the Places API (New): autocomplete returns suggestions
 * and place details resolves a selected suggestion to coordinates. Reverse
 * geocoding uses the Geocoding API.
 */
export default class GeocodingService {
  /** Address suggestions for a partial query (Places Autocomplete, New). */
  static async autocomplete(query: string, sessionToken?: string): Promise<AddressPrediction[]> {
    const trimmed = query.trim()
    if (trimmed.length < 3) {
      return []
    }

    const payload: Record<string, unknown> = {
      input: trimmed,
      languageCode: 'en',
      // Bias results to Nigeria, where the service operates (CLDR region code).
      includedRegionCodes: ['ng'],
    }
    if (sessionToken) {
      payload.sessionToken = sessionToken
    }

    const body = await this.post(AUTOCOMPLETE_URL, payload)

    const suggestions = Array.isArray(body.suggestions) ? body.suggestions : []
    return suggestions
      .map((item: { placePrediction?: unknown }) => item?.placePrediction)
      .filter(
        (prediction: unknown): prediction is { placeId: string; text?: { text?: string } } =>
          typeof (prediction as { placeId?: unknown })?.placeId === 'string'
      )
      .map((prediction: { placeId: string; text?: { text?: string } }) => ({
        placeId: prediction.placeId,
        description: prediction.text?.text ?? '',
      }))
  }

  /** Resolve a selected prediction to a formatted address + coordinates (Place Details, New). */
  static async placeDetails(placeId: string, sessionToken?: string): Promise<ResolvedPlace> {
    const params = new URLSearchParams({ languageCode: 'en' })
    if (sessionToken) {
      params.set('sessionToken', sessionToken)
    }

    const url = `${PLACE_DETAILS_URL}/${encodeURIComponent(placeId)}?${params.toString()}`
    // The field mask is required by Place Details (New); request only what we use.
    const body = await this.get(url, 'id,formattedAddress,location')

    const location = body.location
    if (
      !location ||
      typeof location.latitude !== 'number' ||
      typeof location.longitude !== 'number'
    ) {
      throw new GeocodingException('Place has no coordinates', 502)
    }

    return {
      address: body.formattedAddress ?? '',
      latitude: location.latitude,
      longitude: location.longitude,
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

    const body = await this.requestLegacy(`${GEOCODE_URL}?${params.toString()}`)
    if (body.status === 'ZERO_RESULTS') {
      return { address: '', latitude, longitude }
    }
    this.assertLegacyOk(body)

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

  /** POST a JSON body to a Places API (New) endpoint. */
  private static async post(url: string, payload: Record<string, unknown>) {
    return this.callNew(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey(),
      },
      body: JSON.stringify(payload),
    })
  }

  /** GET a Places API (New) resource with a required field mask. */
  private static async get(url: string, fieldMask: string) {
    return this.callNew(url, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': this.apiKey(),
        'X-Goog-FieldMask': fieldMask,
      },
    })
  }

  /**
   * Call a Places API (New) endpoint. Unlike the legacy APIs it signals failure
   * with an HTTP status and an `{ error: { status, message } }` body, which we
   * log for diagnosis and collapse into a generic client-facing message.
   */
  private static async callNew(url: string, init: RequestInit): Promise<Record<string, any>> {
    let response: Response
    try {
      response = await fetch(url, init)
    } catch (error) {
      logger.error({ err: error }, 'Places API request failed to send')
      throw new GeocodingException('Address lookup is unavailable', 502)
    }

    const body = (await response.json().catch(() => ({}))) as Record<string, any>

    if (!response.ok) {
      logger.error(
        {
          status: response.status,
          googleStatus: body?.error?.status,
          message: body?.error?.message,
        },
        'Places API returned an error'
      )
      throw new GeocodingException('Address lookup failed', 502)
    }

    return body
  }

  /** Call a legacy Maps API (Geocoding) endpoint, which returns 200 + a `status` field. */
  private static async requestLegacy(url: string): Promise<Record<string, any>> {
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

  /** Legacy APIs return 200 with a `status` field; anything but OK is an error. */
  private static assertLegacyOk(body: Record<string, any>) {
    if (body.status !== 'OK') {
      logger.error(
        { googleStatus: body?.status, message: body?.error_message },
        'Geocoding API returned a non-OK status'
      )
      throw new GeocodingException('Address lookup failed', 502)
    }
  }
}
