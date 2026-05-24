<template>
  <div class="min-h-screen bg-surface-base bg-grid-pattern pb-24 px-4 pt-6 transition-colors duration-300">
    <!-- Header -->
    <div class="fade-up-1 flex items-center justify-between mb-5">
      <div>
        <h1 class="text-2xl font-bold text-ink-primary tracking-tight">Analytics</h1>
        <!-- Connectivity Status Indicator -->
        <div class="flex items-center gap-2 mt-1">
          <span class="relative flex h-2 w-2">
            <span
              class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              :class="isOnline ? 'bg-emerald-400' : 'bg-amber-400'"
            ></span>
            <span
              class="relative inline-flex rounded-full h-2 w-2"
              :class="isOnline ? 'bg-emerald-500' : 'bg-amber-500'"
            ></span>
          </span>
          <span class="text-[10px] font-medium" :class="isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'">
            {{ isOnline ? 'Cloud Sync Enabled' : 'Offline Mode (Local DB Caching)' }}
          </span>
        </div>
      </div>
      
      <!-- Theme Switcher -->
      <button
        @click="toggleTheme"
        class="w-10 h-10 rounded-xl bg-surface-card border border-slate-200/50 dark:border-slate-800/80 flex items-center justify-center text-base hover:bg-surface-input active:scale-95 transition-all shadow-sm text-ink-secondary hover:text-ink-primary"
        aria-label="Toggle Dark Mode"
      >
        <!-- Light Mode Icon (Sun) -->
        <svg v-if="isDark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-amber-400">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
        <!-- Dark Mode Icon (Moon) -->
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      </button>
    </div>

    <!-- Summary KPI Grid -->
    <div class="fade-up-2 grid grid-cols-2 gap-4 mb-5">
      <div class="glass-card p-4 flex flex-col justify-between hover:border-slate-300/40 dark:hover:border-slate-700/60 transition-all">
        <span class="text-[10px] text-ink-muted uppercase font-bold tracking-wider">Total Expenses</span>
        <div class="mt-2">
          <p class="text-xl font-bold text-red-500 font-mono tracking-tight">₹{{ uiStore.privacyMode ? '••••' : sentAmount.toLocaleString('en-IN') }}</p>
          <p class="text-[10px] text-ink-secondary mt-0.5 font-medium">{{ sentCount }} transactions</p>
        </div>
      </div>
      <div class="glass-card p-4 flex flex-col justify-between hover:border-slate-300/40 dark:hover:border-slate-700/60 transition-all">
        <span class="text-[10px] text-ink-muted uppercase font-bold tracking-wider">Total Inflow</span>
        <div class="mt-2">
          <p class="text-xl font-bold text-emerald-500 dark:text-emerald-400 font-mono tracking-tight">₹{{ uiStore.privacyMode ? '••••' : receivedAmount.toLocaleString('en-IN') }}</p>
          <p class="text-[10px] text-ink-secondary mt-0.5 font-medium">{{ receivedCount }} transactions</p>
        </div>
      </div>
    </div>

    <!-- Multi-Visualisation Selector Card -->
    <div class="fade-up-2 glass-card p-4 mb-5">
      <div class="flex items-center justify-between border-b border-slate-200/30 dark:border-slate-800/40 pb-3">
        <!-- Spacer/Placeholder replacing Visualisations word -->
        <div></div>

        <!-- Center Filter Pills -->
        <div class="flex bg-surface-input p-0.5 rounded-lg border border-slate-200/40 dark:border-slate-800/60 shadow-sm">
          <button
            @click="selectedType = 'all'"
            class="text-[10px] px-3.5 py-1 rounded font-bold uppercase transition-all"
            :class="selectedType === 'all' ? 'bg-slate-700/85 dark:bg-slate-800 text-white shadow-sm' : 'text-ink-secondary hover:text-ink-primary'"
          >
            All Transactions
          </button>
          <button
            @click="selectedType = 'received'"
            class="text-[10px] px-3.5 py-1 rounded font-bold uppercase transition-all"
            :class="selectedType === 'received' ? 'bg-slate-700/85 dark:bg-slate-800 text-white shadow-sm' : 'text-ink-secondary hover:text-ink-primary'"
          >
            Income
          </button>
          <button
            @click="selectedType = 'sent'"
            class="text-[10px] px-3.5 py-1 rounded font-bold uppercase transition-all"
            :class="selectedType === 'sent' ? 'bg-slate-700/85 dark:bg-slate-800 text-white shadow-sm' : 'text-ink-secondary hover:text-ink-primary'"
          >
            Expenses
          </button>
        </div>

        <!-- View Switcher -->
        <div class="flex bg-surface-input p-0.5 rounded-lg border border-slate-200/40 dark:border-slate-800/60">
          <button
            v-for="view in (['list', 'donut', 'trends'] as const)"
            :key="view"
            @click="activeVisual = view"
            class="text-[10px] px-3 py-1 rounded font-bold uppercase transition-all"
            :class="activeVisual === view ? 'bg-brand-500 text-white shadow-sm' : 'text-ink-secondary hover:text-ink-primary'"
          >
            {{ view }}
          </button>
        </div>
      </div>

      <!-- VISUAL 1: Interactive Donut Allocation -->
      <div v-if="activeVisual === 'donut'" class="py-6 flex flex-col md:flex-row items-center justify-around gap-6">
        <div v-if="categoryStats.length === 0" class="text-center py-6 text-ink-muted text-xs flex-1">
          No records available to generate donut visualization.
        </div>
        <template v-else>
          <!-- Donut ring -->
          <div class="relative w-48 h-48 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 200 200" class="w-full h-full transform -rotate-90">
              <!-- Background base ring -->
              <circle cx="100" cy="100" r="70" fill="transparent" stroke="var(--surface-input)" stroke-width="15" />
              <!-- Segments -->
              <circle
                v-for="(slice, index) in donutSlices"
                :key="index"
                cx="100"
                cy="100"
                r="70"
                fill="transparent"
                :stroke="slice.color"
                stroke-width="16"
                :stroke-dasharray="`${slice.strokeLength} 439.82`"
                :stroke-dashoffset="-slice.strokeOffset"
                stroke-linecap="round"
                class="transition-all duration-500 hover:stroke-[18px] cursor-pointer"
                @click="selectedCategory = selectedCategory === slice.name ? null : slice.name"
              />
            </svg>
            <!-- Center Label -->
            <div class="absolute flex flex-col items-center text-center">
              <span class="text-[9px] uppercase tracking-wider font-bold text-ink-muted">
                {{ selectedType === 'all' ? 'Total Flow' : selectedType === 'received' ? 'Total Inflow' : 'Total Spent' }}
              </span>
              <span class="text-base font-extrabold font-mono text-ink-primary mt-0.5">
                ₹{{ uiStore.privacyMode ? '••••' : analysisAmount.toLocaleString('en-IN') }}
              </span>
            </div>
          </div>
          <!-- Donut Legend (List categories list style) -->
          <div class="flex-1 w-full max-w-sm space-y-2 text-[11px] self-start md:self-center">
            <div
              v-for="slice in donutSlices"
              :key="slice.name"
              class="flex items-center justify-between cursor-pointer py-2 px-3 rounded-xl border border-slate-200/10 dark:border-slate-800/40 hover:bg-surface-input/60 transition-all"
              @click="selectedCategory = selectedCategory === slice.name ? null : slice.name"
              :class="selectedCategory === slice.name ? 'ring-1 ring-brand-500/50 bg-surface-input/80' : 'bg-surface-card'"
            >
              <div class="flex items-center gap-3">
                <span class="w-3 h-3 rounded-full shadow-sm" :style="{ backgroundColor: slice.color }" />
                <span class="font-bold text-ink-primary tracking-tight">{{ slice.name }}</span>
              </div>
              <div class="text-right">
                <span class="font-bold text-ink-primary font-mono">₹{{ uiStore.privacyMode ? '••••' : slice.amount.toLocaleString('en-IN') }}</span>
                <span class="text-[10px] text-ink-muted ml-2 font-medium">({{ slice.percentage }}%)</span>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- VISUAL 2: Weekly Spending Trends (Vertical Column Chart) -->
      <div v-else-if="activeVisual === 'trends'" class="py-6">
        <div v-if="analysisAmount === 0" class="text-center py-6 text-ink-muted text-xs">
          No entries to plot trend logs.
        </div>
        <div v-else>
          <p class="text-[10px] text-ink-muted font-bold tracking-wider mb-5 text-center uppercase">
            {{ selectedType === 'all' ? 'DAILY TRANSACTION FLOW OVER THE LAST 7 DAYS' : selectedType === 'received' ? 'DAILY INCOMING REVENUE TRENDS' : 'DAILY EXPENSE OUTFLOW TRENDS' }}
          </p>
          <div class="h-32 flex items-end justify-between gap-2 px-1">
            <div
              v-for="day in dailyTrends"
              :key="day.dateStr"
              class="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
            >
              <!-- Hover amount bubble -->
              <span class="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded absolute -translate-y-12 font-mono font-bold z-10 shadow-sm pointer-events-none">
                ₹{{ day.amount.toLocaleString('en-IN') }}
              </span>
              <!-- Column Pillar -->
              <div
                class="w-full rounded-t-md transition-all duration-500 bg-gradient-to-t from-brand-600 to-brand-400 group-hover:to-brand-300"
                :style="{ height: `${day.height}%` }"
              />
              <!-- Day Label -->
              <span class="text-[9px] text-ink-muted mt-2 font-bold uppercase tracking-tighter">{{ day.dayLabel }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- VISUAL 3: List (Default Category Distribution Rows) -->
      <div v-else class="py-4 space-y-3">
        <div v-if="categoryStats.length === 0" class="text-center py-6 text-ink-muted text-xs">
          No records available to list.
        </div>
        <div
          v-else
          v-for="stat in categoryStats"
          :key="stat.name"
          class="p-3 rounded-xl bg-surface-card hover:bg-surface-input/60 transition-all cursor-pointer border border-slate-200/30 dark:border-slate-800/40 flex flex-col justify-between"
          :class="selectedCategory === stat.name ? 'ring-1 ring-brand-500/50 bg-surface-input/80' : ''"
          @click="selectedCategory = selectedCategory === stat.name ? null : stat.name"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-3">
              <UiCategoryIcon :category="stat.name" size="sm" />
              <span class="font-bold text-xs text-ink-primary tracking-tight">{{ stat.name }}</span>
            </div>
            <div class="text-right">
              <span class="font-bold text-xs text-ink-primary font-mono">₹{{ uiStore.privacyMode ? '••••' : stat.amount.toLocaleString('en-IN') }}</span>
              <span class="text-[10px] text-ink-muted ml-1.5 font-medium">({{ stat.percentage }}%)</span>
            </div>
          </div>
          
          <div class="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="stat.barColor"
              :style="{ width: `${stat.percentage}%` }"
            />
          </div>
        </div>
      </div>

      <!-- Selected Category sub-ledger entries detail drawer -->
      <div v-if="selectedCategory" class="mt-6 border-t border-slate-200/30 dark:border-slate-800/40 pt-5 animate-[slide-up_0.25s_ease-out]">
        <div class="flex items-center justify-between mb-3.5">
          <div>
            <h3 class="text-xs font-extrabold uppercase tracking-widest text-brand-500">{{ selectedCategory }} Breakdown</h3>
            <p class="text-[10px] text-ink-muted mt-0.5">Chronological record ledger entries</p>
          </div>
          <span class="text-[10px] bg-brand-500/10 text-brand-600 dark:text-brand-400 px-2.5 py-1 rounded-full font-bold">
            {{ categoryTransactions.length }} items
          </span>
        </div>

        <div class="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
          <div
            v-for="txn in categoryTransactions"
            :key="txn.id"
            class="flex items-center justify-between p-3 rounded-xl bg-surface-card border border-slate-200/20 dark:border-slate-800/40 hover:border-slate-300/40 dark:hover:border-slate-700/40 transition-colors"
          >
            <div class="min-w-0 pr-2">
              <p class="text-xs font-bold text-ink-primary truncate">
                {{ txn.merchantName || 'Direct merchant' }}
              </p>
              <p class="text-[10px] text-ink-muted mt-0.5 font-medium">{{ txn.transactionDate }}</p>
            </div>
            <div class="text-right flex-shrink-0">
              <p class="text-xs font-bold font-mono" :class="txn.direction === 'sent' ? 'text-red-500' : 'text-emerald-500'">
                {{ txn.direction === 'sent' ? '-' : '+' }}₹{{ uiStore.privacyMode ? '••••' : txn.amount.toLocaleString('en-IN') }}
              </p>
              <p class="text-[9px] text-ink-muted mt-0.5 truncate max-w-[120px] font-mono">
                {{ txn.upiId || 'No UPI Ref' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTransactions } from '~/composables/useTransactions'
import { CATEGORIES, categorizeMerchant, getCategoryBarColor } from '~/composables/useCategoryHelper'
import { useTheme } from '~/composables/useTheme'
import { useUIStore } from '../stores/ui'

definePageMeta({ middleware: ['auth'] })

const txns = useTransactions()
const { isDark, toggleTheme, initTheme } = useTheme()
const uiStore = useUIStore()

const activeVisual = ref<'list' | 'donut' | 'trends'>('list')
const sortBy = ref<'amount' | 'count'>('amount')
const selectedCategory = ref<string | null>(null)
const selectedType = ref<'all' | 'received' | 'sent'>('all')
const isOnline = ref(true)

const updateOnlineStatus = () => {
  isOnline.value = typeof navigator !== 'undefined' ? navigator.onLine : true
}

onMounted(() => {
  initTheme()
  txns.startListening()
  updateOnlineStatus()
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
})

onUnmounted(() => {
  window.removeEventListener('online', updateOnlineStatus)
  window.removeEventListener('offline', updateOnlineStatus)
})

const sentTransactions = computed(() =>
  txns.transactions.value.filter(t => t.direction === 'sent')
)

const sentAmount = computed(() =>
  sentTransactions.value.reduce((sum, t) => sum + (t.amount || 0), 0)
)

const sentCount = computed(() => sentTransactions.value.length)

const receivedTransactions = computed(() =>
  txns.transactions.value.filter(t => t.direction === 'received')
)

const receivedAmount = computed(() =>
  receivedTransactions.value.reduce((sum, t) => sum + (t.amount || 0), 0)
)

const receivedCount = computed(() => receivedTransactions.value.length)

// Dynamic transaction selection computed helper
const filteredAnalysisTransactions = computed(() => {
  if (selectedType.value === 'all') return txns.transactions.value
  return txns.transactions.value.filter(t => t.direction === selectedType.value)
})

const analysisAmount = computed(() =>
  filteredAnalysisTransactions.value.reduce((sum, t) => sum + (t.amount || 0), 0)
)

const categoryStats = computed(() => {
  const totalVal = analysisAmount.value

  const statsMap: Record<string, { amount: number; count: number }> = {}
  CATEGORIES.forEach(cat => {
    statsMap[cat] = { amount: 0, count: 0 }
  })

  filteredAnalysisTransactions.value.forEach(t => {
    const cat = t.category || categorizeMerchant(t.merchantName || '', t.ocrRawText || '')
    if (statsMap[cat] !== undefined) {
      statsMap[cat].amount += t.amount || 0
      statsMap[cat].count += 1
    } else {
      statsMap['Others']!.amount += t.amount || 0
      statsMap['Others']!.count += 1
    }
  })

  const results = CATEGORIES.map(cat => {
    const { amount, count } = statsMap[cat]!
    const percentage = totalVal > 0 ? Math.round((amount / totalVal) * 100) : 0
    return {
      name: cat,
      amount,
      count,
      percentage,
      barColor: getCategoryBarColor(cat)
    }
  })
  .filter(s => s.amount > 0)

  if (sortBy.value === 'amount') {
    return results.sort((a, b) => b.amount - a.amount)
  } else {
    return results.sort((a, b) => b.count - a.count)
  }
})

// Circular Donut Calculation
const donutSlices = computed(() => {
  const total = analysisAmount.value
  if (total === 0) return []
  
  let cumulativePercent = 0
  const colorsMap: Record<string, string> = {
    'Food & Dining': '#f97316',
    'Groceries': '#10b981',
    'Shopping': '#ec4899',
    'Transport & Travel': '#0ea5e9',
    'Bills & Utilities': '#6366f1',
    'Entertainment': '#8b5cf6',
    'Medical & Healthcare': '#f43f5e',
    'Others': '#64748b'
  }

  return categoryStats.value.map(stat => {
    const percentage = stat.percentage
    // Circumference = 2 * Math.PI * 70 = 439.82
    const strokeLength = (percentage / 100) * 439.82
    const strokeOffset = 439.82 - ((cumulativePercent / 100) * 439.82)
    cumulativePercent += percentage
    
    return {
      name: stat.name,
      percentage,
      amount: stat.amount,
      strokeLength,
      strokeOffset,
      color: colorsMap[stat.name] || '#64748b'
    }
  })
})

// Daily Transaction trends over the last 7 calendar days
const dailyTrends = computed(() => {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    return d
  }).reverse()

  const trendData = last7Days.map(date => {
    const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' })
    
    // Filter transactions for this specific calendar day
    const dayAmount = filteredAnalysisTransactions.value
      .filter(t => {
        if (!t.transactionDate) return false
        const tDate = new Date(t.transactionDate)
        return tDate.toDateString() === date.toDateString()
      })
      .reduce((sum, t) => sum + (t.amount || 0), 0)

    return {
      dateStr,
      dayLabel,
      amount: dayAmount,
      height: 0 // Will compute below relative to max daily spend
    }
  })

  const maxAmount = Math.max(...trendData.map(d => d.amount), 1)
  trendData.forEach(d => {
    d.height = Math.max((d.amount / maxAmount) * 100, 5) // ensure at least a 5% tiny indicator line if 0
  })

  return trendData
})

const categoryTransactions = computed(() => {
  if (!selectedCategory.value) return []
  return filteredAnalysisTransactions.value.filter(t => {
    const cat = t.category || categorizeMerchant(t.merchantName || '', t.ocrRawText || '')
    return cat === selectedCategory.value
  }).sort((a, b) => {
    const dateA = new Date(a.transactionDate || '').getTime()
    const dateB = new Date(b.transactionDate || '').getTime()
    return dateB - dateA
  })
})
</script>
