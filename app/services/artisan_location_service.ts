export type Coordinates = {
  latitude: number | null
  longitude: number | null
}

const EARTH_RADIUS_KM = 6371
const MIN_PLACEHOLDER_KM = 0.5
const MAX_PLACEHOLDER_KM = 20

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function hasCoordinates(point: Coordinates): point is { latitude: number; longitude: number } {
  return (
    typeof point.latitude === 'number' &&
    Number.isFinite(point.latitude) &&
    typeof point.longitude === 'number' &&
    Number.isFinite(point.longitude)
  )
}

/**
 * Distance helpers for ranking artisans by proximity.
 *
 * Today artisans have not captured their coordinates, so {@link resolveDistanceKm}
 * returns a stable placeholder distance. Once artisans and clients store real
 * latitude/longitude (the columns now exist), the same method computes the true
 * great-circle distance and callers can order by it without changing shape.
 */
export default class ArtisanLocationService {
  /** Great-circle (haversine) distance between two points, in kilometres. */
  static haversineKm(from: Coordinates, to: Coordinates): number | null {
    if (!hasCoordinates(from) || !hasCoordinates(to)) {
      return null
    }

    const dLat = toRadians(to.latitude - from.latitude)
    const dLng = toRadians(to.longitude - from.longitude)
    const lat1 = toRadians(from.latitude)
    const lat2 = toRadians(to.latitude)

    const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return EARTH_RADIUS_KM * c
  }

  /**
   * Deterministic stand-in distance for an artisan with no coordinates. Stable
   * per `seed` (use the artisan id) so the same artisan reads the same distance
   * across the dashboard rail, search, and their profile — but still arbitrary,
   * within {@link MIN_PLACEHOLDER_KM}–{@link MAX_PLACEHOLDER_KM} km.
   */
  static placeholderDistanceKm(seed: number): number {
    // Knuth multiplicative hash -> fraction in [0, 1).
    const hashed = (Math.imul(seed || 1, 2654435761) >>> 0) / 0xffffffff
    const span = MAX_PLACEHOLDER_KM - MIN_PLACEHOLDER_KM
    return this.round(MIN_PLACEHOLDER_KM + hashed * span)
  }

  /**
   * The distance to surface for an artisan: the real haversine distance when
   * both the viewer's origin and the artisan have coordinates, otherwise the
   * stable placeholder keyed off `seed`.
   */
  static resolveDistanceKm(origin: Coordinates | null, artisan: Coordinates, seed: number): number {
    if (origin) {
      const real = this.haversineKm(origin, artisan)
      if (real !== null) {
        return this.round(real)
      }
    }
    return this.placeholderDistanceKm(seed)
  }

  private static round(km: number): number {
    return Math.round(km * 10) / 10
  }
}
