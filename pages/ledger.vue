<template>
  <div class="min-h-screen bg-surface-base px-5 pt-14 pb-28 relative overflow-hidden">

    <div class="orb-1 absolute top-[-100px] right-[-60px] w-[300px] h-[300px]
                rounded-full bg-brand-500/6 blur-3xl pointer-events-none" />

    <div class="fade-up-1 flex items-center justify-between mb-6">
      <div>
        <p class="text-ink-muted text-xs font-medium uppercase tracking-widest mb-0.5">
          All transactions
        </p>
        <h1 class="text-xl font-semibold text-ink-primary">Ledger</h1>
      </div>
      <div class="text-xs text-ink-muted bg-surface-card border border-slate-700/60
                  px-3 py-1.5 rounded-xl">
        {{ txns.transactions.value.length }} total
      </div>
    </div>

    <div class="fade-up-2 flex gap-2 mb-5 overflow-x-auto pb-1">
      <button
        v-for="f in filters"
        :key="f.value"
        class="flex-shrink-0 text-xs font-medium px-4 py-2 rounded-xl
               border transition-all duration-200"
        :class="activeFilter === f.value
          ? 'bg-brand-500/15 border-brand-500/40 text-brand-400'
          : 'bg-surface-card border-slate-700/60 text-ink-muted hover:text-ink-primary'"
        @click="activeFilter = f.value"
      >
        {{ f.label }}
      </button>
    </div>

    <div v-if="txns.isLoading.value"
         class="flex items-center justify-center py-20">
      <svg class="animate-spin w-6 h-6 text-ink-muted" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor"
                stroke-width="2" stroke-dasharray="32" stroke-dashoffset="12"/>
      </svg>
    </div>

    <div v-else-if="filteredTransactions.length === 0"
         class="fade-up-3 flex flex-col items-center justify-center py-20 text-center">
      <div class="w-14 h-14 rounded-2xl bg-surface-input flex items-center
                  justify-center mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
             stroke="#475569" stroke-width="1.5">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
        </svg>
      </div>
      <p class="text-ink-secondary text-sm font-medium mb-1">No transactions found</p>
      <p class="text-ink-muted text-xs">Try a different filter</p>
    </div>

    <div v-else class="fade-up-3 space-y-2">
      <div
        v-for="txn in filteredTransactions"
        :key="txn.id"
        class="glass-card px-4 py-4"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
               :class="txn.direction === 'sent'
                 ? 'bg-red-500/10'
                 : 'bg-brand-500/10'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 :stroke="txn.direction === 'sent' ? '#f87171' : '#0ea5e9'"
                 stroke-width="2">
              <path v-if="txn.direction === 'sent'"
                    d="M12 19V5M5 12l7-7 7 7"/>
              <path v-else d="M12 5v14M19 12l-7 7-7-7"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm font-medium text-ink-primary truncate">
                {{ txn.merchantName || 'Unknown merchant' }}
              </p>
              <span class="text-xs px-1.5 py-0.5 rounded bg-surface-input border border-[color:var(--border-color)] flex items-center gap-1.5 text-[10px] font-medium text-ink-secondary">
                <UiCategoryIcon :category="txn.category || categorizeMerchant(txn.merchantName || '', txn.ocrRawText || '')" size="sm" class="!p-0 !bg-transparent w-3.5 h-3.5" />
                <span>{{ txn.category || categorizeMerchant(txn.merchantName || '', txn.ocrRawText || '') }}</span>
              </span>
            </div>
            <p class="text-xs text-ink-muted mt-0.5">{{ txn.transactionDate }}</p>
          </div>
          <div class="text-right flex-shrink-0">
            <p class="text-sm font-semibold font-mono"
               :class="txn.direction === 'sent' ? 'text-red-400' : 'text-brand-400'">
              {{ txn.direction === 'sent' ? '-' : '+' }}₹{{ uiStore.privacyMode ? '••••' : txn.amount.toLocaleString('en-IN') }}
            </p>
          </div>
        </div>

        <div class="mt-3 pt-3 border-t border-[color:var(--border-color)] flex items-center
                    justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <span class="text-xs px-2 py-0.5 rounded-full"
                  :class="getStatusDetails(txn.status).class">
              {{ getStatusDetails(txn.status).label }}
            </span>
            <span class="text-xs px-2 py-0.5 rounded-full bg-surface-input text-ink-muted">
              {{ txn.direction }}
            </span>
            <span v-if="txn.statementUrl" class="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">
              Statement Verified
            </span>
          </div>
          <div class="flex items-center gap-3 ml-auto">
            <a v-if="txn.statementUrl" :href="txn.statementUrl" target="_blank"
               class="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              View Statement
            </a>
            <p class="text-xs text-ink-muted font-mono truncate max-w-[120px]">
              {{ txn.upiId || txn.transactionId || 'No ID' }}
            </p>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTransactions } from '~/composables/useTransactions'
import { useUIStore } from '../stores/ui'
import { getCategoryIcon, getCategoryColor, categorizeMerchant } from '~/composables/useCategoryHelper'

definePageMeta({ middleware: ['auth'] })

const txns = useTransactions()
const uiStore = useUIStore()

const filters = [
  { label: 'All',      value: 'all'      },
  { label: 'Sent',     value: 'sent'     },
  { label: 'Received', value: 'received' },
  { label: 'Flagged',  value: 'flagged'  },
  { label: 'Statement Verified', value: 'statement' },
]

const activeFilter = ref('all')

onMounted(() => {
  txns.startListening()
})

const filteredTransactions = computed(() => {
  if (activeFilter.value === 'all') return txns.transactions.value
  if (activeFilter.value === 'flagged') {
    return txns.transactions.value.filter(t => t.status === 'flagged')
  }
  if (activeFilter.value === 'statement') {
    return txns.transactions.value.filter(t => !!t.statementUrl)
  }
  return txns.transactions.value.filter(t => t.direction === activeFilter.value)
})

function getStatusDetails(status: string) {
  switch (status) {
    case 'verified':
      return {
        label: 'Verified',
        class: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold'
      }
    case 'verified_manual':
      return {
        label: 'Verified (Manual)',
        class: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold'
      }
    case 'flagged':
      return {
        label: 'Flagged',
        class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold'
      }
    case 'pending':
      return {
        label: 'Pending',
        class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold'
      }
    case 'failed':
      return {
        label: 'Failed',
        class: 'bg-red-500/10 text-red-600 dark:text-red-400 font-semibold'
      }
    default:
      return {
        label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown',
        class: 'bg-surface-input text-ink-secondary font-medium'
      }
  }
}
</script>
