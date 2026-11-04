import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Repair `artisan_profiles.service_pricing` rows corrupted by the original
 * backfill in `1792350000004_add_price_to_and_backfill_artisan_pricing`.
 *
 * That migration passed a Lucid `db.raw('?::jsonb', [...])` wrapper as an
 * update *value*. The driver did not unwrap it, so the raw wrapper itself was
 * JSON-stringified into the jsonb column, leaving values shaped like:
 *
 *   { "sql": "?::jsonb", "bindings": ["[{\"service\":\"Electrician\",...}]"] }
 *
 * The real pricing array survives as the JSON string in `bindings[0]`, so we
 * restore it. Clean rows (already arrays) are left untouched.
 */
export default class extends BaseSchema {
  protected tableName = 'artisan_profiles'

  async up() {
    this.defer(async (db) => {
      const rows = await db.from(this.tableName).select('id', 'service_pricing')

      for (const row of rows) {
        const restored = this.restorePricing(row.service_pricing)
        if (restored === null) {
          continue
        }

        await db
          .from(this.tableName)
          .where('id', row.id)
          // A JSON string, not a raw wrapper: Postgres casts it to jsonb.
          .update({ service_pricing: restored, updated_at: new Date() })
      }
    })
  }

  async down() {
    // Irreversible data repair: there is no meaningful rollback to a corrupted
    // value, so this is intentionally a no-op.
  }

  /**
   * Given a stored `service_pricing` value, return a corrected JSON string when
   * the value is the corrupted raw-wrapper shape, or `null` when nothing needs
   * to change. pg returns jsonb already parsed, but we also accept a string in
   * case another driver hands back raw text.
   */
  private restorePricing(value: unknown): string | null {
    let parsed: unknown = value
    if (typeof value === 'string') {
      try {
        parsed = JSON.parse(value)
      } catch {
        return null
      }
    }

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      !('sql' in parsed) ||
      !('bindings' in parsed)
    ) {
      return null
    }

    const bindings = (parsed as { bindings?: unknown }).bindings
    const first = Array.isArray(bindings) ? bindings[0] : undefined
    if (typeof first !== 'string') {
      return null
    }

    // `first` is already the JSON-encoded pricing array; validate before use.
    try {
      const array = JSON.parse(first)
      if (!Array.isArray(array)) {
        return null
      }
      return JSON.stringify(array)
    } catch {
      return null
    }
  }
}
