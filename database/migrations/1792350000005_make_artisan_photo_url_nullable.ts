import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Allow artisan profiles to exist without a photo.
 *
 * Self-service registration still uploads an identity photo, but an admin may
 * now convert an existing user into an artisan. Such a profile starts without a
 * photo and the artisan supplies it later during onboarding, so the column is
 * relaxed to nullable.
 */
export default class extends BaseSchema {
  protected tableName = 'artisan_profiles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('photo_url').nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('photo_url').notNullable().alter()
    })
  }
}
