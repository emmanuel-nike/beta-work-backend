import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'device_tokens'

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

      // The FCM registration token. Unique so a device moving between accounts
      // is reassigned (upsert) rather than duplicated.
      table.string('token', 512).notNullable().unique()
      table.string('platform', 20).notNullable().defaultTo('unknown')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Push fan-out loads every token for a user.
      table.index(['user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
