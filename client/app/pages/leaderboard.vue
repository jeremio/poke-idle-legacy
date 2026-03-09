<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Trophy, Crown, ChevronDown } from 'lucide-vue-next'
import { useLocale } from '~/composables/useLocale'
import { useAuthStore } from '~/stores/useAuthStore'

const { t } = useLocale()
const auth = useAuthStore()
const API_BASE = useRuntimeConfig().public.apiBase

const GENERATION_NAMES: Record<number, string> = {
  1: 'Kanto',
  2: 'Johto',
  3: 'Hoenn',
  4: 'Sinnoh',
  5: 'Unova',
  6: 'Kalos',
  7: 'Alola',
  8: 'Galar',
  9: 'Paldea',
}

interface LeaderboardEntry {
  id: number
  username: string
  level: number
  badges: number
  gold: number
  current_generation: number
  total_pokemon: number
  unique_pokemon: number
  shiny_count: number
  legendary_count: number
  shiny_legendary_count: number
}

interface Category {
  id: string
  labelFr: string
  labelEn: string
  icon: string
  color: string
  gradient: string
  field: keyof LeaderboardEntry
  format: (val: number, entry: LeaderboardEntry) => string
}

const CATEGORIES: Category[] = [
  {
    id: 'level',
    labelFr: 'Niveau Dresseur',
    labelEn: 'Trainer Level',
    icon: '⭐',
    color: 'text-blue-400',
    gradient: 'from-blue-500/20 to-cyan-500/10',
    field: 'level',
    format: (val) => `Lv. ${val}`,
  },
  {
    id: 'gold',
    labelFr: 'Richesse',
    labelEn: 'Wealth',
    icon: '🪙',
    color: 'text-yellow-400',
    gradient: 'from-yellow-500/20 to-amber-500/10',
    field: 'gold',
    format: (val) => val.toLocaleString(),
  },
  {
    id: 'badges',
    labelFr: 'Badges',
    labelEn: 'Badges',
    icon: '🏅',
    color: 'text-amber-400',
    gradient: 'from-amber-500/20 to-orange-500/10',
    field: 'badges',
    format: (val, entry) => `${val} · ${GENERATION_NAMES[entry.current_generation] ?? '???'}`,
  },
  {
    id: 'unique_pokemon',
    labelFr: 'Pokédex',
    labelEn: 'Pokédex',
    icon: '📖',
    color: 'text-red-400',
    gradient: 'from-red-500/20 to-pink-500/10',
    field: 'unique_pokemon',
    format: (val) => `${val}`,
  },
  {
    id: 'total_pokemon',
    labelFr: 'Invocations',
    labelEn: 'Summons',
    icon: '✨',
    color: 'text-purple-400',
    gradient: 'from-purple-500/20 to-fuchsia-500/10',
    field: 'total_pokemon',
    format: (val) => val.toLocaleString(),
  },
  {
    id: 'shiny_count',
    labelFr: 'Shiny',
    labelEn: 'Shiny',
    icon: '💎',
    color: 'text-cyan-400',
    gradient: 'from-cyan-500/20 to-teal-500/10',
    field: 'shiny_count',
    format: (val) => `${val}`,
  },
  {
    id: 'legendary_count',
    labelFr: 'Légendaires',
    labelEn: 'Legendaries',
    icon: '🐉',
    color: 'text-orange-400',
    gradient: 'from-orange-500/20 to-red-500/10',
    field: 'legendary_count',
    format: (val) => `${val}`,
  },
  {
    id: 'shiny_legendary_count',
    labelFr: 'Légendaires Shiny',
    labelEn: 'Shiny Legendaries',
    icon: '👑',
    color: 'text-pink-400',
    gradient: 'from-pink-500/20 to-rose-500/10',
    field: 'shiny_legendary_count',
    format: (val) => `${val}`,
  },
]

const data = ref<LeaderboardEntry[]>([])
const loading = ref(true)
const error = ref(false)
const activeCategory = ref('level')
const expandedCategory = ref<string | null>(null)

const currentCategory = computed(() => CATEGORIES.find(c => c.id === activeCategory.value)!)

function getRanking(cat: Category): LeaderboardEntry[] {
  return [...data.value].sort((a, b) => (b[cat.field] as number) - (a[cat.field] as number))
}

const currentRanking = computed(() => getRanking(currentCategory.value))

const podium = computed(() => {
  const r = currentRanking.value
  if (r.length < 3) return null
  return { first: r[0], second: r[1], third: r[2] } as { first: LeaderboardEntry; second: LeaderboardEntry; third: LeaderboardEntry }
})

function getMedalClass(rank: number): string {
  if (rank === 0) return 'bg-gradient-to-br from-yellow-400 to-amber-500 text-yellow-900 shadow-lg shadow-yellow-500/30'
  if (rank === 1) return 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-800 shadow-lg shadow-slate-400/30'
  if (rank === 2) return 'bg-gradient-to-br from-amber-600 to-amber-700 text-amber-100 shadow-lg shadow-amber-600/30'
  return 'bg-slate-700/50 text-slate-400'
}

function getMedalEmoji(rank: number): string {
  if (rank === 0) return '🥇'
  if (rank === 1) return '🥈'
  if (rank === 2) return '🥉'
  return `${rank + 1}`
}

function isMe(entry: LeaderboardEntry): boolean {
  return auth.user?.id === entry.id
}

async function loadLeaderboard() {
  loading.value = true
  error.value = false
  try {
    const response = await fetch(`${API_BASE}/api/leaderboard`, { credentials: 'include' })
    if (response.ok) {
      data.value = await response.json()
    } else {
      error.value = true
    }
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

function toggleMobileCategory(id: string) {
  if (expandedCategory.value === id) {
    expandedCategory.value = null
  } else {
    expandedCategory.value = id
    activeCategory.value = id
  }
}

onMounted(loadLeaderboard)
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <!-- Header -->
    <div class="mb-6 text-center">
      <div class="mb-2 inline-flex items-center gap-2 rounded-full bg-yellow-500/10 px-4 py-1.5 text-yellow-400">
        <Trophy class="h-5 w-5" />
        <span class="text-sm font-bold">{{ t('Classement', 'Leaderboard') }}</span>
      </div>
      <h1 class="text-2xl font-bold text-white sm:text-3xl">{{ t('Hall of Fame', 'Hall of Fame') }}</h1>
      <p class="mt-1 text-xs text-slate-400">
        {{ t('Minimum 2 badges pour apparaître', 'Minimum 2 badges to appear') }}
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center gap-4 py-20">
      <div class="h-10 w-10 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent"></div>
      <p class="text-sm text-slate-400">{{ t('Chargement...', 'Loading...') }}</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-center">
      <p class="text-red-400">{{ t('Erreur de chargement', 'Loading error') }}</p>
      <button class="mt-3 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30" @click="loadLeaderboard">
        {{ t('Réessayer', 'Retry') }}
      </button>
    </div>

    <!-- Empty -->
    <div v-else-if="data.length === 0" class="rounded-xl border border-slate-700 bg-slate-800/50 p-12 text-center">
      <p class="text-4xl">🏆</p>
      <p class="mt-3 text-slate-400">{{ t('Aucun joueur éligible pour le moment', 'No eligible players yet') }}</p>
    </div>

    <!-- Leaderboard Content -->
    <div v-else>
      <!-- Desktop: Category tabs -->
      <div class="mb-6 hidden flex-wrap justify-center gap-2 sm:flex">
        <button
          v-for="cat in CATEGORIES"
          :key="cat.id"
          class="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all"
          :class="activeCategory === cat.id
            ? `border-transparent bg-gradient-to-r ${cat.gradient} ${cat.color} shadow-lg`
            : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-300'"
          @click="activeCategory = cat.id"
        >
          <span>{{ cat.icon }}</span>
          <span>{{ t(cat.labelFr, cat.labelEn) }}</span>
        </button>
      </div>

      <!-- Desktop: Main ranking table -->
      <div class="hidden sm:block">
        <div class="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50 shadow-xl">
          <!-- Category header -->
          <div class="border-b border-slate-700 bg-gradient-to-r px-6 py-4" :class="currentCategory.gradient">
            <div class="flex items-center gap-3">
              <span class="text-2xl">{{ currentCategory.icon }}</span>
              <div>
                <h2 class="text-lg font-bold text-white">{{ t(currentCategory.labelFr, currentCategory.labelEn) }}</h2>
                <p class="text-xs text-slate-400">{{ currentRanking.length }} {{ t('joueurs', 'players') }}</p>
              </div>
            </div>
          </div>

          <!-- Podium (top 3) -->
          <div v-if="podium" class="grid grid-cols-3 gap-4 border-b border-slate-700/50 px-6 py-6">
            <!-- 2nd place -->
            <div class="flex flex-col items-center gap-2 rounded-xl border border-slate-600/30 bg-slate-700/20 p-4">
              <div class="flex h-10 w-10 items-center justify-center rounded-full text-lg" :class="getMedalClass(1)">🥈</div>
              <span class="text-sm font-bold" :class="isMe(podium.second) ? 'text-yellow-300' : 'text-white'">
                {{ podium.second.username }}
              </span>
              <span class="text-lg font-bold" :class="currentCategory.color">
                {{ currentCategory.format(podium.second[currentCategory.field] as number, podium.second) }}
              </span>
            </div>
            <!-- 1st place -->
            <div class="flex flex-col items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 shadow-lg shadow-yellow-500/10">
              <div class="flex h-12 w-12 items-center justify-center rounded-full text-xl" :class="getMedalClass(0)">🥇</div>
              <Crown class="h-4 w-4 text-yellow-400" />
              <span class="text-sm font-bold" :class="isMe(podium.first) ? 'text-yellow-300' : 'text-white'">
                {{ podium.first.username }}
              </span>
              <span class="text-xl font-bold" :class="currentCategory.color">
                {{ currentCategory.format(podium.first[currentCategory.field] as number, podium.first) }}
              </span>
            </div>
            <!-- 3rd place -->
            <div class="flex flex-col items-center gap-2 rounded-xl border border-slate-600/30 bg-slate-700/20 p-4">
              <div class="flex h-10 w-10 items-center justify-center rounded-full text-lg" :class="getMedalClass(2)">🥉</div>
              <span class="text-sm font-bold" :class="isMe(podium.third) ? 'text-yellow-300' : 'text-white'">
                {{ podium.third.username }}
              </span>
              <span class="text-lg font-bold" :class="currentCategory.color">
                {{ currentCategory.format(podium.third[currentCategory.field] as number, podium.third) }}
              </span>
            </div>
          </div>

          <!-- Rest of ranking -->
          <div class="divide-y divide-slate-700/30">
            <div
              v-for="(entry, idx) in currentRanking"
              :key="entry.id"
              class="flex items-center gap-4 px-6 py-3 transition-colors"
              :class="[
                isMe(entry) ? 'bg-yellow-500/5' : 'hover:bg-slate-700/20',
                idx < 3 && podium ? 'sm:hidden' : ''
              ]"
            >
              <!-- Rank -->
              <div
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                :class="getMedalClass(idx)"
              >
                {{ getMedalEmoji(idx) }}
              </div>
              <!-- Username -->
              <div class="min-w-0 flex-1">
                <span
                  class="text-sm font-bold"
                  :class="isMe(entry) ? 'text-yellow-300' : 'text-white'"
                >
                  {{ entry.username }}
                  <span v-if="isMe(entry)" class="ml-1 text-[10px] text-yellow-500">({{ t('vous', 'you') }})</span>
                </span>
                <span class="ml-2 text-[10px] text-slate-500">
                  {{ GENERATION_NAMES[entry.current_generation] ?? '???' }} · Lv.{{ entry.level }}
                </span>
              </div>
              <!-- Value -->
              <span class="text-sm font-bold" :class="currentCategory.color">
                {{ currentCategory.format(entry[currentCategory.field] as number, entry) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile: Accordion style -->
      <div class="flex flex-col gap-3 sm:hidden">
        <div v-for="cat in CATEGORIES" :key="cat.id">
          <!-- Category header button -->
          <button
            class="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all"
            :class="expandedCategory === cat.id
              ? `border-transparent bg-gradient-to-r ${cat.gradient} shadow-lg`
              : 'border-slate-700 bg-slate-800/50'"
            @click="toggleMobileCategory(cat.id)"
          >
            <span class="text-lg">{{ cat.icon }}</span>
            <span class="flex-1 text-sm font-bold" :class="expandedCategory === cat.id ? cat.color : 'text-slate-300'">
              {{ t(cat.labelFr, cat.labelEn) }}
            </span>
            <!-- Quick top 1 preview -->
            <span v-if="getRanking(cat).length > 0 && expandedCategory !== cat.id" class="text-[10px] text-slate-500">
              🥇 {{ getRanking(cat)[0].username }}
            </span>
            <ChevronDown
              class="h-4 w-4 shrink-0 transition-transform"
              :class="[expandedCategory === cat.id ? 'rotate-180' : '', expandedCategory === cat.id ? cat.color : 'text-slate-500']"
            />
          </button>

          <!-- Expanded ranking -->
          <Transition name="accordion">
            <div v-if="expandedCategory === cat.id" class="mt-1 overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/30">
              <div
                v-for="(entry, idx) in getRanking(cat).slice(0, 20)"
                :key="entry.id"
                class="flex items-center gap-3 border-b border-slate-700/20 px-4 py-2.5 last:border-b-0"
                :class="isMe(entry) ? 'bg-yellow-500/5' : ''"
              >
                <div
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  :class="getMedalClass(idx)"
                >
                  {{ getMedalEmoji(idx) }}
                </div>
                <div class="min-w-0 flex-1">
                  <span class="text-xs font-bold" :class="isMe(entry) ? 'text-yellow-300' : 'text-white'">
                    {{ entry.username }}
                  </span>
                </div>
                <span class="text-xs font-bold" :class="cat.color">
                  {{ cat.format(entry[cat.field] as number, entry) }}
                </span>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.accordion-enter-active,
.accordion-leave-active {
  transition: all 0.25s ease;
  max-height: 600px;
}
.accordion-enter-from,
.accordion-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
