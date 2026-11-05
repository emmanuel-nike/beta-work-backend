import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'saved_addresses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('formatted_address', 500).notNullable()
      table.string('line1', 255).notNullable().defaultTo('')
      table.string('city', 120).notNullable().defaultTo('')
      table.string('state', 120).notNullable().defaultTo('')
      table.string('postal_code', 20).nullable()
      table.decimal('latitude', 10, 7).notNullable()
      table.decimal('longitude', 10, 7).notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Recent addresses are listed per user, newest first.
      table.index(['user_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
