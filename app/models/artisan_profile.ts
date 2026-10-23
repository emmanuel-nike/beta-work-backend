import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import VerificationStatus from '#enums/verification_status'
import User from '#models/user'

export type ServicePrice = {
  service: string
  minPrice?: number | null
  maxPrice?: number | null
}

export type DaySchedule = {
  enabled: boolean
  start?: string
  end?: string
}

export type WeeklySchedule = Record<string, DaySchedule>

/**
 * Store arrays/objects as JSON and read them back as parsed values. Postgres
 * jsonb returns parsed values on read, but we guard against string payloads so
 * the model stays correct across drivers.
 */
const jsonColumn = {
  prepare: (value: unknown) =>
    value === null || value === undefined ? value : JSON.stringify(value),
  consume: (value: unknown) => {
    if (value === null || value === undefined) {
      return value
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    }
    return value
  },
}

export default class ArtisanProfile extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare businessName: string | null

  @column()
  declare trade: string

  @column()
  declare bio: string | null

  @column()
  declare yearsOfExperience: number

  @column()
  declare city: string | null

  @column()
  declare state: string | null

  @column()
  declare address: string | null

  // pg returns decimals as strings; parse back to numbers for JSON output.
  @column({ consume: (value: unknown) => (value === null ? null : Number(value)) })
  declare latitude: number | null

  @column({ consume: (value: unknown) => (value === null ? null : Number(value)) })
  declare longitude: number | null

  @column()
  declare serviceRadiusKm: number | null

  @column({ consume: (value: unknown) => (value === null ? 0 : Number(value)) })
  declare rating: number

  @column()
  declare reviewsCount: number

  @column()
  declare priceFrom: number | null

  @column()
  declare priceTo: number | null

  @column()
  declare isAvailable: boolean

  /**
   * Default single-service pricing for a newly registered artisan.
   */
  static defaultServicePricing(trade: string): ServicePrice[] {
    return [{ service: trade, minPrice: 1000, maxPrice: 10000 }]
  }

  /**
   * Derive listing price bounds from per-service min/max prices.
   */
  static computePriceBounds(pricing: ServicePrice[] | null | undefined): {
    priceFrom: number | null
    priceTo: number | null
  } {
    if (!pricing?.length) {
      return { priceFrom: null, priceTo: null }
    }

    const mins = pricing
      .map((item) => item.minPrice)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    const maxs = pricing
      .map((item) => item.maxPrice)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

    return {
      priceFrom: mins.length > 0 ? Math.min(...mins) : null,
      priceTo: maxs.length > 0 ? Math.max(...maxs) : null,
    }
  }

  @column()
  declare nin: string

  @column()
  declare bvn: string

  @column()
  declare photoUrl: string

  @column()
  declare guarantorFullName: string | null

  @column()
  declare guarantorEmail: string | null

  @column()
  declare guarantorPhoneNumber: string | null

  @column()
  declare guarantorCity: string | null

  @column()
  declare guarantorState: string | null

  @column()
  declare guarantorAddress: string | null

  @column(jsonColumn)
  declare additionalServices: string[] | null

  @column()
  declare certificateUrl: string | null

  @column(jsonColumn)
  declare languages: string[] | null

  @column(jsonColumn)
  declare portfolioImages: string[] | null

  @column(jsonColumn)
  declare servicePricing: ServicePrice[] | null

  @column()
  declare minimumLeadTimeHours: number | null

  @column(jsonColumn)
  declare weeklySchedule: WeeklySchedule | null

  @column()
  declare verificationStatus: VerificationStatus

  @column()
  declare verificationDocumentUrl: string | null

  @column()
  declare verificationNotes: string | null

  @column.dateTime()
  declare verifiedAt: DateTime | null

  @column()
  declare verifiedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'verifiedBy' })
  declare verifier: BelongsTo<typeof User>
}
