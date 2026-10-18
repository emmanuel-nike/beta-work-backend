import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'artisan_profiles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Step 1 — other services offered + certificate upload
      table.jsonb('additional_services').nullable()
      table.string('certificate_url').nullable()

      // Step 2 — languages, portfolio gallery and sample price ranges
      table.jsonb('languages').nullable()
      table.jsonb('portfolio_images').nullable()
      table.jsonb('service_pricing').nullable()

      // Step 3 — booking availability window
      table.integer('minimum_lead_time_hours').unsigned().nullable()
      table.jsonb('weekly_schedule').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('additional_services')
      table.dropColumn('certificate_url')
      table.dropColumn('languages')
      table.dropColumn('portfolio_images')
      table.dropColumn('service_pricing')
      table.dropColumn('minimum_lead_time_hours')
      table.dropColumn('weekly_schedule')
    })
  }
}
