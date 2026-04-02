<template>
  <div class="flex flex-col min-h-screen px-4 pt-12">

    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-xl font-semibold text-white">
          Hey {{ firstName }} 👋
        </h1>
        <p class="text-slate-400 text-sm mt-0.5">
          Scan a receipt to verify
        </p>
      </div>
      <div class="w-10 h-10 rounded-full bg-brand-500/10
                  flex items-center justify-center">
        <span class="text-brand-500 font-semibold text-sm">
          {{ initials }}
        </span>
      </div>
    </div>

    <!-- Scan button — placeholder for Phase 2 -->
    <div class="flex-1 flex flex-col items-center justify-center
                gap-6">
      <div class="w-48 h-48 rounded-3xl border-2 border-dashed
                  border-slate-600 flex items-center justify-center
                  text-slate-600 text-sm">
        Camera coming in Phase 2
      </div>
      <button class="btn-primary px-8">
        Scan Receipt
      </button>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useAuthStore } from '../stores/auth'

definePageMeta({ middleware: ['auth'] })

const authStore = useAuthStore()

const firstName = computed(() => {
  const name = authStore.displayName || ''
  return name.split(' ')[0] || ''
})

const initials = computed(() => {
  const name = authStore.displayName || ''
  return name.split(' ')
    .map((n: string) => n ? n[0] : '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
})
</script>