<template>
  <div class="min-h-screen bg-surface-base bg-grid-pattern px-5 pt-14 pb-28 relative overflow-hidden">

    <!-- Background orb -->
    <div class="orb-1 absolute top-[-100px] right-[-60px] w-[300px] h-[300px]
                rounded-full bg-brand-500/6 blur-3xl pointer-events-none" />

    <!-- Header -->
    <div class="fade-up-1 flex items-center justify-between mb-8">
      <div>
        <p class="text-ink-muted text-xs font-medium uppercase tracking-widest mb-0.5">
          Welcome back
        </p>
        <h1 class="text-xl font-semibold text-ink-primary">
          {{ firstName || 'User' }} 👋
        </h1>
      </div>
      <div class="w-10 h-10 rounded-full bg-brand-500/15 border border-brand-500/25
                  flex items-center justify-center shadow-glow-sm">
        <span class="text-brand-400 font-semibold text-sm font-mono">
          {{ initials || '?' }}
        </span>
      </div>
    </div>

    <!-- Balance card -->
    <div class="fade-up-2 glass-card p-5 mb-6 relative overflow-hidden">
      <div class="absolute top-0 right-0 w-32 h-32 rounded-full
                  bg-brand-500/5 blur-2xl pointer-events-none" />
      <p class="text-ink-muted text-xs font-medium uppercase tracking-widest mb-1">
        This month
      </p>
      <p class="text-3xl font-semibold text-ink-primary font-mono mb-1">
        ₹0.00
      </p>
      <p class="text-ink-muted text-xs">0 transactions verified</p>
      <div class="mt-4 h-px bg-slate-700/50"></div>
      <div class="flex gap-6 mt-4">
        <div>
          <p class="text-ink-muted text-xs mb-0.5">Sent</p>
          <p class="text-sm font-medium text-red-400 font-mono">₹0.00</p>
        </div>
        <div>
          <p class="text-ink-muted text-xs mb-0.5">Received</p>
          <p class="text-sm font-medium text-brand-400 font-mono">₹0.00</p>
        </div>
      </div>
    </div>

    <!-- Scan area -->
    <div class="fade-up-3 glass-card p-6 flex flex-col items-center">

      <!-- Scanner frame -->
      <div class="relative w-52 h-52 mb-6 flex items-center justify-center">
        <div class="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2
                    border-brand-500 rounded-tl-lg"></div>
        <div class="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2
                    border-brand-500 rounded-tr-lg"></div>
        <div class="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2
                    border-brand-500 rounded-bl-lg"></div>
        <div class="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2
                    border-brand-500 rounded-br-lg"></div>

        <div class="flex flex-col items-center gap-3 text-center">
          <div class="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20
                      flex items-center justify-center">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                 stroke="#14b8a6" stroke-width="1.5">
              <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z"/>
              <circle cx="12" cy="13" r="3"/>
            </svg>
          </div>
          <p class="text-ink-muted text-xs leading-relaxed">
            Tap below to scan<br/>a UPI receipt
          </p>
        </div>
      </div>

      <button
        class="btn-primary w-full max-w-[240px] flex items-center justify-center gap-2"
        @click="goToScan"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2">
          <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z"/>
          <circle cx="12" cy="13" r="3"/>
        </svg>
        Scan Receipt
      </button>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { navigateTo } from 'nuxt/app'
import { useAuthStore } from '../stores/auth'

definePageMeta({ middleware: ['auth'] })

const authStore = useAuthStore()

function goToScan() {
  navigateTo('/scan')
}

const firstName = computed(() => {
  const name = authStore.displayName || ''
  return name.split(' ')[0] || ''
})

const initials = computed(() => {
  const name = authStore.displayName || ''
  return name.split(' ')
    .map((n: string) => n?.[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
})
</script>