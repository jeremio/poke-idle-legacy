<script setup lang="ts">
import { X, AlertTriangle, UserPlus } from 'lucide-vue-next'
import { useLocale } from '~/composables/useLocale'

const { t } = useLocale()

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
  createAccount: []
}>()

function close() {
  emit('close')
}

function goToRegister() {
  emit('createAccount')
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        @click.self="close"
      >
        <div class="relative w-full max-w-md rounded-xl border border-amber-500/30 bg-gray-900 p-6 shadow-2xl">
          <button
            class="absolute right-4 top-4 text-gray-400 transition-colors hover:text-white"
            @click="close"
          >
            <X class="h-5 w-5" />
          </button>

          <div class="mb-4 flex items-center gap-3">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
              <AlertTriangle class="h-6 w-6 text-amber-400" />
            </div>
            <h2 class="text-xl font-bold text-white">
              {{ t('Mode Invité', 'Guest Mode') }}
            </h2>
          </div>

          <div class="space-y-3 text-sm text-gray-300">
            <p>
              {{ t(
                'Vous jouez actuellement en mode invité. Vos données sont sauvegardées localement dans votre navigateur.',
                'You are currently playing in guest mode. Your data is saved locally in your browser.'
              ) }}
            </p>

            <div class="rounded-lg bg-amber-900/30 border border-amber-500/30 p-3">
              <p class="font-semibold text-amber-400">
                {{ t('⚠️ Limitations du mode invité :', '⚠️ Guest mode limitations:') }}
              </p>
              <ul class="mt-2 space-y-1 text-xs">
                <li>• {{ t('Données stockées uniquement sur cet appareil', 'Data stored only on this device') }}</li>
                <li>• {{ t('Impossible de jouer sur plusieurs appareils', 'Cannot play on multiple devices') }}</li>
                <li>• {{ t('Perte des données si vous nettoyez le cache du navigateur', 'Data loss if you clear browser cache') }}</li>
              </ul>
            </div>

            <div class="rounded-lg bg-red-900/30 border border-red-500/30 p-3">
              <p class="font-semibold text-red-400">
                {{ t('❌ Important', '❌ Important') }}
              </p>
              <p class="mt-1 text-xs">
                {{ t(
                  'Si vous créez un compte plus tard, vos données actuelles ne pourront PAS être transférées.',
                  'If you create an account later, your current data CANNOT be transferred.'
                ) }}
              </p>
            </div>

            <p class="text-center text-xs text-gray-400">
              {{ t(
                'Pour sauvegarder vos données en ligne et jouer sur plusieurs appareils, créez un compte dès maintenant.',
                'To save your data online and play on multiple devices, create an account now.'
              ) }}
            </p>
          </div>

          <div class="mt-6 flex gap-3">
            <button
              class="flex-1 rounded-lg bg-gray-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-gray-600"
              @click="close"
            >
              {{ t('Continuer en invité', 'Continue as guest') }}
            </button>
            <button
              class="flex-1 flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-amber-400"
              @click="goToRegister"
            >
              <UserPlus class="h-4 w-4" />
              {{ t('Créer un compte', 'Create account') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
