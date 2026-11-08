import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'saved_addresses'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Recent addresses are kept separately per app mode (client / artisan),
      // so a dual-role user's client and artisan locations never mix.
      table.string('scope', 20).notNullable().defaultTo('client')
      table.index(['user_id', 'scope', 'created_at'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['user_id', 'scope', 'created_at'])
      table.dropColumn('scope')
    })
  }
}
