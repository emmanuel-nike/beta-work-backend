import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Add geographic coordinates to users (clients) and artisan profiles.
 *
 * Address + region (state) are already stored; latitude/longitude let a future
 * iteration compute the real distance between a client and an artisan and order
 * results by proximity. Columns are nullable because existing accounts have not
 * captured their coordinates yet.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.decimal('latitude', 10, 7).nullable()
      table.decimal('longitude', 10, 7).nullable()
    })

    this.schema.alterTable('artisan_profiles', (table) => {
      table.decimal('latitude', 10, 7).nullable()
      table.decimal('longitude', 10, 7).nullable()
    })
  }

  async down() {
    this.schema.alterTable('users', (table) => {
      table.dropColumn('latitude')
      table.dropColumn('longitude')
    })

    this.schema.alterTable('artisan_profiles', (table) => {
      table.dropColumn('latitude')
      table.dropColumn('longitude')
    })
  }
}
