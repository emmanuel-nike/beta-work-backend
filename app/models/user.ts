import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column, hasOne } from '@adonisjs/lucid/orm'
import type { HasOne } from '@adonisjs/lucid/types/relations'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import UserRole from '#enums/user_role'
import ArtisanProfile from '#models/artisan_profile'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email', 'phoneNumber'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare firstName: string

  @column()
  declare lastName: string

  @column()
  declare email: string

  @column()
  declare phoneNumber: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare role: UserRole

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasOne(() => ArtisanProfile)
  declare artisanProfile: HasOne<typeof ArtisanProfile>

  static accessTokens = DbAccessTokensProvider.forModel(User, {
    expiresIn: '30 days',
    prefix: 'oat_',
    table: 'auth_access_tokens',
    type: 'auth_token',
    tokenSecretLength: 40,
  })

  get fullName() {
    return `${this.firstName} ${this.lastName}`
  }

  get isUser() {
    return this.role === UserRole.USER
  }

  get isArtisan() {
    return this.role === UserRole.ARTISAN
  }

  get isAdmin() {
    return this.role === UserRole.ADMIN
  }
}
