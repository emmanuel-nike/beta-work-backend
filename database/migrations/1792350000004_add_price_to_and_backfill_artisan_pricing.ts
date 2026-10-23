import { BaseSchema } from '@adonisjs/lucid/schema'
import type { ServicePrice } from '#models/artisan_profile'

export default class extends BaseSchema {
  protected tableName = 'artisan_profiles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('price_to').unsigned().nullable()
    })

    this.defer(async (db) => {
      const rows = await db
        .from(this.tableName)
        .select('id', 'trade', 'service_pricing', 'price_from')

      for (const row of rows) {
        let pricing = this.parsePricing(row.service_pricing)

        // Existing artisans without pricing get a default service named after their trade.
        if (!pricing?.length) {
          pricing = [{ service: row.trade || 'Service', minPrice: 1000, maxPrice: 10000 }]
        }

        const mins = pricing
          .map((item) => item.minPrice)
          .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
        const maxs = pricing
          .map((item) => item.maxPrice)
          .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

        const initPriceFrom = row.price_from ?? 1000
        const priceFrom = mins.length > 0 ? Math.min(...mins) : initPriceFrom
        const priceTo = maxs.length > 0 ? Math.max(...maxs) : 10000

        await db
          .from(this.tableName)
          .where('id', row.id)
          .update({
            service_pricing: db.raw('?::jsonb', [JSON.stringify(pricing)]),
            price_from: priceFrom,
            price_to: priceTo,
            updated_at: new Date(),
          })
      }
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('price_to')
    })
  }

  private parsePricing(value: unknown): ServicePrice[] | null {
    if (value === null || value === undefined) {
      return null
    }

    let parsed: unknown = value
    if (typeof value === 'string') {
      try {
        parsed = JSON.parse(value)
      } catch {
        return null
      }
    }

    if (!Array.isArray(parsed)) {
      return null
    }

    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const entry = item as Record<string, unknown>
        let minPrice = entry.minPrice
        if (minPrice === null) {
          minPrice = null
        } else if (typeof minPrice !== 'number') {
          minPrice = Number(minPrice) || null
        }
        let maxPrice = entry.maxPrice
        if (maxPrice === null) {
          maxPrice = null
        } else if (typeof maxPrice !== 'number') {
          maxPrice = Number(maxPrice) || null
        }
        return {
          service: String(entry.service ?? ''),
          minPrice: minPrice as number | null,
          maxPrice: maxPrice as number | null,
        }
      })
      .filter((item) => item.service.length > 0)
  }
}
