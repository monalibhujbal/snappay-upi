<template>
  <div class="min-h-screen bg-surface-base px-5 pt-14 pb-28 relative overflow-hidden">
    <div class="orb-1 absolute top-[-100px] right-[-60px] w-[300px] h-[300px]
                rounded-full bg-brand-500/6 blur-3xl pointer-events-none" />

    <div class="fade-up-1 flex items-center gap-4 mb-8">
      <NuxtLink to="/"
        class="w-9 h-9 rounded-xl bg-surface-card border border-slate-700/60
               flex items-center justify-center text-ink-secondary
               hover:text-ink-primary transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </NuxtLink>
      <h1 class="text-lg font-semibold text-ink-primary">Scan Receipt</h1>
    </div>

    <div v-if="step === 'capture'" class="fade-up-2">
      <div class="glass-card overflow-hidden mb-4 relative min-h-[240px]">
        <video
          ref="videoRef"
          autoplay
          playsinline
          class="w-full aspect-video object-cover bg-surface-input"
          :class="{ 'opacity-0': !camera.isActive.value }"
        />

        <div v-if="camera.isActive.value"
             class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div class="relative w-64 h-40">
            <div class="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-brand-500 rounded-tl-lg"></div>
            <div class="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-brand-500 rounded-tr-lg"></div>
            <div class="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-brand-500 rounded-bl-lg"></div>
            <div class="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-brand-500 rounded-br-lg"></div>
          </div>
        </div>

        <div v-if="!camera.isActive.value && !camera.error.value"
             class="absolute inset-0 flex items-center justify-center bg-surface-input">
          <div class="flex flex-col items-center gap-3 text-ink-muted">
            <svg class="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor"
                      stroke-width="2" stroke-dasharray="32" stroke-dashoffset="12"/>
            </svg>
            <p class="text-sm">Starting camera...</p>
          </div>
        </div>

        <div v-if="camera.error.value"
             class="absolute inset-0 flex items-center justify-center bg-surface-input px-6">
          <div class="text-center">
            <p class="text-red-400 text-sm mb-4">{{ camera.error.value }}</p>
            <label class="btn-primary text-sm cursor-pointer px-4 py-2 rounded-xl">
              Upload from gallery
              <input type="file" accept="image/*" class="hidden" @change="handleFileUpload" />
            </label>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-center gap-6 mt-4">
        <label class="btn-ghost flex items-center gap-2 cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Gallery
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            class="hidden"
            @change="handleFileUpload"
          />
        </label>

        <button
          class="w-16 h-16 rounded-full bg-brand-500 shadow-glow-teal
                 flex items-center justify-center transition-all
                 active:scale-95 disabled:opacity-40"
          :disabled="!camera.isActive.value"
          @click="handleCapture"
        >
          <div class="w-12 h-12 rounded-full border-2 border-white/40
                      flex items-center justify-center">
            <div class="w-8 h-8 rounded-full bg-white/90"></div>
          </div>
        </button>

        <div class="w-24"></div>
      </div>
    </div>

    <div v-else-if="step === 'processing'" class="fade-up-2">
      <div class="glass-card p-6 mb-4">
        <img
          v-if="capturedImageData"
          :src="capturedImageData"
          class="w-full rounded-xl mb-6 object-cover max-h-48"
        />
        <div class="space-y-4">
          <div v-for="(s, i) in processingSteps" :key="i"
               class="flex items-center gap-3">
            <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                 :class="i < processingStep
                   ? 'bg-brand-500/20 text-brand-400'
                   : i === processingStep
                     ? 'bg-brand-500/10 text-brand-500'
                     : 'bg-surface-input text-ink-muted'">
              <svg v-if="i < processingStep" width="14" height="14"
                   viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <svg v-else-if="i === processingStep"
                   class="animate-spin" width="14" height="14"
                   viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor"
                        stroke-width="2" stroke-dasharray="32" stroke-dashoffset="12"/>
              </svg>
              <span v-else class="text-xs font-mono">{{ i + 1 }}</span>
            </div>
            <div class="flex-1">
              <p class="text-sm font-medium"
                 :class="i <= processingStep ? 'text-ink-primary' : 'text-ink-muted'">
                {{ s.label }}
              </p>
              <p v-if="i === 0 && processingStep === 0"
                 class="text-xs text-brand-400 mt-0.5">
                {{ ocr.ocrProgress.value }}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="step === 'review'" class="fade-up-2">
      <div v-if="documentResult"
           class="glass-card p-4 mb-4 flex items-center justify-between gap-3">
        <div>
          <p class="text-xs text-ink-muted uppercase tracking-widest mb-1">Detected document</p>
          <p class="text-sm font-medium text-ink-primary">{{ documentLabel }}</p>
          <p class="text-xs text-ink-muted mt-1">
            Confidence {{ Math.round(documentResult.score * 100) }}%
          </p>
        </div>
        <span class="text-xs font-medium px-3 py-1 rounded-full"
              :class="documentBadgeClass">
          {{ documentResult.kind.replaceAll('_', ' ') }}
        </span>
      </div>

      <div v-if="providerResult"
           class="glass-card p-4 mb-4 flex items-center justify-between gap-3">
        <div>
          <p class="text-xs text-ink-muted uppercase tracking-widest mb-1">Detected provider</p>
          <p class="text-sm font-medium text-ink-primary">{{ providerLabel }}</p>
          <p class="text-xs text-ink-muted mt-1">
            Confidence {{ Math.round(providerResult.score * 100) }}%
          </p>
        </div>
        <span class="text-xs font-medium px-3 py-1 rounded-full"
              :class="providerBadgeClass">
          {{ providerResult.kind.replaceAll('_', ' ') }}
        </span>
      </div>

      <div v-if="showDocumentWarning"
           class="bg-amber-500/10 border border-amber-500/25 rounded-xl
                  px-4 py-3 mb-4 flex items-start gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="#f59e0b" stroke-width="2" class="mt-0.5 flex-shrink-0">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div>
          <p class="text-amber-400 text-sm font-medium mb-1">Check this upload</p>
          <p class="text-amber-400/70 text-xs">
            {{ documentWarningText }}
          </p>
        </div>
      </div>

      <div v-if="nlpResult?.isSuspicious"
           class="bg-amber-500/10 border border-amber-500/25 rounded-xl
                  px-4 py-3 mb-4 flex items-start gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="#f59e0b" stroke-width="2" class="mt-0.5 flex-shrink-0">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div>
          <p class="text-amber-400 text-sm font-medium mb-1">Needs review</p>
          <ul class="space-y-0.5">
            <li v-for="r in nlpResult.reasons" :key="r"
                class="text-amber-400/70 text-xs">&#8226; {{ r }}</li>
          </ul>
        </div>
      </div>

      <div v-if="lowConfidence"
           class="bg-amber-500/10 border border-amber-500/25 rounded-xl
                  px-4 py-3 mb-4 flex items-start gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#f59e0b" stroke-width="2" class="mt-0.5 flex-shrink-0">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div>
          <p class="text-amber-400 text-sm font-medium mb-0.5">Low OCR confidence</p>
          <p class="text-amber-400/70 text-xs">
            Image quality may be poor. Please verify extracted fields manually.
          </p>
        </div>
      </div>

      <div class="glass-card p-5 mb-4 space-y-4">
        <p class="text-xs font-medium text-ink-muted uppercase tracking-widest">
          Extracted details
        </p>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-ink-muted mb-1 block">Amount (₹)</label>
            <input v-model.number="editableFields.amount"
                   type="number" class="input-field" />
          </div>
          <div>
            <label class="text-xs text-ink-muted mb-1 block">UPI ID</label>
            <input v-model="editableFields.upiId" class="input-field" />
          </div>
          <div>
            <label class="text-xs text-ink-muted mb-1 block">Transaction ID</label>
            <input v-model="editableFields.transactionId" class="input-field" />
          </div>
          <div>
            <label class="text-xs text-ink-muted mb-1 block">Merchant</label>
            <input v-model="editableFields.merchantName" class="input-field" />
          </div>
          <div>
            <label class="text-xs text-ink-muted mb-1 block">Date</label>
            <input v-model="editableFields.transactionDate" class="input-field" />
          </div>
          <div class="flex items-center justify-between pt-1">
            <span class="text-xs text-ink-muted">Direction</span>
            <span class="text-xs font-medium px-3 py-1 rounded-full"
                  :class="nlpResult?.label === 'sent'
                    ? 'bg-red-500/15 text-red-400'
                    : 'bg-brand-500/15 text-brand-400'">
              {{ nlpResult?.label ?? 'unknown' }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="isDuplicateReceipt"
           class="bg-red-500/10 border border-red-500/25 rounded-xl
                  px-4 py-3 mb-4 flex items-start gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="#f87171" stroke-width="2" class="mt-0.5 flex-shrink-0">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <p class="text-red-400 text-sm font-medium mb-1">Already Scanned</p>
          <p class="text-red-400/70 text-xs">
            This receipt matches one already in your ledger.
          </p>
        </div>
      </div>

      <!-- ── Verify Ownership card ─────────────────────────────────── -->
      <div v-if="ownershipStatus !== 'matched'"
           class="bg-rose-500/10 border border-rose-500/25 rounded-xl
                  px-4 py-4 mb-4 flex flex-col gap-3">
        <div class="flex items-start gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="#f43f5e" stroke-width="2" class="mt-0.5 flex-shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <p class="text-rose-400 text-sm font-medium mb-1">Verify Ownership</p>
            <p class="text-rose-400/80 text-xs">
              We could not verify that this receipt belongs to you.
              Upload your bank statement as a PDF to verify automatically.
            </p>
          </div>
        </div>

        <!-- Manual confirm checkbox (fallback) -->
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" v-model="hasConfirmedOwnership"
                 :disabled="statementVerified"
                 class="w-4 h-4 rounded border-slate-600 bg-surface-card text-brand-500
                        focus:ring-brand-500/30" />
          <span class="text-sm"
                :class="statementVerified ? 'text-ink-muted line-through' : 'text-ink-primary'">
            I confirm this is my personal receipt
          </span>
        </label>

        <!-- Bank statement upload + verify -->
        <div class="mt-1 pt-3 border-t border-rose-500/20 space-y-3">
          <p class="text-xs text-rose-400 font-medium">Verify via Bank Statement (PDF)</p>

          <!-- Upload row -->
          <div class="flex items-center gap-3">
            <label class="flex-1 cursor-pointer">
              <div class="flex items-center gap-2 px-3 py-2 rounded-xl
                          bg-surface-card border border-slate-700/60
                          hover:border-rose-400/40 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" class="text-rose-400 flex-shrink-0">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                <span class="text-xs text-ink-muted flex-1 truncate">
                  {{ statementFile ? statementFile.name : 'Choose bank statement PDF…' }}
                </span>
              </div>
              <input type="file" accept=".pdf"
                     @change="handleStatementFileChange"
                     class="hidden" />
            </label>

            <!-- Verify button -->
            <button
              v-if="statementFile && !statementVerified"
              :disabled="verifier.isVerifying.value"
              @click="verifyBankStatement"
              class="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl
                     bg-rose-500/20 border border-rose-500/40 text-rose-300
                     text-xs font-semibold hover:bg-rose-500/30 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg v-if="verifier.isVerifying.value"
                   class="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor"
                        stroke-width="2" stroke-dasharray="32" stroke-dashoffset="12"/>
              </svg>
              <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              {{ verifier.isVerifying.value ? 'Verifying…' : 'Verify' }}
            </button>
          </div>

          <!-- ✅ Verified badge -->
          <div v-if="statementVerified"
               class="flex items-start gap-2 px-3 py-2.5 rounded-xl
                      bg-emerald-500/10 border border-emerald-500/30">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="#10b981" stroke-width="2.5" class="mt-0.5 flex-shrink-0">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <div>
              <p class="text-emerald-400 text-xs font-semibold">Transaction verified in bank statement</p>
              <p class="text-emerald-400/70 text-xs mt-0.5">
                Matched on: {{ verificationResult?.found ? verificationResult.matchedOn.join(', ') : '' }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Not-Found Modal overlay ─────────────────────────────────── -->
      <Transition name="modal-fade">
        <div v-if="showNotFoundModal"
             class="fixed inset-0 z-50 flex items-center justify-center p-4"
             style="background: rgba(0,0,0,0.7); backdrop-filter: blur(6px);"
             @click.self="showNotFoundModal = false">
          <div class="bg-surface-card border border-red-500/30 rounded-2xl p-6 w-full max-w-sm
                      shadow-2xl space-y-4">
            <!-- Icon -->
            <div class="flex justify-center">
              <div class="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30
                          flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                     stroke="#f87171" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
            </div>

            <div class="text-center">
              <h3 class="text-red-400 font-semibold text-base mb-1">
                Transaction Not Found
              </h3>
              <p class="text-ink-secondary text-sm">
                This transaction was <strong class="text-red-300">not found</strong>
                in your bank statement.
              </p>
              <p v-if="verificationResult && !verificationResult.found"
                 class="text-ink-muted text-xs mt-2">
                {{ verificationResult.reason }}
              </p>
            </div>

            <div class="text-xs text-ink-muted bg-surface-input rounded-xl px-3 py-2.5">
              You can still confirm manually using the checkbox above, or try uploading
              a different / complete bank statement.
            </div>

            <button
              @click="showNotFoundModal = false"
              class="w-full py-2.5 rounded-xl bg-red-500/20 border border-red-500/40
                     text-red-300 text-sm font-semibold
                     hover:bg-red-500/30 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </Transition>

      <div class="flex gap-3">
        <button class="btn-ghost flex-1" @click="resetScan">
          Rescan
        </button>
        <button
          class="btn-primary flex-1"
          :disabled="txns.isLoading.value || isDuplicateReceipt || !canSave"
          @click="confirmSave"
        >
          {{ txns.isLoading.value ? 'Saving...' : 'Confirm & Save' }}
        </button>
      </div>
    </div>

    <div v-else-if="step === 'saved'"
         class="fade-up-2 flex flex-col items-center justify-center
                min-h-[60vh] text-center">
      <div class="w-20 h-20 rounded-full bg-brand-500/15 border border-brand-500/25
                  flex items-center justify-center mb-6 shadow-glow-teal">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
             stroke="#14b8a6" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <h2 class="text-xl font-semibold text-ink-primary mb-2">Saved!</h2>
      <p class="text-ink-secondary text-sm mb-8">
        Transaction added to your ledger
      </p>
      <div class="flex gap-3 w-full max-w-xs">
        <NuxtLink to="/" class="btn-ghost flex-1 text-center">
          Dashboard
        </NuxtLink>
        <button class="btn-primary flex-1" @click="resetScan">
          Scan another
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive, onMounted, watch } from 'vue'
import { useCamera } from '~/composables/useCamera'
import { useOcr } from '~/composables/useOcr'
import { useFieldExtractor } from '~/composables/useFieldExtractor'
import { useNlpValidator } from '~/composables/useNlpValidator'
import { useDocumentClassifier } from '~/composables/useDocumentClassifier'
import { useProviderClassifier } from '~/composables/useProviderClassifier'
import { useSemanticExtractor } from '~/composables/useSemanticExtractor'
import { useTransactions } from '~/composables/useTransactions'
import { useBankStatementVerifier } from '~/composables/useBankStatementVerifier'
import type { VerificationResult } from '~/composables/useBankStatementVerifier'
import type { NlpResult } from '~/composables/useNlpValidator'
import type { DocumentClassificationResult } from '~/composables/useDocumentClassifier'
import type { ProviderClassificationResult } from '~/composables/useProviderClassifier'
import type { SemanticExtractionResult } from '~/types/transaction'
import { useUIStore } from '~/stores/ui'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ middleware: ['auth'] })

const camera = useCamera()
const ocr = useOcr()
const extractor = useFieldExtractor()
const nlp = useNlpValidator()
const documentClassifier = useDocumentClassifier()
const providerClassifier = useProviderClassifier()
const semanticExtractor = useSemanticExtractor()
const txns = useTransactions()
const verifier = useBankStatementVerifier()
const { $auth, $storage, $storageRef, $uploadBytes, $getDownloadURL } = useNuxtApp() as any
const uiStore = useUIStore()
const authStore = useAuthStore()

const lowConfidence = ref(false)
const ocrConfidence = ref(0)

type Step = 'capture' | 'processing' | 'review' | 'saved'
const step = ref<Step>('capture')
const processingStep = ref(0)
const videoRef = ref<HTMLVideoElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const nlpResult = ref<NlpResult | null>(null)
const documentResult = ref<DocumentClassificationResult | null>(null)
const providerResult = ref<ProviderClassificationResult | null>(null)
const semanticResult = ref<SemanticExtractionResult | null>(null)
const ocrText = ref('')
const capturedImageData = ref<string | null>(null)
const isDuplicateReceipt = ref(false)
const ownershipStatus = ref<'matched' | 'ambiguous' | 'mismatched'>('matched')
const hasConfirmedOwnership = ref(false)
const statementFile = ref<File | null>(null)
const statementVerified = ref(false)
const verificationResult = ref<VerificationResult | null>(null)
const showNotFoundModal = ref(false)
const userLegalName = ref('')

const processingSteps = [
  { label: 'Running OCR...' },
  { label: 'Classifying document...' },
  { label: 'Detecting provider...' },
  { label: 'Extracting fields...' },
  { label: 'AI semantic parsing (Transformers)...' },
  { label: 'AI validation...' },
]

const editableFields = reactive({
  transactionId: '',
  upiId: '',
  amount: 0,
  merchantName: '',
  transactionDate: '',
})

watch(
  editableFields,
  async (newFields) => {
    isDuplicateReceipt.value = await txns.isDuplicate(
      newFields.transactionId,
      newFields.amount,
      newFields.merchantName,
      newFields.transactionDate
    )
  },
  { deep: true }
)

const documentLabelMap: Record<string, string> = {
  upi_receipt_success: 'UPI receipt (success)',
  upi_receipt_failed: 'UPI receipt (failed)',
  upi_receipt_pending: 'UPI receipt (pending)',
  bank_statement: 'Bank statement',
  voucher: 'Voucher / invoice',
  unknown: 'Unknown document',
}

const providerLabelMap: Record<string, string> = {
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  generic_upi: 'Generic UPI receipt',
  unknown_provider: 'Unknown provider',
}

const documentLabel = computed(() =>
  documentResult.value ? documentLabelMap[documentResult.value.kind] ?? 'Unknown document' : 'Unknown document'
)

const providerLabel = computed(() =>
  providerResult.value ? providerLabelMap[providerResult.value.kind] ?? 'Unknown provider' : 'Unknown provider'
)

const documentBadgeClass = computed(() => {
  switch (documentResult.value?.kind) {
    case 'upi_receipt_success':
      return 'bg-brand-500/15 text-brand-400'
    case 'upi_receipt_failed':
      return 'bg-red-500/15 text-red-400'
    case 'upi_receipt_pending':
      return 'bg-amber-500/15 text-amber-400'
    case 'bank_statement':
      return 'bg-sky-500/15 text-sky-400'
    case 'voucher':
      return 'bg-violet-500/15 text-violet-400'
    default:
      return 'bg-slate-700/60 text-ink-muted'
  }
})

const providerBadgeClass = computed(() => {
  switch (providerResult.value?.kind) {
    case 'gpay':
      return 'bg-blue-500/15 text-blue-400'
    case 'phonepe':
      return 'bg-violet-500/15 text-violet-400'
    case 'paytm':
      return 'bg-sky-500/15 text-sky-400'
    case 'generic_upi':
      return 'bg-brand-500/15 text-brand-400'
    default:
      return 'bg-slate-700/60 text-ink-muted'
  }
})

const showDocumentWarning = computed(() =>
  documentResult.value?.kind === 'unknown'
  || documentResult.value?.kind === 'bank_statement'
  || documentResult.value?.kind === 'voucher'
  || documentResult.value?.kind === 'upi_receipt_failed'
  || documentResult.value?.kind === 'upi_receipt_pending'
)

const documentWarningText = computed(() => {
  switch (documentResult.value?.kind) {
    case 'unknown':
      return 'This does not look clearly like a UPI receipt yet, so please double-check the extracted fields.'
    case 'bank_statement':
      return 'This looks more like a bank statement than a receipt. We will support statement parsing next, but this scan flow is still tuned for receipts.'
    case 'voucher':
      return 'This looks more like an invoice or voucher than a payment receipt.'
    case 'upi_receipt_failed':
      return 'The text suggests this transaction failed, so it should not be treated as a verified payment.'
    case 'upi_receipt_pending':
      return 'The text suggests this transaction is still pending.'
    default:
      return ''
  }
})

onMounted(async () => {
  if (videoRef.value) await camera.startCamera(videoRef.value)

  const uid = $auth.currentUser?.uid
  if (uid) {
    try {
      const { doc, getDoc } = await import('firebase/firestore')
      const { $db } = useNuxtApp() as any
      const docSnap = await getDoc(doc($db, 'users', uid))
      if (docSnap.exists()) {
        userLegalName.value = docSnap.data().legalName?.toLowerCase() || ''
      }
    } catch (e) {
      console.error('Failed to fetch user profile', e)
    }
  }
})

async function handleCapture() {
  const imageData = camera.captureFrame()
  if (!imageData) return
  capturedImageData.value = imageData
  await processImage(imageData)
}

async function handleFileUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) {
    console.log('No file selected')
    return
  }

  console.log('File selected:', file.name, file.size)
  const reader = new FileReader()

  reader.onload = async (ev) => {
    const result = ev.target?.result as string
    console.log('File read complete, starting processImage')
    capturedImageData.value = result
    await processImage(result)
  }

  reader.onerror = (err) => {
    console.error('FileReader error:', err)
  }

  reader.readAsDataURL(file)
}

async function processImage(imageData: string) {
  console.log('processImage called')
  step.value = 'processing'
  processingStep.value = 0
  camera.stopCamera()

  console.log('Starting OCR...')
  const ocrResult = await ocr.recognize(imageData)
  console.log('OCR result:', ocrResult)

  if (!ocrResult) {
    console.error('OCR failed, going back to capture')
    step.value = 'capture'
    return
  }

  lowConfidence.value = ocrResult.confidence < 70
  ocrText.value = ocrResult.text
  ocrConfidence.value = ocrResult.confidence
  processingStep.value = 1

  documentResult.value = documentClassifier.classify(ocrText.value)
  processingStep.value = 2

  providerResult.value = providerClassifier.classify(ocrText.value)
  processingStep.value = 3

  if (providerResult.value.kind !== 'unknown_provider') {
    const providerOcrResult = await ocr.recognizeProviderAmountRegion(imageData, providerResult.value.kind)
    if (providerOcrResult?.text) {
      ocrText.value = [providerOcrResult.text, ocrText.value].filter(Boolean).join('\n')
      ocrConfidence.value = Math.max(ocrConfidence.value, providerOcrResult.confidence)
      console.log('Provider-focused OCR text:', providerOcrResult.text)
    }
  }

  console.log('Extracting fields from:', ocrText.value)
  const fields = extractor.extract(
    ocrText.value,
    documentResult.value?.kind ?? 'unknown',
    providerResult.value?.kind ?? 'unknown_provider'
  )
  console.log('Extracted fields:', fields)
  processingStep.value = 4
  
  semanticResult.value = await semanticExtractor.extract(ocrText.value, {
    documentKind: documentResult.value?.kind ?? 'unknown',
    provider: providerResult.value?.kind ?? 'unknown_provider',
  })
  console.log('Semantic extraction:', semanticResult.value)

  const mergedFields = {
    transactionId: semanticResult.value.transaction_id || fields.transactionId || '',
    upiId: fields.upiId || '',
    amount: semanticResult.value.amount && semanticResult.value.amount > 0
      ? semanticResult.value.amount
      : (fields.amount ?? 0),
    merchantName: semanticResult.value.receiver || fields.merchantName || '',
    transactionDate: semanticResult.value.date || fields.transactionDate || '',
  }

  Object.assign(editableFields, mergedFields)
  processingStep.value = 5

  console.log('Running NLP...')
  nlpResult.value = nlp.classify(ocrText.value, mergedFields.amount ?? 0)
  if (semanticResult.value?.direction && semanticResult.value.direction !== 'unknown') {
    nlpResult.value = {
      ...nlpResult.value,
      label: semanticResult.value.direction,
      score: Math.max(nlpResult.value?.score ?? 0, 0.82),
    }
  }
  console.log('NLP result:', nlpResult.value)
  processingStep.value = 6

  const userName = authStore.user?.displayName?.toLowerCase() || ''
  const nameToMatch = userLegalName.value || userName

  if (!nameToMatch || nameToMatch.length < 3) {
    ownershipStatus.value = 'ambiguous'
  } else {
    const ocrTextLower = ocrText.value.toLowerCase()
    
    if (ocrTextLower.includes(nameToMatch)) {
      ownershipStatus.value = 'matched'
    } else {
      const nameParts = nameToMatch.split(/\s+/).filter(p => p.length > 2)
      if (nameParts.length > 0 && nameParts.every(part => ocrTextLower.includes(part))) {
        ownershipStatus.value = 'matched'
      } else {
        ownershipStatus.value = 'ambiguous'
      }
    }
  }

  step.value = 'review'
}

// ── Bank statement verification ────────────────────────────────────────────

/** Reset verification state when a new file is selected */
function handleStatementFileChange(e: Event) {
  statementFile.value = (e.target as HTMLInputElement).files?.[0] || null
  statementVerified.value = false
  verificationResult.value = null
  showNotFoundModal.value = false
}

/** Parse the PDF and check if the receipt transaction is in it */
async function verifyBankStatement() {
  if (!statementFile.value) return

  const result = await verifier.verifyStatement(statementFile.value, {
    transactionId: editableFields.transactionId,
    amount: editableFields.amount,
    transactionDate: editableFields.transactionDate,
    merchantName: editableFields.merchantName,
    upiId: editableFields.upiId,
  })

  verificationResult.value = result

  if (result.found) {
    statementVerified.value = true
    showNotFoundModal.value = false
    uiStore.success('Transaction found in bank statement ✓')
  } else {
    statementVerified.value = false
    showNotFoundModal.value = true
  }
}

/** Whether the user may proceed to save */
const canSave = computed(() => {
  if (ownershipStatus.value === 'matched') return true   // auto-matched by name
  if (statementVerified.value) return true               // verified via PDF
  if (hasConfirmedOwnership.value) return true           // manual checkbox
  return false
})

function resolveStatus() {
  switch (documentResult.value?.kind) {
    case 'upi_receipt_failed':
      return 'failed'
    case 'upi_receipt_pending':
      return 'pending'
    case 'unknown':
    case 'bank_statement':
    case 'voucher':
      return 'flagged'
    default:
      return nlpResult.value?.isSuspicious ? 'flagged' : 'verified'
  }
}

async function confirmSave() {
  const uid = $auth.currentUser?.uid
  if (!uid) return

  try {
    let statementUrl = ''
    if (statementFile.value) {
      uiStore.success('Uploading statement...')
      const stRef = $storageRef($storage, `statements/${uid}/${Date.now()}_${statementFile.value.name}`)
      await $uploadBytes(stRef, statementFile.value)
      statementUrl = await $getDownloadURL(stRef)
    }

    const oMode = ownershipStatus.value === 'matched' ? 'auto' : 'manual'
    const finalStatus = oMode === 'manual' ? 'verified_manual' : resolveStatus()

    const txnData: any = {
      userId: uid,
      ...editableFields,
      direction: nlpResult.value?.label === 'sent' ? 'sent' : 'received',
      status: finalStatus as any,
      ocrRawText: ocrText.value,
      ocrConfidence: ocrConfidence.value,
      nlpLabel: nlpResult.value?.label ?? 'unknown',
      nlpScore: nlpResult.value?.score ?? 0,
      ownerVerifiedMode: oMode,
    }
    
    if (statementUrl) {
      txnData.statementUrl = statementUrl
    }

    await txns.saveTransaction(txnData)
    step.value = 'saved'
  } catch (e: any) {
    uiStore.error(e.message)
  }
}

async function resetScan() {
  camera.reset()
  capturedImageData.value = null
  step.value = 'capture'
  processingStep.value = 0
  nlpResult.value = null
  documentResult.value = null
  providerResult.value = null
  semanticResult.value = null
  ocrText.value = ''
  ownershipStatus.value = 'matched'
  hasConfirmedOwnership.value = false
  statementFile.value = null
  statementVerified.value = false
  verificationResult.value = null
  showNotFoundModal.value = false
  isDuplicateReceipt.value = false
  lowConfidence.value = false
  ocrConfidence.value = 0

  Object.assign(editableFields, {
    transactionId: '',
    upiId: '',
    amount: 0,
    merchantName: '',
    transactionDate: '',
  })

  if (videoRef.value) await camera.startCamera(videoRef.value)
}
</script>
