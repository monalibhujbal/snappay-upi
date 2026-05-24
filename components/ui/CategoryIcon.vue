<template>
  <div class="flex items-center justify-center flex-shrink-0" :class="sizeClass">
    <span class="rounded-full border border-slate-300/30 dark:border-slate-800/80 shadow-sm transition-all duration-300" :class="[dotColorClass, dotSizeClass]" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    category?: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    category: 'Others',
    size: 'md'
  }
)

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'w-6 h-6'
    case 'lg': return 'w-10 h-10'
    default: return 'w-8 h-8'
  }
})

const dotSizeClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'w-3 h-3'
    case 'lg': return 'w-5.5 h-5.5'
    default: return 'w-4 h-4'
  }
})

const dotColorClass = computed(() => {
  switch (props.category) {
    case 'Food & Dining': return 'bg-orange-500'
    case 'Groceries': return 'bg-emerald-500'
    case 'Shopping': return 'bg-pink-500'
    case 'Transport & Travel': return 'bg-sky-500'
    case 'Bills & Utilities': return 'bg-indigo-500'
    case 'Entertainment': return 'bg-violet-500'
    case 'Medical & Healthcare': return 'bg-rose-500'
    default: return 'bg-slate-500'
  }
})
</script>
