import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import AddressScope from '#enums/address_scope'
import User from '#models/user'

// pg returns decimals as strings; cast coordinates back to numbers for JSON.
const numericColumn = {
  consume: (value: unknown) => (value === null || value === undefined ? null : Number(value)),
}

export default class SavedAddress extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  /** Which app mode the address belongs to (client / artisan). */
  @column()
  declare scope: AddressScope

  @column()
  declare formattedAddress: string

  @column()
  declare line1: string

  @column()
  declare city: string

  @column()
  declare state: string

  @column()
  declare postalCode: string | null

  @column(numericColumn)
  declare latitude: number

  @column(numericColumn)
  declare longitude: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
