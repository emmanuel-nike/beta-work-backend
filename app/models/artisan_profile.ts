import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import VerificationStatus from '#enums/verification_status'
import User from '#models/user'

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
