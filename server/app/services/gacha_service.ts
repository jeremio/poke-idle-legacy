import crypto from 'node:crypto'
import { BANNERS, RARITY_WEIGHTS } from './gacha_data.js'
import type { Banner, GachaPokemon, Rarity } from './gacha_data.js'

// Base shiny rate: 1/8192 (like the original games)
const BASE_SHINY_RATE = 1 / 8192

/**
 * Compute effective shiny rate based on shiny charms and pokedex master bonus.
 * Each shiny charm adds +0.5× base rate. Pokedex master: ×3 on top.
 */
function getShinyRate(shinyCharms: number, pokedexMaster: boolean): number {
  const base = BASE_SHINY_RATE * (1 + shinyCharms * 0.5)
  return pokedexMaster ? base * 3 : base
}

/** Cryptographically secure random float in [0, 1) */
function secureRandom(): number {
  const buf = crypto.randomBytes(4)
  return buf.readUInt32BE(0) / 0x100000000
}

export interface PullResult {
  pokemon: GachaPokemon
  isShiny: boolean
}

/**
 * Draw one Pokémon from a banner pool using server-side RNG.
 * Uses crypto.randomBytes for tamper-proof randomness.
 */
export function pullFromBanner(
  banner: Banner,
  shinyCharms: number = 0,
  pokedexMaster: boolean = false
): PullResult {
  // Group pool by rarity
  const byRarity = new Map<Rarity, GachaPokemon[]>()
  for (const p of banner.pool) {
    const arr = byRarity.get(p.rarity) ?? []
    arr.push(p)
    byRarity.set(p.rarity, arr)
  }

  // Weighted rarity roll
  const totalWeight = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0)
  let roll = secureRandom() * totalWeight
  let selectedRarity: Rarity = 'common'

  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS) as [Rarity, number][]) {
    roll -= weight
    if (roll <= 0) {
      selectedRarity = rarity
      break
    }
  }

  // Pick random candidate from selected rarity (fallback to common → full pool)
  const candidates = byRarity.get(selectedRarity) ?? byRarity.get('common') ?? banner.pool
  const pokemon = candidates[Math.floor(secureRandom() * candidates.length)]!

  // Shiny check
  const isShiny = secureRandom() < getShinyRate(shinyCharms, pokedexMaster)

  return { pokemon, isShiny }
}

/**
 * Find a banner by its ID. Returns undefined if not found.
 */
export function getBannerById(bannerId: string): Banner | undefined {
  return BANNERS.find((b) => b.id === bannerId)
}

export { BANNERS } from './gacha_data.js'
