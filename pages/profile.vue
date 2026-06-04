<template>
  <div class="min-h-screen bg-surface-base bg-grid-pattern px-5 pt-14 pb-28 relative overflow-x-hidden overflow-y-auto">
    <div class="orb-1 absolute top-[-100px] right-[-60px] w-[300px] h-[300px]
                rounded-full bg-brand-500/6 blur-3xl pointer-events-none" />

    <!-- Header -->
    <div class="fade-up-1 mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-ink-primary tracking-tight">Profile</h1>
        <p class="text-xs text-ink-secondary mt-0.5">Manage your identity and preferences</p>
      </div>
      <button 
        @click="showEditModal = true" 
        class="w-10 h-10 rounded-xl bg-surface-card border border-[color:var(--border-color)] flex items-center justify-center hover:bg-surface-input active:scale-95 transition-all shadow-sm"
        title="Edit Profile details"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-ink-secondary">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
    </div>

    <!-- SnapPay Virtual UPI Card: Sleek metallic credit card style -->
    <div class="fade-up-2 glass-card-premium p-6 mb-6 relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 text-white border border-white/10 shadow-2xl rounded-3xl min-h-[190px]">
      <!-- Floating decorative glowing lights -->
      <div class="absolute top-[-50px] right-[-30px] w-40 h-40 rounded-full bg-indigo-500/30 blur-3xl pointer-events-none animate-pulse" />
      <div class="absolute bottom-[-40px] left-[-30px] w-36 h-36 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />
      <!-- Metallic sheen reflection line -->
      <div class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none"></div>

      <div class="flex items-center justify-between mb-6 relative z-10">
        <span class="text-[9px] font-extrabold uppercase tracking-widest opacity-80 text-cyan-400">SnapPay Virtual Card</span>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="opacity-80 text-white">
          <path d="M13 2L4.5 13.5H12L11 22L19.5 10.5H12L13 2Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
      </div>

      <div class="flex items-center gap-4.5 mb-6 relative z-10">
        <div class="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0 shadow-lg backdrop-blur-md">
          <span class="text-white font-bold text-lg font-mono tracking-wider">
            {{ initials || 'SP' }}
          </span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-base font-bold truncate leading-tight tracking-tight">
            {{ detailedProfile.displayName || authStore.displayName || 'User' }}
          </p>
          <p class="text-[11px] text-cyan-400/90 truncate mt-1.5 font-mono">
            {{ detailedProfile.upiId || 'no-upi-linked' }}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4 border-t border-white/10 pt-4.5 relative z-10">
        <div>
          <span class="text-[8px] uppercase tracking-wider text-white/50 font-bold">Total Transactions</span>
          <p class="text-base font-bold font-mono mt-0.5 tracking-tight">{{ txns.transactions.value.length }}</p>
        </div>
        <div>
          <span class="text-[8px] uppercase tracking-wider text-white/50 font-bold">Primary VPA</span>
          <p class="text-xs font-bold font-mono mt-1 truncate tracking-tight text-white/95">{{ detailedProfile.upiId || 'None linked' }}</p>
        </div>
      </div>
    </div>

    <!-- App Settings Preferences -->
    <div class="fade-up-3 glass-card-premium p-5 mb-5">
      <p class="text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-4.5">App Configuration</p>
      
      <div class="space-y-4">
        <!-- Privacy Hide Amount Toggle -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs font-bold text-ink-primary">Privacy Shield Mode</p>
            <p class="text-[10px] text-ink-muted leading-relaxed mt-0.5">Mask sensitive wallet amounts across all views</p>
          </div>
          <button 
            @click="uiStore.togglePrivacyMode"
            class="w-12 h-6 rounded-full p-0.5 transition-colors duration-300 focus:outline-none"
            :class="uiStore.privacyMode ? 'bg-brand-500 shadow-glow' : 'bg-slate-300 dark:bg-slate-800'"
          >
            <div class="w-5 h-5 bg-white rounded-full shadow transform duration-300" :class="uiStore.privacyMode ? 'translate-x-6' : ''" />
          </button>
        </div>
      </div>
    </div>

    <!-- Export & Utilities Panel -->
    <div class="fade-up-3 glass-card-premium p-5 mb-5">
      <p class="text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-4.5">Data Management</p>
      
      <div class="space-y-3">
        <button
          class="btn-ghost w-full flex items-center gap-3.5 hover:scale-[1.01] transition-all"
          @click="exportCSV"
          :disabled="txns.transactions.value.length === 0"
        >
          <div class="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <div class="flex-1 text-left">
            <p class="text-xs font-bold text-ink-primary">Export as CSV Spreadsheet</p>
            <p class="text-[9px] text-ink-muted mt-0.5">Download full transaction table data</p>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-ink-muted">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>

        <button
          class="btn-ghost w-full flex items-center gap-3.5 hover:scale-[1.01] transition-all"
          @click="exportPDF"
          :disabled="txns.transactions.value.length === 0"
        >
          <div class="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center border border-rose-500/10">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <div class="flex-1 text-left">
            <p class="text-xs font-bold text-ink-primary">Export as Print-Ready PDF</p>
            <p class="text-[9px] text-ink-muted mt-0.5">Generate printable transaction report</p>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-ink-muted">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Sign Out Button -->
    <div class="fade-up-3 glass-card-premium p-4">
      <button
        class="w-full flex items-center gap-3.5 text-red-500 hover:text-red-600 transition-colors"
        @click="handleSignOut"
      >
        <div class="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/10">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </div>
        <span class="text-xs font-bold uppercase tracking-wider">Sign Out from Device</span>
      </button>
    </div>

    <!-- Edit Profile Modal -->
    <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/75 backdrop-blur-md">
      <div class="glass-card-premium w-full max-w-sm p-6 relative border border-slate-200/40 dark:border-white/5 shadow-2xl">
        <button @click="showEditModal = false" class="absolute top-4.5 right-4.5 text-ink-muted hover:text-ink-primary transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <h3 class="text-xs font-extrabold uppercase tracking-widest text-ink-primary mb-5 border-b border-[color:var(--border-color)] pb-3">Edit Profile</h3>
        
        <form @submit.prevent="saveProfile" class="space-y-4.5 max-h-[460px] overflow-y-auto pr-1">
          <div>
            <label class="text-[9px] font-bold text-ink-secondary mb-1.5 block uppercase tracking-wider">Display Name</label>
            <input v-model="editForm.displayName" type="text" class="input-field w-full" placeholder="Your Name" required />
          </div>
          
          <div>
            <label class="text-[9px] font-bold text-ink-secondary mb-1.5 block uppercase tracking-wider">Legal Account Name</label>
            <input v-model="editForm.legalName" type="text" class="input-field w-full" placeholder="Bank account full name" required />
          </div>

          <div>
            <label class="text-[9px] font-bold text-ink-secondary mb-1.5 block uppercase tracking-wider">UPI ID (VPA)</label>
            <input v-model="editForm.upiId" type="text" class="input-field w-full" placeholder="e.g. name@okaxis" required />
          </div>
          
          <div>
            <label class="text-[9px] font-bold text-ink-secondary mb-1.5 block uppercase tracking-wider">Self Biography</label>
            <textarea v-model="editForm.bio" class="input-field w-full h-16 resize-none" placeholder="UPI SnapPay User"></textarea>
          </div>
          
          <button type="submit" class="btn-primary w-full shadow-lg mt-2" :disabled="savingProfile">
            <span v-if="!savingProfile">Save Profile Changes</span>
            <span v-else class="flex items-center justify-center gap-2">
              <svg class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32" stroke-dashoffset="12"/>
              </svg>
              Saving Changes...
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

definePageMeta({ middleware: ['auth'] })

const authStore = useAuthStore()
const uiStore = useUIStore()
const txns = useTransactions()

const detailedProfile = ref({
  displayName: '',
  email: '',
  bio: '',
  address: '',
  legalName: '',
  upiId: ''
})

const showEditModal = ref(false)
const savingProfile = ref(false)

const editForm = reactive({
  displayName: '',
  bio: '',
  address: '',
  legalName: '',
  upiId: ''
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
    
    const docRef = doc($db, 'users', authStore.userId!)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      const data = docSnap.data()
      detailedProfile.value = {
        displayName: data.displayName || authStore.displayName || '',
        email: data.email || authStore.userEmail || '',
        bio: data.bio || '',
        address: data.address || '',
        legalName: data.legalName || '',
        upiId: data.upiId || ''
      }
    } else {
      detailedProfile.value.displayName = authStore.displayName || ''
    }
    
    // Copy into form
    editForm.displayName = detailedProfile.value.displayName
    editForm.bio         = detailedProfile.value.bio
    editForm.address     = detailedProfile.value.address
    editForm.legalName   = detailedProfile.value.legalName
    editForm.upiId       = detailedProfile.value.upiId
  } catch (error) {
    console.error("Failed to load user profile", error)
  }
}

async function saveProfile() {
  savingProfile.value = true
  try {
    const { $db } = useNuxtApp() as any
    const { doc, setDoc } = await import('firebase/firestore')
    
    const userDocRef = doc($db, 'users', authStore.userId!)
    await setDoc(userDocRef, {
      displayName: editForm.displayName,
      legalName: editForm.legalName,
      bio: editForm.bio,
      address: editForm.address,
      upiId: editForm.upiId
    }, { merge: true })

    detailedProfile.value.displayName = editForm.displayName
    detailedProfile.value.legalName   = editForm.legalName
    detailedProfile.value.bio         = editForm.bio
    detailedProfile.value.upiId       = editForm.upiId
    
    showEditModal.value = false
    uiStore.success('Profile linked successfully')
  } catch (e) {
    uiStore.error('Failed to link profile details')
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

function exportCSV() {
  const headers = ['Date', 'Merchant', 'UPI ID', 'Transaction ID', 'Amount', 'Direction', 'Status', 'Category']
  const rows = txns.transactions.value.map(t => [
    t.transactionDate,
    t.merchantName,
    t.upiId,
    t.transactionId,
    t.amount,
    t.direction,
    t.status,
    t.category || 'Others'
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
        .received { color: #0ea5e9; }
        .verified { color: #0ea5e9; }
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
