<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'

interface Option {
  value: any
  label: string
}

const props = defineProps<{
  modelValue: any
  options: Option[]
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

const isOpen = ref(false)
const selectRef = ref<HTMLElement | null>(null)

const selectedLabel = computed(() => {
  const opt = props.options.find((o) => o.value === props.modelValue)
  return opt?.label ?? props.placeholder ?? ''
})

function toggle() {
  isOpen.value = !isOpen.value
}

function select(value: any) {
  emit('update:modelValue', value)
  isOpen.value = false
}

function onClickOutside(e: MouseEvent) {
  if (selectRef.value && !selectRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div ref="selectRef" class="relative">
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 px-3 py-2 text-xs text-gray-300 shadow-md outline-none transition-all hover:border-slate-500 hover:shadow-lg"
      :class="{ 'border-blue-500 ring-1 ring-blue-500/30': isOpen }"
      @click="toggle"
    >
      <span class="truncate">{{ selectedLabel }}</span>
      <ChevronDown
        class="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <Transition name="dropdown">
      <div
        v-if="isOpen"
        class="absolute left-0 top-full z-50 mt-1 min-w-full overflow-hidden rounded-lg border border-slate-600 shadow-xl"
        style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"
      >
        <div class="max-h-60 overflow-y-auto py-1">
          <button
            v-for="opt in options"
            :key="String(opt.value)"
            type="button"
            class="flex w-full items-center px-3 py-2 text-left text-xs transition-colors"
            :class="opt.value === modelValue
              ? 'bg-blue-500/20 font-bold text-blue-400'
              : 'text-gray-300 hover:bg-slate-700/60 hover:text-white'"
            @click="select(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
