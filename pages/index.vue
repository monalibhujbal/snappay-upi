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
        ₹{{ totalAmount.toLocaleString('en-IN') }}
      </p>
      <p class="text-ink-muted text-xs">{{ txns.transactions.value.length }} transactions verified</p>
      <div class="mt-4 h-px bg-slate-700/50"></div>
      <div class="flex gap-6 mt-4">
        <div>
          <p class="text-ink-muted text-xs mb-0.5">Sent</p>
          <p class="text-sm font-medium text-red-400 font-mono">
            ₹{{ sentAmount.toLocaleString('en-IN') }}
          </p>
        </div>
        <div>
          <p class="text-ink-muted text-xs mb-0.5">Received</p>
          <p class="text-sm font-medium text-brand-400 font-mono">
            ₹{{ receivedAmount.toLocaleString('en-IN') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Recent transactions -->
    <div class="fade-up-3 mb-6">
      <div class="flex items-center justify-between mb-3">
        <p class="text-xs font-medium text-ink-muted uppercase tracking-widest">
          Recent
        </p>
        <NuxtLink to="/ledger"
          class="text-xs text-brand-400 hover:text-brand-500 transition-colors">
          View all
        </NuxtLink>
      </div>

      <!-- Loading -->
      <div v-if="txns.isLoading.value"
           class="glass-card p-8 flex items-center justify-center">
        <svg class="animate-spin w-6 h-6 text-ink-muted" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor"
                  stroke-width="2" stroke-dasharray="32" stroke-dashoffset="12"/>
        </svg>
      </div>

      <!-- Empty state -->
      <div v-else-if="txns.transactions.value.length === 0"
           class="glass-card p-8 flex flex-col items-center text-center">
        <div class="w-12 h-12 rounded-2xl bg-surface-input flex items-center
                    justify-center mb-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="#475569" stroke-width="1.5">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
          </svg>
        </div>
        <p class="text-ink-secondary text-sm font-medium mb-1">No transactions yet</p>
        <p class="text-ink-muted text-xs">Scan a receipt to get started</p>
      </div>

      <!-- Transaction list -->
      <div v-else class="space-y-2">
        <div
          v-for="txn in recentTransactions"
          :key="txn.id"
          class="glass-card px-4 py-3 flex items-center gap-3"
        >
          <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
               :class="txn.direction === 'sent'
                 ? 'bg-red-500/10'
                 : 'bg-brand-500/10'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 :stroke="txn.direction === 'sent' ? '#f87171' : '#14b8a6'"
                 stroke-width="2">
              <path v-if="txn.direction === 'sent'"
                    d="M12 19V5M5 12l7-7 7 7"/>
              <path v-else d="M12 5v14M19 12l-7 7-7-7"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-ink-primary truncate">
              {{ txn.merchantName || 'Unknown merchant' }}
            </p>
            <p class="text-xs text-ink-muted">{{ txn.transactionDate }}</p>
          </div>
          <div class="text-right flex-shrink-0">
            <p class="text-sm font-medium font-mono"
               :class="txn.direction === 'sent' ? 'text-red-400' : 'text-brand-400'">
              {{ txn.direction === 'sent' ? '-' : '+' }}₹{{ txn.amount.toLocaleString('en-IN') }}
            </p>
            <span class="text-xs px-2 py-0.5 rounded-full"
                  :class="txn.status === 'verified'
                    ? 'bg-brand-500/10 text-brand-400'
                    : txn.status === 'flagged'
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-slate-700/50 text-ink-muted'">
              {{ txn.status }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Scan button -->
    <div class="fade-up-3 glass-card p-6 flex flex-col items-center">
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
import { computed, onMounted } from 'vue'
import { navigateTo } from 'nuxt/app'
import { useAuthStore } from '../stores/auth'
import { useTransactions } from '~/composables/useTransactions'

definePageMeta({ middleware: ['auth'] })

const authStore = useAuthStore()
const txns      = useTransactions()

onMounted(() => {
  txns.startListening()
})

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

const recentTransactions = computed(() =>
  txns.transactions.value.slice(0, 5)
)

const totalAmount = computed(() =>
  txns.transactions.value.reduce((sum, t) => sum + (t.amount || 0), 0)
)

const sentAmount = computed(() =>
  txns.transactions.value
    .filter(t => t.direction === 'sent')
    .reduce((sum, t) => sum + (t.amount || 0), 0)
)

const receivedAmount = computed(() =>
  txns.transactions.value
    .filter(t => t.direction === 'received')
    .reduce((sum, t) => sum + (t.amount || 0), 0)
)
</script>