import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'species'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['tyradex_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.unique(['tyradex_id'])
    })
  }
}
