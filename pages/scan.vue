<!-- pages/scan.vue -->
<template>
  <div class="min-h-screen bg-surface-base px-5 pt-14 pb-28 relative overflow-hidden">

    <!-- Background orb -->
    <div class="orb-1 absolute top-[-100px] right-[-60px] w-[300px] h-[300px]
                rounded-full bg-brand-500/6 blur-3xl pointer-events-none" />

    <!-- Header -->
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

    <!-- STEP: capture -->
    <div v-if="step === 'capture'" class="fade-up-2">
      <div class="glass-card overflow-hidden mb-4 relative min-h-[240px]">

        <!-- Camera preview -->
        <video
          ref="videoRef"
          autoplay
          playsinline
          class="w-full aspect-video object-cover bg-surface-input"
          :class="{ 'opacity-0': !camera.isActive.value }"
        />

        <!-- Scanner overlay -->
        <div v-if="camera.isActive.value"
             class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div class="relative w-64 h-40">
            <div class="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-brand-500 rounded-tl-lg"></div>
            <div class="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-brand-500 rounded-tr-lg"></div>
            <div class="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-brand-500 rounded-bl-lg"></div>
            <div class="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-brand-500 rounded-br-lg"></div>
          </div>
        </div>

        <!-- Camera loading -->
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

        <!-- Camera error -->
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

      <!-- Controls -->
      <div class="flex items-center justify-center gap-6 mt-4">

        <!-- Gallery button -->
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

        <!-- Shutter button -->
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

    <!-- STEP: processing -->
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

    <!-- STEP: review -->
    <div v-else-if="step === 'review'" class="fade-up-2">

      <!-- Fraud alert -->
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
                class="text-amber-400/70 text-xs">• {{ r }}</li>
          </ul>
        </div>
      </div>

      <!-- Fields -->
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

      <!-- Actions -->
      <div class="flex gap-3">
        <button class="btn-ghost flex-1" @click="resetScan">
          Rescan
        </button>
        <button
          class="btn-primary flex-1"
          :disabled="txns.isLoading.value"
          @click="confirmSave"
        >
          {{ txns.isLoading.value ? 'Saving...' : 'Confirm & Save' }}
        </button>
      </div>
    </div>

    <!-- STEP: saved -->
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
import { ref, reactive, onMounted } from 'vue'
import { useCamera } from '~/composables/useCamera'
import { useOcr } from '~/composables/useOcr'
import { useFieldExtractor } from '~/composables/useFieldExtractor'
import { useNlpValidator } from '~/composables/useNlpValidator'
import { useTransactions } from '~/composables/useTransactions'
import type { NlpResult } from '~/composables/useNlpValidator'

definePageMeta({ middleware: ['auth'] })

const camera    = useCamera()
const ocr       = useOcr()
const extractor = useFieldExtractor()
const nlp       = useNlpValidator()
const txns      = useTransactions()
const { $auth } = useNuxtApp() as any

type Step = 'capture' | 'processing' | 'review' | 'saved'
const step             = ref<Step>('capture')
const processingStep   = ref(0)
const videoRef         = ref<HTMLVideoElement | null>(null)
const fileInputRef     = ref<HTMLInputElement | null>(null)
const nlpResult        = ref<NlpResult | null>(null)
const ocrText          = ref('')
const capturedImageData = ref<string | null>(null)  // ← stores image for preview

const processingSteps = [
  { label: 'Running OCR...' },
  { label: 'Extracting fields...' },
  { label: 'AI validation...' },
]

const editableFields = reactive({
  transactionId:   '',
  upiId:           '',
  amount:          0,
  merchantName:    '',
  transactionDate: '',
})

onMounted(async () => {
  if (videoRef.value) await camera.startCamera(videoRef.value)
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

  // Step 1: OCR
  console.log('Starting OCR...')
  const ocrResult = await ocr.recognize(imageData)
  console.log('OCR result:', ocrResult)
  if (!ocrResult) {
    console.error('OCR failed, going back to capture')
    step.value = 'capture'
    return
  }
  ocrText.value = ocrResult.text
  processingStep.value = 1

  // Step 2: Extract fields
  console.log('Extracting fields from:', ocrResult.text)
  const fields = extractor.extract(ocrResult.text)
  console.log('Extracted fields:', fields)
  Object.assign(editableFields, fields)
  processingStep.value = 2

  // Step 3: NLP validation
  console.log('Running NLP...')
  nlpResult.value = await nlp.classify(ocrResult.text, fields.amount ?? 0)
  console.log('NLP result:', nlpResult.value)
  processingStep.value = 3

  step.value = 'review'
}

async function confirmSave() {
  const uid = $auth.currentUser?.uid
  if (!uid) return

  await txns.saveTransaction({
    userId:        uid,
    ...editableFields,
    direction:     nlpResult.value?.label === 'sent' ? 'sent' : 'received',
    status:        nlpResult.value?.isSuspicious ? 'flagged' : 'verified',
    ocrRawText:    ocrText.value,
    ocrConfidence: 0,
    nlpLabel:      nlpResult.value?.label ?? 'unknown',
    nlpScore:      nlpResult.value?.score ?? 0,
  })

  step.value = 'saved'
}

async function resetScan() {
  camera.reset()
  capturedImageData.value = null
  step.value = 'capture'
  processingStep.value = 0
  nlpResult.value = null
  ocrText.value = ''
  Object.assign(editableFields, {
    transactionId: '', upiId: '', amount: 0,
    merchantName: '', transactionDate: ''
  })
  if (videoRef.value) await camera.startCamera(videoRef.value)
}
</script>