import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Listing metadata surfaced on the client's artisan cards ("artisans near you",
 * search results): aggregate rating, number of reviews, and the lowest price
 * the artisan takes jobs at. Stored on the profile so the API can return them
 * directly instead of the client fabricating placeholder values.
 */
export default class extends BaseSchema {
  protected tableName = 'artisan_profiles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('rating', 3, 2).notNullable().defaultTo(0)
      table.integer('reviews_count').unsigned().notNullable().defaultTo(0)
      table.integer('price_from').unsigned().nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('rating')
      table.dropColumn('reviews_count')
      table.dropColumn('price_from')
    })
  }
}
