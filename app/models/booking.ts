import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import BookingStatus from '#enums/booking_status'
import User from '#models/user'

const numericColumn = {
  consume: (value: unknown) => (value === null || value === undefined ? null : Number(value)),
}

export default class Booking extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare clientId: number

  @column()
  declare artisanId: number

  @column()
  declare status: BookingStatus

  @column()
  declare trade: string

  @column()
  declare service: string

  @column()
  declare jobDescription: string | null

  @column()
  declare budget: number | null

  @column()
  declare languages: string | null

  @column()
  declare messageToArtisan: string | null

  @column.dateTime()
  declare scheduledAt: DateTime | null

  @column()
  declare location: string | null

  @column()
  declare address: string | null

  @column(numericColumn)
  declare latitude: number | null

  @column(numericColumn)
  declare longitude: number | null

  @column()
  declare awaitingConfirmation: boolean

  @column()
  declare cancelledBy: string | null

  @column()
  declare cancellationReason: string | null

  @column.dateTime()
  declare cancelledAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User, { foreignKey: 'clientId' })
  declare client: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'artisanId' })
  declare artisan: BelongsTo<typeof User>
}
