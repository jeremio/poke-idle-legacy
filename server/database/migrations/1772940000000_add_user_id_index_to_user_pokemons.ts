import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('user_pokemons', (table) => {
      // Critical index: every save does DELETE + SELECT WHERE user_id = ?
      // Without this, Postgres does a sequential scan on the entire table
      table.index(['user_id'], 'idx_user_pokemons_user_id')
    })

    this.schema.alterTable('species', (table) => {
      // Used by getSpeciesCache and Species.findBy('slug', ...)
      table.index(['slug'], 'idx_species_slug')
    })
  }

  async down() {
    this.schema.alterTable('user_pokemons', (table) => {
      table.dropIndex(['user_id'], 'idx_user_pokemons_user_id')
    })

    this.schema.alterTable('species', (table) => {
      table.dropIndex(['slug'], 'idx_species_slug')
    })
  }
}
