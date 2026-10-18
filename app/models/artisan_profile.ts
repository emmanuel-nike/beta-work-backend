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

  @column()
  declare serviceRadiusKm: number | null

  @column()
  declare isAvailable: boolean

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
