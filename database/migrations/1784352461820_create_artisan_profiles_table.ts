import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'artisan_profiles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      // Job details
      table.string('business_name').nullable()
      table.string('trade').notNullable()
      table.text('bio').nullable()
      table.integer('years_of_experience').unsigned().notNullable().defaultTo(0)
      table.string('city').nullable()
      table.string('state').nullable()
      table.string('address').nullable()
      table.decimal('service_radius_km', 8, 2).nullable()
      table.boolean('is_available').notNullable().defaultTo(true)

      // Verification details
      table
        .enum('verification_status', ['pending', 'approved', 'rejected'], {
          useNative: true,
          enumName: 'verification_status',
          existingType: false,
        })
        .notNullable()
        .defaultTo('pending')
      table.string('verification_document_url').nullable()
      table.text('verification_notes').nullable()
      table.timestamp('verified_at').nullable()
      table
        .integer('verified_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS "verification_status"')
  }
}
