import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // penalty_type: 'dps' | 'gold' | null
      table.string('penalty_type', 10).nullable().defaultTo(null)
      // penalty_percent: 5, 10, 25, 50
      table.integer('penalty_percent').notNullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('penalty_type')
      table.dropColumn('penalty_percent')
    })
  }
}
