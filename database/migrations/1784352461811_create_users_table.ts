import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('first_name').notNullable()
      table.string('last_name').notNullable()
      table.string('email', 254).notNullable().unique()
      table.string('phone_number', 30).notNullable().unique()
      table.string('password').notNullable()
      table
        .enum('role', ['user', 'artisan', 'admin'], {
          useNative: true,
          enumName: 'user_role',
          existingType: false,
        })
        .notNullable()
        .defaultTo('user')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS "user_role"')
  }
}
