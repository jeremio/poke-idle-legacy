<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Swords, Trophy, Search, Check, X, Clock, User, Shield, Eye, Zap, Crown, Target, TrendingUp, Coins } from 'lucide-vue-next'
import { usePlayerStore } from '~/stores/usePlayerStore'
import { useAuthStore } from '~/stores/useAuthStore'
import { useInventoryStore } from '~/stores/useInventoryStore'
import { useLocale } from '~/composables/useLocale'
import { TYPES, getEffectiveness } from '~/data/types'
import type { PokemonType } from '~/data/types'

definePageMeta({ layout: 'game' })

const player = usePlayerStore()
const auth = useAuthStore()
const inventory = useInventoryStore()
const { t } = useLocale()
const config = useRuntimeConfig()
const API = config.public.apiBase

// ── State ──
type Tab = 'arena' | 'leaderboard' | 'history'
const activeTab = ref<Tab>('arena')
const loading = ref(false)
const searchQuery = ref('')

// Players
const onlinePlayers = ref<any[]>([])
const allPlayers = ref<any[]>([])
const showAllPlayers = ref(false)

// Challenges
const receivedChallenges = ref<any[]>([])
const sentChallenges = ref<any[]>([])

// Leaderboard
const pvpLeaderboard = ref<any[]>([])

// History
const matchHistory = ref<any[]>([])

// Challenge modal
const showChallengeModal = ref(false)
const challengeTarget = ref<any>(null)
const betAmount = ref(1000)

// Team selection modal
const showTeamModal = ref(false)
const teamModalMode = ref<'challenge' | 'accept'>('challenge')
const acceptingChallengeId = ref<number | null>(null)
const challengeBoss = ref<{ slug: string; nameFr: string; nameEn: string; types: string[]; generation: number } | null>(null)
const selectedTeam = ref<number[]>([])
const teamSearch = ref('')
const teamSort = ref<'level' | 'stars' | 'name'>('level')
const teamRarity = ref<string | null>(null)

// Match result modal
const showMatchResult = ref(false)
const matchResult = ref<any>(null)
const animationProgress = ref(0)
const animationDone = ref(false)

// Notifications
const pvpNotifications = ref<{ id: string; type: 'win' | 'lose' | 'draw' | 'declined' | 'expired'; text: string; matchId?: number }[]>([])
const seenResultIds = ref<Set<number>>(new Set())

// Polling
let pollInterval: ReturnType<typeof setInterval> | null = null

function getAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return `${API}/api/avatars/${path.split('/').pop()}`
}

// ── API Calls ──
async function fetchPlayers() {
  try {
    const [onlineRes, allRes] = await Promise.all([
      fetch(`${API}/api/pvp/players`, { credentials: 'include' }),
      fetch(`${API}/api/pvp/all-players`, { credentials: 'include' }),
    ])
    if (onlineRes.ok) onlinePlayers.value = await onlineRes.json()
    if (allRes.ok) allPlayers.value = await allRes.json()
  } catch { /* ignore */ }
}

async function fetchChallenges() {
  try {
    const res = await fetch(`${API}/api/pvp/challenges`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      receivedChallenges.value = data.received
      sentChallenges.value = data.sent

      // Sync gold from server
      if (typeof data.gold === 'number') player.gold = data.gold

      // Process recent results into notifications
      if (data.recentResults) {
        for (const r of data.recentResults) {
          if (seenResultIds.value.has(r.id)) continue
          seenResultIds.value.add(r.id)
          const myId = auth.user?.id
          if (r.status === 'completed' && r.match) {
            const won = r.match.winnerId === myId
            const draw = r.match.winnerId === null
            pvpNotifications.value.unshift({
              id: `result-${r.id}`,
              type: draw ? 'draw' : won ? 'win' : 'lose',
              text: draw
                ? t(`Match nul contre ${r.challengedName} ! Mise remboursée.`, `Draw vs ${r.challengedName}! Bet refunded.`)
                : won
                  ? t(`Victoire contre ${r.challengedName} ! +${formatGold(r.betAmount * 2)} 🪙`, `Victory vs ${r.challengedName}! +${formatGold(r.betAmount * 2)} 🪙`)
                  : t(`Défaite contre ${r.challengedName}. -${formatGold(r.betAmount)} 🪙`, `Defeat vs ${r.challengedName}. -${formatGold(r.betAmount)} 🪙`),
              matchId: r.match.matchId,
            })
          } else if (r.status === 'declined') {
            pvpNotifications.value.unshift({
              id: `declined-${r.id}`,
              type: 'declined',
              text: t(`${r.challengedName} a refusé votre défi. Mise remboursée.`, `${r.challengedName} declined your challenge. Bet refunded.`),
            })
          } else if (r.status === 'expired') {
            pvpNotifications.value.unshift({
              id: `expired-${r.id}`,
              type: 'expired',
              text: t(`Défi contre ${r.challengedName} expiré. Mise remboursée.`, `Challenge vs ${r.challengedName} expired. Bet refunded.`),
            })
          }
        }
        // Keep only last 10 notifications
        if (pvpNotifications.value.length > 10) pvpNotifications.value.length = 10
      }
    }
  } catch { /* ignore */ }
}

function dismissNotification(id: string) {
  pvpNotifications.value = pvpNotifications.value.filter((n) => n.id !== id)
}

async function fetchLeaderboard() {
  try {
    const res = await fetch(`${API}/api/pvp/leaderboard`, { credentials: 'include' })
    if (res.ok) pvpLeaderboard.value = await res.json()
  } catch { /* ignore */ }
}

async function fetchHistory() {
  try {
    const res = await fetch(`${API}/api/pvp/history`, { credentials: 'include' })
    if (res.ok) matchHistory.value = await res.json()
  } catch { /* ignore */ }
}

async function loadAll() {
  loading.value = true
  await Promise.all([fetchPlayers(), fetchChallenges(), fetchLeaderboard(), fetchHistory()])
  loading.value = false
}

// ── Helpers ──
function toSlugs(clientIds: number[]): string[] {
  return clientIds.map(cid => {
    const p = inventory.collection.find(pk => pk.id === cid)
    return p?.slug ?? ''
  }).filter(s => s !== '')
}

// ── Challenge Flow ──
function openChallengeModal(target: any) {
  challengeTarget.value = target
  betAmount.value = Math.min(1000, Math.floor(player.gold * 0.1))
  showChallengeModal.value = true
}

async function confirmChallenge() {
  showChallengeModal.value = false
  // Fetch pre-picked boss before team selection
  try {
    const res = await fetch(`${API}/api/pvp/preview-boss`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengedId: challengeTarget.value.id }),
    })
    if (res.ok) {
      challengeBoss.value = await res.json()
    } else {
      challengeBoss.value = null
    }
  } catch {
    challengeBoss.value = null
  }
  teamModalMode.value = 'challenge'
  selectedTeam.value = []
  showTeamModal.value = true
}

async function sendChallenge() {
  if (selectedTeam.value.length !== 6) return
  try {
    const res = await fetch(`${API}/api/pvp/challenge`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengedId: challengeTarget.value.id,
        betAmount: betAmount.value,
        team: toSlugs(selectedTeam.value),
        bossSlug: challengeBoss.value?.slug ?? undefined,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      if (typeof data.gold === 'number') player.gold = data.gold
      showTeamModal.value = false
      await fetchChallenges()
    } else {
      alert(data.message || 'Erreur')
    }
  } catch {
    alert(t('Erreur réseau', 'Network error'))
  }
}

function openAcceptModal(challenge: any) {
  acceptingChallengeId.value = challenge.id
  challengeBoss.value = challenge.boss ?? null
  teamModalMode.value = 'accept'
  selectedTeam.value = []
  showTeamModal.value = true
}

async function acceptChallenge() {
  if (selectedTeam.value.length !== 6 || !acceptingChallengeId.value) return
  try {
    const res = await fetch(`${API}/api/pvp/challenge/${acceptingChallengeId.value}/accept`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team: toSlugs(selectedTeam.value) }),
    })
    const data = await res.json()
    if (res.ok) {
      if (typeof data.gold === 'number') player.gold = data.gold
      showTeamModal.value = false
      // Load match result and show animation
      await loadMatchResult(data.matchId)
      await fetchChallenges()
      await fetchHistory()
    } else {
      alert(data.message || 'Erreur')
    }
  } catch {
    alert(t('Erreur réseau', 'Network error'))
  }
}

async function declineChallenge(id: number) {
  try {
    await fetch(`${API}/api/pvp/challenge/${id}/decline`, {
      method: 'POST',
      credentials: 'include',
    })
    await fetchChallenges()
  } catch { /* ignore */ }
}

async function loadMatchResult(matchId: number) {
  try {
    const res = await fetch(`${API}/api/pvp/match/${matchId}`, { credentials: 'include' })
    if (res.ok) {
      matchResult.value = await res.json()
      showMatchResult.value = true
      animationProgress.value = 0
      animationDone.value = false
      startAnimation()
    }
  } catch { /* ignore */ }
}

function startAnimation() {
  const duration = 4000 // 4 seconds animation
  const start = Date.now()
  const animate = () => {
    const elapsed = Date.now() - start
    animationProgress.value = Math.min(1, elapsed / duration)
    if (animationProgress.value < 1) {
      requestAnimationFrame(animate)
    } else {
      animationDone.value = true
    }
  }
  requestAnimationFrame(animate)
}

function toggleTeamPokemon(pokemonId: number) {
  const idx = selectedTeam.value.indexOf(pokemonId)
  if (idx >= 0) {
    selectedTeam.value.splice(idx, 1)
  } else if (selectedTeam.value.length < 6) {
    selectedTeam.value.push(pokemonId)
  }
}

// ── Computed ──
const filteredPlayers = computed(() => {
  const list = showAllPlayers.value ? allPlayers.value : onlinePlayers.value
  if (!searchQuery.value) return list
  const q = searchQuery.value.toLowerCase()
  return list.filter((p: any) => p.username.toLowerCase().includes(q))
})

const maxBet = computed(() => Math.floor(player.gold * 0.5))

const pvpUnlocked = computed(() => player.badges >= 13)

const sortedCollection = computed(() => {
  let list = [...inventory.collection]

  if (teamSearch.value) {
    const q = teamSearch.value.toLowerCase()
    list = list.filter((p) => p.nameFr.toLowerCase().includes(q) || p.nameEn.toLowerCase().includes(q))
  }

  if (teamRarity.value) {
    list = list.filter((p) => p.rarity === teamRarity.value)
  }

  // Always put current team members first
  list.sort((a, b) => {
    if (a.teamSlot !== null && b.teamSlot === null) return -1
    if (a.teamSlot === null && b.teamSlot !== null) return 1
    switch (teamSort.value) {
      case 'stars': return b.stars - a.stars || b.level - a.level
      case 'name': return a.nameFr.localeCompare(b.nameFr)
      default: return b.level - a.level
    }
  })

  return list
})

function getWinRate(entry: any): string {
  if (entry.total_matches === 0) return '0%'
  return `${Math.round((entry.wins / entry.total_matches) * 100)}%`
}

function isMe(id: number): boolean {
  return auth.user?.id === id
}

function formatGold(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

function getSuperEffectiveTypes(bossTypes: string[]): { id: PokemonType; mult: number }[] {
  const normalized = bossTypes.map((bt) => bt.toLowerCase() as PokemonType)
  const results: { id: PokemonType; mult: number }[] = []
  for (const atkType of TYPES) {
    let mult = 1
    for (const defType of normalized) {
      mult *= getEffectiveness(atkType.id, defType)
    }
    if (mult > 1) results.push({ id: atkType.id, mult })
  }
  results.sort((a, b) => b.mult - a.mult)
  return results
}

function getTypeColor(typeId: string): string {
  return TYPES.find((t2) => t2.id === typeId.toLowerCase())?.color ?? '#6B7280'
}

function getTypeName(typeId: string): string {
  const info = TYPES.find((t2) => t2.id === typeId.toLowerCase())
  return info ? t(info.nameFr, info.nameEn) : typeId
}

function getSpriteUrl(slug: string): string {
  return `https://play.pokemonshowdown.com/sprites/ani/${slug}.gif`
}

function getShinySpriteUrl(slug: string): string {
  return `https://play.pokemonshowdown.com/sprites/ani-shiny/${slug}.gif`
}

// ── Lifecycle ──
onMounted(() => {
  if (auth.isAuthenticated && pvpUnlocked.value) {
    loadAll()
    pollInterval = setInterval(() => {
      fetchChallenges()
      fetchPlayers()
    }, 15000)
  }
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/20">
          <Swords class="h-6 w-6 text-red-400" />
        </div>
        <div>
          <h1 class="text-2xl font-bold">{{ t('Arène PvP', 'PvP Arena') }}</h1>
          <p class="text-sm text-slate-400">{{ t('Combats 1v1 — Pariez et affrontez !', '1v1 Battles — Bet and fight!') }}</p>
        </div>
      </div>
    </div>

    <!-- Locked state -->
    <div v-if="!pvpUnlocked" class="flex flex-col items-center gap-4 rounded-xl border border-slate-700/50 bg-slate-800/50 p-12 text-center">
      <Shield class="h-16 w-16 text-slate-600" />
      <h2 class="text-xl font-bold text-slate-300">{{ t('PvP verrouillé', 'PvP Locked') }}</h2>
      <p class="max-w-md text-sm text-slate-400">
        {{ t('Complétez Kanto (13 badges) pour débloquer l\'arène PvP !', 'Complete Kanto (13 badges) to unlock the PvP arena!') }}
      </p>
      <div class="flex items-center gap-2 text-sm text-slate-500">
        <Trophy class="h-4 w-4" />
        {{ player.badges }}/13 {{ t('badges', 'badges') }}
      </div>
    </div>

    <!-- Main content -->
    <template v-else>
      <!-- Tabs -->
      <div class="flex gap-1 rounded-xl bg-slate-800/50 p-1">
        <button
          v-for="tab in ([
            { id: 'arena', labelFr: '⚔️ Arène', labelEn: '⚔️ Arena' },
            { id: 'leaderboard', labelFr: '🏆 Classement', labelEn: '🏆 Leaderboard' },
            { id: 'history', labelFr: '📜 Historique', labelEn: '📜 History' },
          ] as const)"
          :key="tab.id"
          class="flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-all"
          :class="activeTab === tab.id
            ? 'bg-slate-700 text-white shadow'
            : 'text-slate-400 hover:text-slate-200'"
          @click="activeTab = tab.id"
        >
          {{ t(tab.labelFr, tab.labelEn) }}
        </button>
      </div>

      <!-- ═══ NOTIFICATIONS ═══ -->
      <div v-if="pvpNotifications.length > 0" class="space-y-2">
        <div
          v-for="notif in pvpNotifications"
          :key="notif.id"
          class="flex items-center justify-between rounded-lg px-4 py-3 text-sm font-bold"
          :class="{
            'border border-green-500/30 bg-green-500/10 text-green-400': notif.type === 'win',
            'border border-red-500/30 bg-red-500/10 text-red-400': notif.type === 'lose',
            'border border-amber-500/30 bg-amber-500/10 text-amber-400': notif.type === 'draw',
            'border border-slate-500/30 bg-slate-500/10 text-slate-400': notif.type === 'declined' || notif.type === 'expired',
          }"
        >
          <div class="flex items-center gap-2">
            <span>{{ notif.type === 'win' ? '🏆' : notif.type === 'lose' ? '💀' : notif.type === 'draw' ? '🤝' : '📨' }}</span>
            <span>{{ notif.text }}</span>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="notif.matchId"
              class="rounded bg-slate-700 px-2 py-1 text-xs text-white transition-colors hover:bg-slate-600"
              @click="loadMatchResult(notif.matchId!)"
            >
              {{ t('Voir', 'View') }}
            </button>
            <button
              class="text-slate-500 transition-colors hover:text-white"
              @click="dismissNotification(notif.id)"
            >
              <X class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- ═══ ARENA TAB ═══ -->
      <div v-if="activeTab === 'arena'" class="space-y-6">
        <!-- Pending challenges received -->
        <div v-if="receivedChallenges.length > 0" class="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <h3 class="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-red-400">
            <Swords class="h-4 w-4" />
            {{ t('Défis reçus', 'Received Challenges') }}
            <span class="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{{ receivedChallenges.length }}</span>
          </h3>
          <div class="space-y-2">
            <div
              v-for="c in receivedChallenges"
              :key="c.id"
              class="flex items-center justify-between rounded-lg bg-slate-800/80 px-4 py-3"
            >
              <div class="flex items-center gap-3">
                <div class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-indigo-500/20">
                  <img v-if="c.challengerAvatarUrl" :src="getAvatarUrl(c.challengerAvatarUrl)!" alt="" class="h-full w-full object-cover" />
                  <User v-else class="h-4 w-4 text-indigo-400" />
                </div>
                <div>
                  <span class="font-bold text-white">{{ c.challengerName }}</span>
                  <span class="ml-2 text-xs text-slate-400">Lv.{{ c.challengerLevel }}</span>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div v-if="c.boss" class="flex items-center gap-2">
                  <img :src="getSpriteUrl(c.boss.slug)" class="h-8 w-8 object-contain" alt="" />
                  <div class="flex flex-col">
                    <span class="text-xs font-bold text-slate-200">{{ t(c.boss.nameFr, c.boss.nameEn) }}</span>
                    <div class="flex gap-0.5">
                      <span
                        v-for="bt in (c.boss.types || [])"
                        :key="bt"
                        class="rounded px-1 py-px text-[9px] font-bold text-white"
                        :style="{ backgroundColor: getTypeColor(bt) }"
                      >{{ getTypeName(bt) }}</span>
                    </div>
                    <div v-if="c.boss.types?.length" class="mt-0.5 flex items-center gap-0.5">
                      <Zap class="h-2.5 w-2.5 text-green-400" />
                      <span
                        v-for="se in getSuperEffectiveTypes(c.boss.types).slice(0, 4)"
                        :key="se.id"
                        class="rounded px-0.5 text-[8px] font-bold text-white/80"
                        :style="{ backgroundColor: getTypeColor(se.id) }"
                      >{{ getTypeName(se.id) }}</span>
                    </div>
                  </div>
                </div>
                <span class="flex items-center gap-1 text-sm font-bold text-yellow-400"><Coins class="h-3.5 w-3.5" /> {{ formatGold(c.betAmount) }}</span>
                <button
                  class="rounded-lg bg-green-600/20 px-3 py-1.5 text-xs font-bold text-green-400 transition-colors hover:bg-green-600/30"
                  @click="openAcceptModal(c)"
                >
                  <Check class="mr-1 inline h-3 w-3" />{{ t('Accepter', 'Accept') }}
                </button>
                <button
                  class="rounded-lg bg-red-600/20 px-3 py-1.5 text-xs font-bold text-red-400 transition-colors hover:bg-red-600/30"
                  @click="declineChallenge(c.id)"
                >
                  <X class="mr-1 inline h-3 w-3" />{{ t('Refuser', 'Decline') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Sent challenges -->
        <div v-if="sentChallenges.length > 0" class="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
          <h3 class="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
            <Clock class="h-4 w-4" />
            {{ t('Défis envoyés', 'Sent Challenges') }}
          </h3>
          <div class="space-y-2">
            <div
              v-for="c in sentChallenges"
              :key="c.id"
              class="flex items-center justify-between rounded-lg bg-slate-800/80 px-4 py-3"
            >
              <div class="flex items-center gap-3">
                <div class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-indigo-500/20">
                  <img v-if="c.challengedAvatarUrl" :src="getAvatarUrl(c.challengedAvatarUrl)!" alt="" class="h-full w-full object-cover" />
                  <User v-else class="h-4 w-4 text-indigo-400" />
                </div>
                <span class="font-bold text-white">{{ c.challengedName }}</span>
                <span class="text-xs text-slate-400">Lv.{{ c.challengedLevel }}</span>
              </div>
              <div class="flex items-center gap-2">
                <div v-if="c.boss" class="flex items-center gap-2">
                  <img :src="getSpriteUrl(c.boss.slug)" class="h-8 w-8 object-contain" alt="" />
                  <div class="flex flex-col">
                    <span class="text-xs font-bold text-slate-200">{{ t(c.boss.nameFr, c.boss.nameEn) }}</span>
                    <div class="flex gap-0.5">
                      <span
                        v-for="bt in (c.boss.types || [])"
                        :key="bt"
                        class="rounded px-1 py-px text-[9px] font-bold text-white"
                        :style="{ backgroundColor: getTypeColor(bt) }"
                      >{{ getTypeName(bt) }}</span>
                    </div>
                  </div>
                </div>
                <span class="flex items-center gap-1 text-sm font-bold text-yellow-400"><Coins class="h-3.5 w-3.5" /> {{ formatGold(c.betAmount) }}</span>
                <span class="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400"><Clock class="h-3 w-3" /> {{ t('En attente', 'Pending') }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Player list -->
        <div class="rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden">
          <div class="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
            <h3 class="text-sm font-bold uppercase tracking-wider text-slate-300">
              {{ t('Joueurs disponibles', 'Available Players') }}
            </h3>
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1.5 rounded-lg bg-slate-700/50 px-3 py-1.5">
                <Search class="h-3.5 w-3.5 text-slate-400" />
                <input
                  v-model="searchQuery"
                  type="text"
                  :placeholder="t('Rechercher...', 'Search...')"
                  class="w-24 bg-transparent text-xs text-white outline-none placeholder:text-slate-500 sm:w-40"
                />
              </div>
              <button
                class="rounded-lg px-2 py-1 text-xs transition-colors"
                :class="showAllPlayers ? 'bg-indigo-600/30 text-indigo-400' : 'bg-slate-700/50 text-slate-400 hover:text-white'"
                @click="showAllPlayers = !showAllPlayers"
              >
                {{ showAllPlayers ? t('En ligne', 'Online') : t('Tous', 'All') }}
              </button>
            </div>
          </div>
          <div v-if="filteredPlayers.length === 0" class="flex items-center justify-center py-8 text-sm text-slate-500">
            {{ t('Aucun joueur trouvé', 'No players found') }}
          </div>
          <div v-else class="divide-y divide-slate-700/30 max-h-96 overflow-y-auto">
            <div
              v-for="p in filteredPlayers"
              :key="p.id"
              class="flex items-center justify-between px-4 py-3 transition-colors hover:bg-slate-700/20"
            >
              <div class="flex items-center gap-3">
                <div class="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-indigo-500/20">
                  <img v-if="p.avatarUrl" :src="getAvatarUrl(p.avatarUrl)!" alt="" class="h-full w-full object-cover" />
                  <User v-else class="h-4 w-4 text-indigo-400" />
                </div>
                <div>
                  <span class="font-bold text-white">{{ p.username }}</span>
                  <div class="flex items-center gap-2 text-xs text-slate-400">
                    <span>Lv.{{ p.level }}</span>
                    <span>·</span>
                    <span>{{ p.badges }} 🏅</span>
                  </div>
                </div>
              </div>
              <button
                class="flex items-center gap-1.5 rounded-lg bg-red-600/20 px-3 py-1.5 text-xs font-bold text-red-400 transition-all hover:bg-red-600/30"
                @click="openChallengeModal(p)"
              >
                <Swords class="h-3 w-3" />
                {{ t('Défier', 'Challenge') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ LEADERBOARD TAB ═══ -->
      <div v-if="activeTab === 'leaderboard'" class="rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden">
        <div class="border-b border-slate-700/50 px-4 py-3">
          <h3 class="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-300">
            <Trophy class="h-4 w-4 text-yellow-400" />
            {{ t('Classement PvP', 'PvP Ranking') }}
          </h3>
        </div>
        <div v-if="pvpLeaderboard.length === 0" class="flex items-center justify-center py-12 text-sm text-slate-500">
          {{ t('Aucun combat PvP pour le moment', 'No PvP matches yet') }}
        </div>
        <div v-else class="divide-y divide-slate-700/30">
          <div
            v-for="(entry, idx) in pvpLeaderboard"
            :key="entry.id"
            class="flex items-center gap-4 px-4 py-3 transition-colors"
            :class="isMe(entry.id) ? 'bg-yellow-500/5' : 'hover:bg-slate-700/20'"
          >
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-black"
              :class="idx === 0 ? 'bg-yellow-500/30 text-yellow-400' : idx === 1 ? 'bg-slate-400/20 text-slate-300' : idx === 2 ? 'bg-amber-600/20 text-amber-500' : 'bg-slate-700/50 text-slate-400'"
            >
              <img v-if="entry.avatar_url" :src="getAvatarUrl(entry.avatar_url)!" alt="" class="h-full w-full object-cover" />
              <template v-else>{{ idx + 1 }}</template>
            </div>
            <div class="min-w-0 flex-1">
              <span class="text-sm font-bold" :class="isMe(entry.id) ? 'text-yellow-300' : 'text-white'">
                {{ entry.username }}
                <span v-if="isMe(entry.id)" class="ml-1 text-[10px] text-yellow-500">({{ t('vous', 'you') }})</span>
              </span>
              <div class="flex items-center gap-2 text-xs text-slate-400">
                <span>Lv.{{ entry.level }}</span>
                <span>·</span>
                <span class="text-green-400">{{ entry.wins }}W</span>
                <span class="text-red-400">{{ entry.losses }}L</span>
                <span v-if="entry.draws > 0" class="text-slate-500">{{ entry.draws }}D</span>
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm font-bold text-yellow-400">{{ getWinRate(entry) }}</div>
              <div class="text-[10px] text-slate-500">{{ entry.total_matches }} {{ t('combats', 'matches') }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ HISTORY TAB ═══ -->
      <div v-if="activeTab === 'history'" class="rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden">
        <div class="border-b border-slate-700/50 px-4 py-3">
          <h3 class="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-300">
            📜 {{ t('Historique des combats', 'Match History') }}
          </h3>
        </div>
        <div v-if="matchHistory.length === 0" class="flex items-center justify-center py-12 text-sm text-slate-500">
          {{ t('Aucun combat pour le moment', 'No matches yet') }}
        </div>
        <div v-else class="divide-y divide-slate-700/30">
          <div
            v-for="m in matchHistory"
            :key="m.id"
            class="flex items-center justify-between px-4 py-3 transition-colors hover:bg-slate-700/20 cursor-pointer"
            @click="loadMatchResult(m.id)"
          >
            <div class="flex items-center gap-3">
              <div
                class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-black"
                :class="m.winnerId === auth.user?.id ? 'bg-green-500/20 text-green-400' : m.winnerId === null ? 'bg-slate-500/20 text-slate-400' : 'bg-red-500/20 text-red-400'"
              >
                {{ m.winnerId === auth.user?.id ? 'W' : m.winnerId === null ? 'D' : 'L' }}
              </div>
              <div>
                <span class="text-sm font-bold text-white">
                  {{ m.player1.username }} <span class="text-slate-500">vs</span> {{ m.player2.username }}
                </span>
                <div class="flex items-center gap-2 text-xs text-slate-400">
                  <span>🪙 {{ formatGold(m.betAmount) }}</span>
                  <span>·</span>
                  <span>{{ m.bossNameFr }}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-500">{{ new Date(m.createdAt).toLocaleDateString() }}</span>
              <Eye class="h-3.5 w-3.5 text-slate-500" />
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ═══ CHALLENGE MODAL ═══ -->
    <teleport to="body">
      <div
        v-if="showChallengeModal && challengeTarget"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        @click="showChallengeModal = false"
      >
        <div class="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl" @click.stop>
          <h3 class="mb-4 text-lg font-bold text-white">
            ⚔️ {{ t('Défier', 'Challenge') }} {{ challengeTarget.username }}
          </h3>
          <div class="space-y-4">
            <div>
              <label class="mb-1 block text-sm text-slate-400">{{ t('Mise (pokédollars)', 'Bet (pokédollars)') }}</label>
              <input
                v-model.number="betAmount"
                type="number"
                :min="100"
                :max="maxBet"
                class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-red-500"
              />
              <p class="mt-1 text-xs text-slate-500">
                Min: 100 · Max: {{ formatGold(maxBet) }} (50%)
              </p>
            </div>
            <div class="flex gap-2">
              <button
                class="flex-1 rounded-lg bg-red-600 px-4 py-2 font-bold text-white transition-colors hover:bg-red-700"
                @click="confirmChallenge"
              >
                {{ t('Choisir mon équipe', 'Choose my team') }}
              </button>
              <button
                class="rounded-lg bg-slate-700 px-4 py-2 font-bold text-slate-300 transition-colors hover:bg-slate-600"
                @click="showChallengeModal = false"
              >
                {{ t('Annuler', 'Cancel') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ═══ TEAM SELECTION MODAL ═══ -->
    <teleport to="body">
      <div
        v-if="showTeamModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        @click="showTeamModal = false"
      >
        <div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl" @click.stop>
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-lg font-bold text-white">
              {{ t('Sélectionnez 6 Pokémon', 'Select 6 Pokémon') }}
            </h3>
            <span class="text-sm font-bold" :class="selectedTeam.length === 6 ? 'text-green-400' : 'text-slate-400'">
              {{ selectedTeam.length }}/6
            </span>
          </div>

          <!-- Boss preview -->
          <div
            v-if="challengeBoss"
            class="mb-4 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/5 px-4 py-3"
          >
            <div class="relative">
              <img :src="getSpriteUrl(challengeBoss.slug)" class="h-16 w-16 object-contain drop-shadow-lg" alt="" />
              <Target class="absolute -right-1 -top-1 h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p class="text-sm font-bold text-amber-300">
                <Target class="mr-1 inline h-3.5 w-3.5" />{{ t('Boss :', 'Boss:') }} {{ t(challengeBoss.nameFr, challengeBoss.nameEn) }}
              </p>
              <div class="mt-1 flex items-center gap-1">
                <span
                  v-for="btype in (challengeBoss.types || [])"
                  :key="btype"
                  class="rounded px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm"
                  :style="{ backgroundColor: getTypeColor(btype) }"
                >
                  {{ getTypeName(btype) }}
                </span>
                <span class="ml-1 text-[10px] text-slate-500">Gen {{ challengeBoss.generation }}</span>
              </div>
              <div v-if="challengeBoss.types?.length" class="mt-1.5 flex flex-wrap items-center gap-1">
                <span class="text-[10px] font-bold text-green-400"><Zap class="mr-0.5 inline h-3 w-3" />{{ t('Efficace :', 'Effective:') }}</span>
                <span
                  v-for="se in getSuperEffectiveTypes(challengeBoss.types).slice(0, 6)"
                  :key="se.id"
                  class="rounded px-1 py-px text-[9px] font-bold text-white"
                  :style="{ backgroundColor: getTypeColor(se.id) }"
                >{{ getTypeName(se.id) }} ×{{ se.mult }}</span>
              </div>
            </div>
          </div>

          <!-- Selected team preview -->
          <div class="mb-4 flex gap-2">
            <div
              v-for="i in 6"
              :key="i"
              class="flex h-14 w-14 items-center justify-center rounded-lg border-2 transition-all"
              :class="selectedTeam[i-1]
                ? 'border-red-500/50 bg-red-500/10'
                : 'border-dashed border-slate-600 bg-slate-800'"
            >
              <template v-if="selectedTeam[i-1]">
                <img
                  :src="(() => {
                    const p = inventory.collection.find(pk => pk.id === selectedTeam[i-1])
                    return p ? (p.isShiny ? getShinySpriteUrl(p.slug) : getSpriteUrl(p.slug)) : ''
                  })()"
                  class="h-10 w-10 object-contain"
                  alt=""
                />
              </template>
              <span v-else class="text-xs text-slate-600">{{ i }}</span>
            </div>
          </div>

          <!-- Search + filters -->
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <div class="relative flex-1 min-w-[140px]">
              <Search class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                v-model="teamSearch"
                type="text"
                :placeholder="t('Rechercher...', 'Search...')"
                class="w-full rounded-lg border border-slate-600 bg-slate-700 py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 outline-none focus:border-red-500"
              />
            </div>
            <select
              v-model="teamSort"
              class="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white focus:border-red-500 focus:outline-none"
            >
              <option value="level">{{ t('Niveau', 'Level') }}</option>
              <option value="stars">{{ t('Étoiles', 'Stars') }}</option>
              <option value="name">{{ t('Nom', 'Name') }}</option>
            </select>
            <select
              v-model="teamRarity"
              class="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white focus:border-red-500 focus:outline-none"
            >
              <option :value="null">{{ t('Toutes raretés', 'All rarities') }}</option>
              <option value="legendary">{{ t('Légendaire', 'Legendary') }}</option>
              <option value="epic">{{ t('Épique', 'Epic') }}</option>
              <option value="rare">{{ t('Rare', 'Rare') }}</option>
              <option value="uncommon">{{ t('Peu commun', 'Uncommon') }}</option>
              <option value="common">{{ t('Commun', 'Common') }}</option>
            </select>
          </div>

          <!-- Pokemon grid -->
          <div class="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 md:grid-cols-5">
            <button
              v-for="poke in sortedCollection"
              :key="poke.id"
              class="flex flex-col items-center gap-1 rounded-lg border p-2 transition-all"
              :class="selectedTeam.includes(poke.id)
                ? 'border-red-500 bg-red-500/10'
                : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'"
              @click="toggleTeamPokemon(poke.id)"
            >
              <img
                :src="poke.isShiny ? getShinySpriteUrl(poke.slug) : getSpriteUrl(poke.slug)"
                class="h-10 w-10 object-contain"
                alt=""
              />
              <span class="text-[10px] font-bold text-white truncate w-full text-center">{{ poke.nameFr }}</span>
              <div class="flex items-center gap-1 text-[9px] text-slate-400">
                <span>Lv.{{ poke.level }}</span>
                <span v-if="poke.isShiny" class="text-yellow-400">✨</span>
              </div>
            </button>
          </div>

          <!-- Confirm -->
          <div class="mt-4 flex gap-2">
            <button
              class="flex-1 rounded-lg px-4 py-2.5 font-bold text-white transition-colors"
              :class="selectedTeam.length === 6 ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-700 cursor-not-allowed opacity-50'"
              :disabled="selectedTeam.length !== 6"
              @click="teamModalMode === 'challenge' ? sendChallenge() : acceptChallenge()"
            >
              {{ teamModalMode === 'challenge' ? t('Envoyer le défi !', 'Send challenge!') : t('Combattre !', 'Fight!') }}
            </button>
            <button
              class="rounded-lg bg-slate-700 px-4 py-2.5 font-bold text-slate-300 hover:bg-slate-600"
              @click="showTeamModal = false"
            >
              {{ t('Annuler', 'Cancel') }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ═══ MATCH RESULT MODAL ═══ -->
    <teleport to="body">
      <div
        v-if="showMatchResult && matchResult"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        @click="animationDone ? (showMatchResult = false) : null"
      >
        <div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/50 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl" @click.stop>
          <!-- Boss header -->
          <div class="relative overflow-hidden rounded-t-2xl border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 via-slate-800 to-slate-800/50 px-6 py-5">
            <div class="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent"></div>
            <div class="relative flex items-center justify-center gap-4">
              <div class="relative">
                <img :src="getSpriteUrl(matchResult.boss.slug)" class="h-20 w-20 object-contain drop-shadow-[0_0_12px_rgba(251,191,36,0.3)]" alt="" />
              </div>
              <div class="text-left">
                <div class="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <Target class="h-3 w-3" /> {{ t('Boss PvP', 'PvP Boss') }}
                </div>
                <h3 class="text-xl font-black text-white">{{ t(matchResult.boss.nameFr, matchResult.boss.nameEn) }}</h3>
                <div class="mt-1.5 flex items-center gap-1.5">
                  <span
                    v-for="btype in (matchResult.boss.types || [])"
                    :key="btype"
                    class="rounded-md px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"
                    :style="{ backgroundColor: getTypeColor(btype) }"
                  >{{ getTypeName(btype) }}</span>
                  <span class="rounded-md bg-slate-700/50 px-2 py-0.5 text-[10px] font-bold text-slate-400">Gen {{ matchResult.boss.generation }}</span>
                </div>
                <div v-if="matchResult.boss.types?.length" class="mt-1 flex flex-wrap items-center gap-1">
                  <span class="text-[9px] font-bold text-green-400"><Zap class="mr-0.5 inline h-2.5 w-2.5" />{{ t('Efficace :', 'Effective:') }}</span>
                  <span
                    v-for="se in getSuperEffectiveTypes(matchResult.boss.types).slice(0, 5)"
                    :key="se.id"
                    class="rounded px-1 py-px text-[8px] font-bold text-white/80"
                    :style="{ backgroundColor: getTypeColor(se.id) }"
                  >{{ getTypeName(se.id) }} ×{{ se.mult }}</span>
                </div>
              </div>
            </div>
            <!-- Bet amount -->
            <div class="absolute right-4 top-4 flex items-center gap-1.5 rounded-lg bg-yellow-500/10 px-3 py-1.5 text-sm font-bold text-yellow-400">
              <Coins class="h-4 w-4" /> {{ formatGold(matchResult.betAmount) }}
            </div>
          </div>

          <div class="p-6">
            <!-- VS Section with damage bars -->
            <div class="space-y-3">
              <!-- Player 1 -->
              <div class="rounded-xl border border-slate-700/50 bg-slate-800/30 p-3">
                <div class="mb-2 flex items-center justify-between">
                  <div class="flex items-center gap-2.5">
                    <div class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full" :class="matchResult.winnerId === matchResult.player1.id ? 'ring-2 ring-green-500 bg-green-500/20' : 'bg-blue-500/20'">
                      <img v-if="matchResult.player1.avatarUrl" :src="getAvatarUrl(matchResult.player1.avatarUrl)!" alt="" class="h-full w-full object-cover" />
                      <User v-else class="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <span class="text-sm font-bold" :class="matchResult.winnerId === matchResult.player1.id ? 'text-green-400' : 'text-white'">
                        {{ matchResult.player1.username }}
                      </span>
                      <Crown v-if="matchResult.winnerId === matchResult.player1.id" class="ml-1 inline h-4 w-4 text-yellow-400" />
                    </div>
                  </div>
                  <div class="text-right">
                    <span class="text-lg font-black tabular-nums" :class="matchResult.winnerId === matchResult.player1.id ? 'text-green-400' : 'text-blue-400'">
                      {{ animationDone ? matchResult.player1.damage.toLocaleString() : Math.floor(matchResult.player1.damage * animationProgress).toLocaleString() }}
                    </span>
                    <span class="ml-1 text-[10px] text-slate-500">DMG</span>
                  </div>
                </div>
                <div class="h-3 overflow-hidden rounded-full bg-slate-900/50">
                  <div
                    class="h-full rounded-full transition-all duration-100"
                    :class="matchResult.winnerId === matchResult.player1.id ? 'bg-gradient-to-r from-green-600 to-green-400' : 'bg-gradient-to-r from-blue-600 to-blue-400'"
                    :style="{
                      width: `${Math.min(100, (matchResult.player1.damage / Math.max(matchResult.player1.damage, matchResult.player2.damage)) * 100 * animationProgress)}%`
                    }"
                  ></div>
                </div>
              </div>

              <!-- VS badge -->
              <div class="flex items-center justify-center">
                <div class="rounded-full bg-slate-800 px-4 py-1 text-xs font-black text-slate-500">VS</div>
              </div>

              <!-- Player 2 -->
              <div class="rounded-xl border border-slate-700/50 bg-slate-800/30 p-3">
                <div class="mb-2 flex items-center justify-between">
                  <div class="flex items-center gap-2.5">
                    <div class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full" :class="matchResult.winnerId === matchResult.player2.id ? 'ring-2 ring-green-500 bg-green-500/20' : 'bg-red-500/20'">
                      <img v-if="matchResult.player2.avatarUrl" :src="getAvatarUrl(matchResult.player2.avatarUrl)!" alt="" class="h-full w-full object-cover" />
                      <User v-else class="h-4 w-4 text-red-400" />
                    </div>
                    <div>
                      <span class="text-sm font-bold" :class="matchResult.winnerId === matchResult.player2.id ? 'text-green-400' : 'text-white'">
                        {{ matchResult.player2.username }}
                      </span>
                      <Crown v-if="matchResult.winnerId === matchResult.player2.id" class="ml-1 inline h-4 w-4 text-yellow-400" />
                    </div>
                  </div>
                  <div class="text-right">
                    <span class="text-lg font-black tabular-nums" :class="matchResult.winnerId === matchResult.player2.id ? 'text-green-400' : 'text-red-400'">
                      {{ animationDone ? matchResult.player2.damage.toLocaleString() : Math.floor(matchResult.player2.damage * animationProgress).toLocaleString() }}
                    </span>
                    <span class="ml-1 text-[10px] text-slate-500">DMG</span>
                  </div>
                </div>
                <div class="h-3 overflow-hidden rounded-full bg-slate-900/50">
                  <div
                    class="h-full rounded-full transition-all duration-100"
                    :class="matchResult.winnerId === matchResult.player2.id ? 'bg-gradient-to-r from-green-600 to-green-400' : 'bg-gradient-to-r from-red-600 to-red-400'"
                    :style="{
                      width: `${Math.min(100, (matchResult.player2.damage / Math.max(matchResult.player1.damage, matchResult.player2.damage)) * 100 * animationProgress)}%`
                    }"
                  ></div>
                </div>
              </div>
            </div>

            <!-- Result banner -->
            <div v-if="animationDone" class="mt-5">
              <div
                class="rounded-xl border px-4 py-3 text-center"
                :class="matchResult.winnerId === null
                  ? 'border-slate-500/30 bg-slate-500/10'
                  : matchResult.winnerId === auth.user?.id
                    ? 'border-green-500/30 bg-green-500/10'
                    : 'border-red-500/30 bg-red-500/10'"
              >
                <div v-if="matchResult.winnerId === null" class="text-lg font-black text-slate-300">
                  {{ t('Égalité !', 'Draw!') }}
                  <div class="mt-0.5 text-xs font-normal text-slate-400">{{ t('Mises remboursées', 'Bets refunded') }}</div>
                </div>
                <div v-else-if="matchResult.winnerId === auth.user?.id" class="text-lg font-black text-green-400">
                  <TrendingUp class="mr-1 inline h-5 w-5" /> {{ t('Victoire !', 'Victory!') }}
                  <div class="mt-0.5 flex items-center justify-center gap-1 text-sm font-bold text-green-300">
                    <Coins class="h-4 w-4" /> +{{ formatGold(matchResult.betAmount * 2) }}
                  </div>
                </div>
                <div v-else class="text-lg font-black text-red-400">
                  {{ t('Défaite...', 'Defeat...') }}
                  <div class="mt-0.5 flex items-center justify-center gap-1 text-sm font-bold text-red-300">
                    <Coins class="h-4 w-4" /> -{{ formatGold(matchResult.betAmount) }}
                  </div>
                </div>
              </div>

              <!-- Team details -->
              <div class="mt-4 grid grid-cols-2 gap-3">
                <div
                  v-for="(side, sideKey) in { player1: matchResult.player1, player2: matchResult.player2 }"
                  :key="sideKey"
                  class="rounded-xl border border-slate-700/30 bg-slate-800/20 p-3"
                >
                  <p class="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-400">
                    <Swords class="h-3 w-3" /> {{ side.username }}
                  </p>
                  <div class="grid grid-cols-3 gap-1.5">
                    <div
                      v-for="poke in side.team"
                      :key="poke.pokemonId"
                      class="flex flex-col items-center rounded-lg p-1.5 transition-colors"
                      :class="poke.typeMult > 1 ? 'bg-green-900/20 ring-1 ring-green-500/20' : poke.typeMult < 1 ? 'bg-red-900/20 ring-1 ring-red-500/20' : 'bg-slate-800/50'"
                      :title="`${poke.nameFr} — Base: ${poke.dps} × ${poke.typeMult} = ${poke.effectiveDps} DPS`"
                    >
                      <img
                        :src="poke.isShiny ? getShinySpriteUrl(poke.slug) : getSpriteUrl(poke.slug)"
                        class="h-9 w-9 object-contain"
                        alt=""
                      />
                      <span class="mt-0.5 w-full truncate text-center text-[8px] font-bold text-slate-300">{{ poke.nameFr }}</span>
                      <div class="flex items-center gap-0.5">
                        <span class="text-[9px] font-black tabular-nums" :class="poke.typeMult > 1 ? 'text-green-400' : poke.typeMult < 1 ? 'text-red-400' : 'text-slate-500'">
                          {{ poke.effectiveDps }}
                        </span>
                        <span v-if="poke.typeMult !== 1" class="text-[8px] font-bold" :class="poke.typeMult > 1 ? 'text-green-500' : 'text-red-500'">
                          ×{{ poke.typeMult }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                class="mt-5 w-full rounded-xl bg-slate-700/50 px-6 py-2.5 font-bold text-white transition-colors hover:bg-slate-700"
                @click="showMatchResult = false"
              >
                {{ t('Fermer', 'Close') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>
