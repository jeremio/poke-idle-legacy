import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Configure aggressive autovacuum on user_pokemons to handle
    // the DELETE ALL + INSERT ALL pattern in savePokemons.
    // This prevents dead tuple bloat without any table locking.
    await this.db.rawQuery(`
      ALTER TABLE user_pokemons SET (
        autovacuum_vacuum_scale_factor = 0.02,
        autovacuum_vacuum_threshold = 50,
        autovacuum_analyze_scale_factor = 0.05,
        autovacuum_analyze_threshold = 50
      );
    `)
  }

  async down() {
    await this.db.rawQuery(`
      ALTER TABLE user_pokemons RESET (
        autovacuum_vacuum_scale_factor,
        autovacuum_vacuum_threshold,
        autovacuum_analyze_scale_factor,
        autovacuum_analyze_threshold
      );
    `)
  }
}
