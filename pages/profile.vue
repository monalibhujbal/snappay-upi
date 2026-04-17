<template>
  <div class="min-h-screen bg-surface-base px-5 pt-14 pb-28 relative overflow-x-hidden overflow-y-auto">

    <div class="orb-1 absolute top-[-100px] right-[-60px] w-[300px] h-[300px]
                rounded-full bg-brand-500/6 blur-3xl pointer-events-none" />

    <div class="fade-up-1 mb-8">
      <p class="text-ink-muted text-xs font-medium uppercase tracking-widest mb-0.5">
        Account
      </p>
      <h1 class="text-xl font-semibold text-ink-primary">Profile</h1>
    </div>

    <!-- User Card -->
    <div class="fade-up-2 glass-card p-5 mb-4 relative">
      <button 
        @click="showEditModal = true" 
        class="absolute top-4 right-4 text-ink-muted hover:text-brand-400 p-2 transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>

      <div class="flex items-center gap-4 mb-3">
        <div class="w-14 h-14 rounded-2xl bg-brand-500/15 border border-brand-500/25
                    flex items-center justify-center shadow-glow-sm flex-shrink-0">
          <span class="text-brand-400 font-semibold text-lg font-mono">
            {{ initials || '?' }}
          </span>
        </div>
        <div class="flex-1 min-w-0 pr-6">
          <p class="text-base font-semibold text-ink-primary truncate">
            {{ detailedProfile.displayName || authStore.displayName || 'User' }}
          </p>
          <p class="text-xs text-ink-muted mt-0.5 truncate">
            {{ detailedProfile.email || authStore.userEmail || authStore.userPhone || 'No contact info' }}
          </p>
        </div>
      </div>
      
      <div v-if="detailedProfile.bio || detailedProfile.address" class="mt-4 pt-4 border-t border-slate-700/50">
        <div v-if="detailedProfile.bio" class="mb-2">
          <p class="text-xs text-ink-muted uppercase tracking-wider mb-1">Bio</p>
          <p class="text-sm text-ink-secondary">{{ detailedProfile.bio }}</p>
        </div>
        <div v-if="detailedProfile.address">
          <p class="text-xs text-ink-muted uppercase tracking-wider mb-1">Location</p>
          <p class="text-sm text-ink-secondary flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            {{ detailedProfile.address }}
          </p>
        </div>
      </div>
    </div>

    <!-- Analytics Chart -->
    <div class="fade-up-2 glass-card p-5 mb-4">
      <p class="text-xs font-medium text-ink-muted uppercase tracking-widest mb-4">
        Spending Analysis
      </p>
      
      <div class="h-48 w-full mt-2">
        <Bar 
          v-if="(chartData.datasets[0]?.data?.length || 0) > 0" 
          :data="chartData" 
          :options="chartOptions" 
        />
        <div v-else class="h-full flex items-center justify-center text-ink-muted text-sm border border-dashed border-slate-700 rounded-xl">
          Not enough transaction data
        </div>
      </div>

      <div class="flex justify-between mt-4 text-center">
        <div>
          <p class="text-xs text-ink-muted">Total Spent</p>
          <p class="font-mono text-lg text-amber-400 mt-1">₹{{ totalSent }}</p>
        </div>
        <div>
          <p class="text-xs text-ink-muted">Total Earned</p>
          <p class="font-mono text-lg text-brand-400 mt-1">₹{{ totalReceived }}</p>
        </div>
      </div>
    </div>

    <div class="fade-up-2 grid grid-cols-3 gap-3 mb-6">
      <div class="glass-card p-4 text-center">
        <p class="text-2xl font-semibold text-ink-primary font-mono">
          {{ txns.transactions.value.length }}
        </p>
        <p class="text-xs text-ink-muted mt-1">Total</p>
      </div>
      <div class="glass-card p-4 text-center">
        <p class="text-2xl font-semibold text-brand-400 font-mono">
          {{ verifiedCount }}
        </p>
        <p class="text-xs text-ink-muted mt-1">Verified</p>
      </div>
      <div class="glass-card p-4 text-center">
        <p class="text-2xl font-semibold text-amber-400 font-mono">
          {{ flaggedCount }}
        </p>
        <p class="text-xs text-ink-muted mt-1">Flagged</p>
      </div>
    </div>

    <div class="fade-up-3 glass-card p-5 mb-4">
      <p class="text-xs font-medium text-ink-muted uppercase tracking-widest mb-4">
        Export data
      </p>
      <div class="space-y-3">
        <button
          class="btn-ghost w-full flex items-center gap-3"
          @click="exportCSV"
          :disabled="txns.transactions.value.length === 0"
        >
          <div class="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <div class="flex-1 text-left">
            <p class="text-sm font-medium text-ink-primary">Export as CSV</p>
            <p class="text-xs text-ink-muted">Download all transactions</p>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>

        <button
          class="btn-ghost w-full flex items-center gap-3"
          @click="exportPDF"
          :disabled="txns.transactions.value.length === 0"
        >
          <div class="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div class="flex-1 text-left">
            <p class="text-sm font-medium text-ink-primary">Export as PDF</p>
            <p class="text-xs text-ink-muted">Print-ready ledger report</p>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="fade-up-3 glass-card p-5">
      <p class="text-xs font-medium text-ink-muted uppercase tracking-widest mb-4">
        Account
      </p>
      <button
        class="w-full flex items-center gap-3 text-red-400 hover:text-red-300 transition-colors"
        @click="handleSignOut"
      >
        <div class="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </div>
        <span class="text-sm font-medium">Sign out</span>
      </button>
    </div>

    <!-- Edit Profile Modal -->
    <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/80 backdrop-blur-sm">
      <div class="glass-card w-full max-w-sm p-6 relative animate-[fade-in_0.2s_ease-out]">
        <button @click="showEditModal = false" class="absolute top-4 right-4 text-ink-muted hover:text-ink-primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <h3 class="text-lg font-semibold text-ink-primary mb-4">Edit Profile</h3>
        
        <form @submit.prevent="saveProfile">
          <div class="mb-4">
            <label class="text-xs text-ink-secondary mb-1.5 block">Display Name</label>
            <input v-model="editForm.displayName" type="text" class="input-field w-full" placeholder="Your Name" />
          </div>
          
          <div class="mb-4">
            <label class="text-xs text-ink-secondary mb-1.5 block">Legal Name (As on Bank)</label>
            <input v-model="editForm.legalName" type="text" class="input-field w-full" placeholder="Full name for verification" />
          </div>
          
          <div class="mb-4">
            <label class="text-xs text-ink-secondary mb-1.5 block">Bio</label>
            <textarea v-model="editForm.bio" class="input-field w-full h-20 resize-none" placeholder="Software Engineer, Foodie..."></textarea>
          </div>
          
          <div class="mb-6">
            <label class="text-xs text-ink-secondary mb-1.5 block">Location</label>
            <input v-model="editForm.address" type="text" class="input-field w-full" placeholder="Mumbai, India" />
          </div>
          
          <button type="submit" class="btn-primary w-full" :disabled="savingProfile">
            <span v-if="!savingProfile">Save Changes</span>
            <span v-else class="flex items-center justify-center gap-2">
              <svg class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32" stroke-dashoffset="12"/>
              </svg>
              Saving...
            </span>
          </button>
        </form>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, reactive } from 'vue'
import { useNuxtApp } from 'nuxt/app'
import { useAuthStore } from '../stores/auth'
import { useUIStore } from '../stores/ui'
import { useTransactions } from '~/composables/useTransactions'

import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js'
import { Bar } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

definePageMeta({ middleware: ['auth'] })

const authStore = useAuthStore()
const uiStore = useUIStore()
const txns = useTransactions()

const detailedProfile = ref({
  displayName: '',
  email: '',
  bio: '',
  address: '',
  legalName: ''
})

const showEditModal = ref(false)
const savingProfile = ref(false)
const editForm = reactive({
  displayName: '',
  bio: '',
  address: '',
  legalName: ''
})

onMounted(async () => {
  txns.startListening()
  await loadDetailedProfile()
})

async function loadDetailedProfile() {
  if (!authStore.userId) return
  
  try {
    const { $db } = useNuxtApp() as any
    const { doc, getDoc } = await import('firebase/firestore')
    
    const docRef = doc($db, 'users', authStore.userId)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      const data = docSnap.data()
      detailedProfile.value = {
        displayName: data.displayName || authStore.displayName || '',
        email: data.email || authStore.userEmail || '',
        bio: data.bio || '',
        address: data.address || '',
        legalName: data.legalName || ''
      }
    } else {
      detailedProfile.value.displayName = authStore.displayName || ''
    }
    
    // Copy into form
    editForm.displayName = detailedProfile.value.displayName
    editForm.bio = detailedProfile.value.bio
    editForm.address = detailedProfile.value.address
    editForm.legalName = detailedProfile.value.legalName
  } catch (error) {
    console.error("Failed to load user profile", error)
  }
}

async function saveProfile() {
  savingProfile.value = true
  try {
    await authStore.updateUserProfile({
      displayName: editForm.displayName,
      bio: editForm.bio,
      address: editForm.address,
      legalName: editForm.legalName
    })
    
    detailedProfile.value.displayName = editForm.displayName
    detailedProfile.value.bio = editForm.bio
    detailedProfile.value.address = editForm.address
    detailedProfile.value.legalName = editForm.legalName
    
    showEditModal.value = false
    uiStore.success('Profile updated successfully')
  } catch (e) {
    uiStore.error('Failed to update profile')
  } finally {
    savingProfile.value = false
  }
}

const initials = computed(() => {
  const name = detailedProfile.value.displayName || authStore.displayName || ''
  return name.split(' ')
    .map((n: string) => n?.[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const verifiedCount = computed(() =>
  txns.transactions.value.filter(t => t.status === 'verified').length
)

const flaggedCount = computed(() =>
  txns.transactions.value.filter(t => t.status === 'flagged').length
)

// Analytics
const totalSent = computed(() => 
  txns.transactions.value
    .filter(t => t.direction === 'sent')
    .reduce((s, t) => s + (t.amount || 0), 0)
)

const totalReceived = computed(() => 
  txns.transactions.value
    .filter(t => t.direction === 'received')
    .reduce((s, t) => s + (t.amount || 0), 0)
)

const chartData = computed(() => {
  return {
    labels: ['Money Out', 'Money In'],
    datasets: [
      {
        label: 'Amount (₹)',
        backgroundColor: ['#fbbf24', '#14b8a6'],
        borderRadius: 8,
        data: [totalSent.value, totalReceived.value]
      }
    ]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      titleColor: '#f8fafc',
      bodyColor: '#cbd5e1',
      borderColor: 'rgba(51, 65, 85, 0.8)',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
      callbacks: {
        label: (context: any) => `₹${context.raw.toLocaleString()}`
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(51, 65, 85, 0.2)'
      },
      ticks: {
        color: '#64748b',
        callback: (value: any) => `₹${value}`
      }
    },
    x: {
      grid: {
        display: false
      },
      ticks: {
        color: '#94a3b8'
      }
    }
  }
}

function exportCSV() {
  const headers = ['Date', 'Merchant', 'UPI ID', 'Transaction ID', 'Amount', 'Direction', 'Status']
  const rows = txns.transactions.value.map(t => [
    t.transactionDate,
    t.merchantName,
    t.upiId,
    t.transactionId,
    t.amount,
    t.direction,
    t.status,
  ])

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell ?? ''}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `snappay-ledger-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportPDF() {
  const txnList = txns.transactions.value
  const total   = txnList.reduce((s, t) => s + (t.amount || 0), 0)

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>SnapPay Ledger</title>
      <style>
        body { font-family: sans-serif; padding: 32px; color: #1e293b; }
        h1 { font-size: 24px; margin-bottom: 4px; }
        p.sub { color: #64748b; font-size: 13px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #f1f5f9; padding: 10px 12px; text-align: left;
             font-weight: 600; border-bottom: 2px solid #e2e8f0; }
        td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
        .sent { color: #ef4444; }
        .received { color: #14b8a6; }
        .verified { color: #14b8a6; }
        .flagged { color: #f59e0b; }
        .total { font-weight: 600; font-size: 15px; margin-top: 20px; text-align: right; }
      </style>
    </head>
    <body>
      <h1>⚡ SnapPay Ledger</h1>
      <p class="sub">Generated on ${new Date().toLocaleDateString('en-IN')} · ${txnList.length} transactions</p>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Merchant</th>
            <th>UPI ID</th>
            <th>Amount</th>
            <th>Direction</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${txnList.map(t => `
            <tr>
              <td>${t.transactionDate || '-'}</td>
              <td>${t.merchantName || '-'}</td>
              <td>${t.upiId || '-'}</td>
              <td class="${t.direction}">
                ${t.direction === 'sent' ? '-' : '+'}₹${(t.amount || 0).toLocaleString('en-IN')}
              </td>
              <td class="${t.direction}">${t.direction}</td>
              <td class="${t.status}">${t.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p class="total">Total: ₹${total.toLocaleString('en-IN')}</p>
    </body>
    </html>
  `

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 500)
}

async function handleSignOut() {
  await authStore.signOut()
}
</script>
