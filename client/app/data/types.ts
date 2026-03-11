import POKEMON_TYPES_RAW from '../../../shared/pokemon-types.json'

export type PokemonType =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug'
  | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy'

export interface TypeInfo {
  id: PokemonType
  nameEn: string
  nameFr: string
  color: string
}

export const TYPES: TypeInfo[] = [
  { id: 'normal', nameEn: 'Normal', nameFr: 'Normal', color: '#A8A878' },
  { id: 'fire', nameEn: 'Fire', nameFr: 'Feu', color: '#F08030' },
  { id: 'water', nameEn: 'Water', nameFr: 'Eau', color: '#6890F0' },
  { id: 'electric', nameEn: 'Electric', nameFr: 'Électrik', color: '#F8D030' },
  { id: 'grass', nameEn: 'Grass', nameFr: 'Plante', color: '#78C850' },
  { id: 'ice', nameEn: 'Ice', nameFr: 'Glace', color: '#98D8D8' },
  { id: 'fighting', nameEn: 'Fighting', nameFr: 'Combat', color: '#C03028' },
  { id: 'poison', nameEn: 'Poison', nameFr: 'Poison', color: '#A040A0' },
  { id: 'ground', nameEn: 'Ground', nameFr: 'Sol', color: '#E0C068' },
  { id: 'flying', nameEn: 'Flying', nameFr: 'Vol', color: '#A890F0' },
  { id: 'psychic', nameEn: 'Psychic', nameFr: 'Psy', color: '#F85888' },
  { id: 'bug', nameEn: 'Bug', nameFr: 'Insecte', color: '#A8B820' },
  { id: 'rock', nameEn: 'Rock', nameFr: 'Roche', color: '#B8A038' },
  { id: 'ghost', nameEn: 'Ghost', nameFr: 'Spectre', color: '#705898' },
  { id: 'dragon', nameEn: 'Dragon', nameFr: 'Dragon', color: '#7038F8' },
  { id: 'dark', nameEn: 'Dark', nameFr: 'Ténèbres', color: '#705848' },
  { id: 'steel', nameEn: 'Steel', nameFr: 'Acier', color: '#B8B8D0' },
  { id: 'fairy', nameEn: 'Fairy', nameFr: 'Fée', color: '#EE99AC' },
]

export function getTypeInfo(type: PokemonType): TypeInfo {
  return TYPES.find((t) => t.id === type)!
}

// Type effectiveness chart — only non-1.0 multipliers stored
const CHART: Partial<Record<PokemonType, Partial<Record<PokemonType, number>>>> = {
  normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice:      { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground:   { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug:      { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy:    { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
}

export function getEffectiveness(attacker: PokemonType, defender: PokemonType): number {
  return CHART[attacker]?.[defender] ?? 1
}

// Calcul effectiveness contre plusieurs types défenseurs (multiplicatif comme dans Pokémon)
export function getTypeEffectiveness(attackerType: PokemonType, defenderTypes: PokemonType[]): number {
  return defenderTypes.reduce((mult, defType) => {
    return mult * getEffectiveness(attackerType, defType)
  }, 1.0)
}

// ── Slug → PokemonType mapping ──────────────────────────────────────
// Source unique : shared/pokemon-types.json
const POKEMON_TYPES = POKEMON_TYPES_RAW as unknown as Record<string, PokemonType | [PokemonType, PokemonType]>

export function getPokemonType(slug: string): PokemonType {
  const types = POKEMON_TYPES[slug] ?? 'normal'
  return Array.isArray(types) ? types[0] : types
}

export function getPokemonTypes(slug: string): PokemonType[] {
  const types = POKEMON_TYPES[slug] ?? 'normal'
  return Array.isArray(types) ? types : [types]
}
