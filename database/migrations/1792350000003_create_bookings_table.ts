import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bookings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()

      // The client who made the booking and the artisan they booked.
      table
        .integer('client_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('artisan_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table
        .enum('status', ['pending', 'accepted', 'ongoing', 'completed', 'cancelled'], {
          useNative: true,
          enumName: 'booking_status',
          existingType: false,
        })
        .notNullable()
        .defaultTo('pending')

      // Snapshot of what was booked (kept on the row so history is stable even
      // if the artisan later edits their trade or pricing).
      table.string('trade').notNullable()
      table.string('service').notNullable()
      table.text('job_description').nullable()
      table.integer('budget').unsigned().nullable()
      table.string('languages').nullable()
      table.text('message_to_artisan').nullable()

      // When and where the job happens.
      table.timestamp('scheduled_at').nullable()
      table.string('location').nullable()
      table.string('address').nullable()
      table.decimal('latitude', 10, 7).nullable()
      table.decimal('longitude', 10, 7).nullable()

      // Ongoing jobs the artisan has reported finished, awaiting client confirm.
      table.boolean('awaiting_confirmation').notNullable().defaultTo(false)

      // Cancellation details (null unless status = cancelled).
      table.string('cancelled_by').nullable()
      table.string('cancellation_reason').nullable()
      table.timestamp('cancelled_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['client_id', 'status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS "booking_status"')
  }
}
