<template>
  <div class="min-h-screen bg-surface-base px-5 pt-14 pb-28 relative overflow-hidden">

    <div class="orb-1 absolute top-[-100px] right-[-60px] w-[300px] h-[300px]
                rounded-full bg-brand-500/6 blur-3xl pointer-events-none" />

    <div class="fade-up-1 mb-8">
      <p class="text-ink-muted text-xs font-medium uppercase tracking-widest mb-0.5">
        Account
      </p>
      <h1 class="text-xl font-semibold text-ink-primary">Profile</h1>
    </div>

    <div class="fade-up-2 glass-card p-5 mb-4">
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-2xl bg-brand-500/15 border border-brand-500/25
                    flex items-center justify-center shadow-glow-sm flex-shrink-0">
          <span class="text-brand-400 font-semibold text-lg font-mono">
            {{ initials || '?' }}
          </span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-base font-semibold text-ink-primary truncate">
            {{ authStore.displayName || 'User' }}
          </p>
          <p class="text-xs text-ink-muted mt-0.5 truncate">
            {{ authStore.userEmail || authStore.userPhone || 'No contact info' }}
          </p>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="#14b8a6" stroke-width="2">
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>

        <button
          class="btn-ghost w-full flex items-center gap-3"
          @click="exportPDF"
          :disabled="txns.transactions.value.length === 0"
        >
          <div class="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="#f87171" stroke-width="2">
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2">
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
        class="w-full flex items-center gap-3 text-red-400
               hover:text-red-300 transition-colors"
        @click="handleSignOut"
      >
        <div class="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="#f87171" stroke-width="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </div>
        <span class="text-sm font-medium">Sign out</span>
      </button>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useTransactions } from '~/composables/useTransactions'

definePageMeta({ middleware: ['auth'] })

const authStore = useAuthStore()
const txns      = useTransactions()

onMounted(() => {
  txns.startListening()
})

const initials = computed(() => {
  const name = authStore.displayName || ''
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
