<template>
  <div class="min-h-screen bg-surface-base px-5 pt-14 pb-28 relative overflow-x-hidden">
    <div class="orb-1 absolute top-[-100px] right-[-60px] w-[300px] h-[300px]
                rounded-full bg-brand-500/6 blur-3xl pointer-events-none" />

    <div class="fade-up-1 flex items-center gap-4 mb-8">
      <NuxtLink to="/"
        class="w-10 h-10 rounded-xl bg-surface-card border border-[color:var(--border-color)]
               flex items-center justify-center text-ink-secondary
               hover:text-ink-primary hover:border-brand-500/30 transition-all shadow-sm">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </NuxtLink>
      <h1 class="text-xl font-bold text-ink-primary tracking-tight">Scan Receipt</h1>
    </div>

    <div v-if="step === 'capture'" class="fade-up-2">
      <!-- Camera viewport: dynamic aspect ratio for mobile vs desktop -->
      <div class="glass-card-premium overflow-hidden mb-5 relative w-full aspect-[3/4.2] sm:aspect-video rounded-2xl">
        <video
          ref="videoRef"
          autoplay
          playsinline
          class="w-full h-full object-cover bg-surface-input"
          :class="{ 'opacity-0': !camera.isActive.value }"
        />

        <!-- Gemini-like Viewfinder with glowing corner brackets & scanning laser -->
        <div v-if="camera.isActive.value"
             class="absolute inset-0 flex items-center justify-center pointer-events-none p-5">
          <div class="relative w-full max-w-[280px] aspect-[3/4.8] sm:aspect-video sm:max-w-md border border-white/5 rounded-2xl transition-all duration-300">
            <!-- Corner Brackets -->
            <div class="absolute top-[-2px] left-[-2px] w-8 h-8 border-t-4 border-l-4 border-brand-500 rounded-tl-xl shadow-glow"></div>
            <div class="absolute top-[-2px] right-[-2px] w-8 h-8 border-t-4 border-r-4 border-brand-500 rounded-tr-xl shadow-glow"></div>
            <div class="absolute bottom-[-2px] left-[-2px] w-8 h-8 border-b-4 border-l-4 border-brand-500 rounded-bl-xl shadow-glow"></div>
            <div class="absolute bottom-[-2px] right-[-2px] w-8 h-8 border-b-4 border-r-4 border-brand-500 rounded-br-xl shadow-glow"></div>
            
            <!-- Gemini-like scanning beam overlay -->
            <div class="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
              <div class="scanner-laser absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand-500 to-transparent shadow-[0_0_12px_rgba(var(--glow-color),0.8),0_0_24px_rgba(var(--glow-color),0.5)]"></div>
              <!-- Ambient pulse grid -->
              <div class="absolute inset-0 opacity-[0.03] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-500 via-transparent to-transparent animate-pulse bg-grid-pattern"></div>
            </div>
          </div>
        </div>

        <div v-if="!camera.isActive.value && !camera.error.value"
             class="absolute inset-0 flex items-center justify-center bg-surface-input">
          <div class="flex flex-col items-center gap-3 text-ink-muted">
            <svg class="animate-spin w-8 h-8 text-brand-500" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor"
                      stroke-width="2.5" stroke-dasharray="32" stroke-dashoffset="12"/>
            </svg>
            <p class="text-sm font-semibold tracking-wide">Starting Camera Stream...</p>
          </div>
        </div>

        <div v-if="camera.error.value"
             class="absolute inset-0 flex items-center justify-center bg-surface-input px-6">
          <div class="text-center max-w-xs">
            <p class="text-red-400 text-sm mb-5 font-semibold">{{ camera.error.value }}</p>
            <label class="btn-primary text-xs cursor-pointer px-5 py-2.5 rounded-xl shadow-lg flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Upload from gallery
              <input type="file" accept="image/*" class="hidden" @change="handleFileUpload" />
            </label>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between gap-4 mt-6">
        <!-- Gallery Upload -->
        <label class="btn-ghost flex-1 flex items-center justify-center gap-2 cursor-pointer py-3.5 rounded-xl border border-slate-200/50 dark:border-slate-800/80">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span class="text-xs font-bold">Gallery</span>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            class="hidden"
            @change="handleFileUpload"
          />
        </label>

        <!-- WebRTC Shutter Capture -->
        <button
          class="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-500 to-sky-500 shadow-[0_0_20px_rgba(99,102,241,0.3)]
                 flex items-center justify-center transition-all duration-300
                 hover:scale-105 active:scale-95 disabled:opacity-40 flex-shrink-0"
          :disabled="!camera.isActive.value"
          @click="handleCapture"
        >
          <div class="w-12 h-12 rounded-full border-2 border-white/30
                      flex items-center justify-center">
            <div class="w-8 h-8 rounded-full bg-white/90 shadow-inner"></div>
          </div>
        </button>

        <!-- Native High-Res Camera App -->
        <label class="btn-primary flex-1 flex items-center justify-center gap-2 cursor-pointer py-3.5 rounded-xl shadow-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span class="text-xs font-bold">Camera App</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            class="hidden"
            @change="handleFileUpload"
          />
        </label>
      </div>

      <!-- Scanning guidance tip card -->
      <div class="mt-6 p-4 rounded-2xl bg-surface-card border border-[color:var(--border-color)] shadow-sm">
        <div class="flex items-start gap-3">
          <span class="text-lg">💡</span>
          <div>
            <h4 class="text-xs font-extrabold text-ink-primary tracking-tight uppercase">Tips for screen verification</h4>
            <p class="text-[10px] text-ink-muted leading-relaxed mt-1">
              If scanning a receipt shown on another person's mobile phone, tap <strong>Camera App</strong>. 
              This boots your device's native high-resolution camera with active macro autofocus to fully bypass screen moire-grids and glare!
            </p>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="step === 'processing'" class="fade-up-2">
      <div class="glass-card-premium p-6 mb-4 overflow-hidden relative">
        <div class="absolute top-0 right-0 w-48 h-48 rounded-full bg-brand-500/5 blur-3xl pointer-events-none" />
        <div class="relative w-full rounded-2xl mb-6 overflow-hidden max-h-56 shadow-[var(--shadow-card)] border border-white/5">
          <img
            v-if="capturedImageData"
            :src="capturedImageData"
            class="w-full object-cover max-h-56"
          />
          <!-- Scanning overlay line sweep while processing -->
          <div class="absolute inset-0 pointer-events-none">
            <div class="scanner-laser absolute left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-brand-500 to-transparent shadow-[0_0_15px_rgba(var(--glow-color),0.8)]"></div>
          </div>
        </div>

        <div class="space-y-4">
          <div v-for="(s, i) in processingSteps" :key="i"
               class="flex items-center gap-3.5 transition-all duration-300">
            <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border"
                 :class="i < processingStep
                   ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                   : i === processingStep
                     ? 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                     : 'bg-surface-input border-transparent text-ink-muted'">
              <svg v-if="i < processingStep" width="16" height="16"
                   viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <svg v-else-if="i === processingStep"
                   class="animate-spin" width="16" height="16"
                   viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor"
                        stroke-width="2.5" stroke-dasharray="32" stroke-dashoffset="12"/>
              </svg>
              <span v-else class="text-xs font-mono font-bold">{{ i + 1 }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold transition-colors duration-300"
                 :class="i <= processingStep ? 'text-ink-primary' : 'text-ink-muted'">
                {{ s.label }}
              </p>
              <p v-if="i === 0 && processingStep === 0"
                 class="text-xs text-brand-400 font-semibold font-mono mt-0.5 animate-pulse">
                {{ ocr.ocrProgress.value }}% Completed
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="step === 'review'" class="fade-up-2">
      <!-- Grid for Results -->
      <div class="grid grid-cols-1 gap-4 mb-4">
        <div v-if="documentResult"
             class="glass-card-premium p-4 flex items-center justify-between gap-3 border-l-4 border-l-indigo-500">
          <div>
            <p class="text-[9px] text-ink-muted uppercase font-bold tracking-wider mb-0.5">Detected Document</p>
            <p class="text-sm font-bold text-ink-primary">{{ documentLabel }}</p>
            <p class="text-[10px] text-ink-secondary mt-0.5">
              Confidence {{ Math.round(documentResult.score * 100) }}%
            </p>
          </div>
          <span class="text-xs font-bold px-3 py-1 rounded-full"
                :class="documentBadgeClass">
            {{ documentResult.kind.replaceAll('_', ' ') }}
          </span>
        </div>

        <div v-if="providerResult"
             class="glass-card-premium p-4 flex items-center justify-between gap-3 border-l-4 border-l-cyan-500">
          <div>
            <p class="text-[9px] text-ink-muted uppercase font-bold tracking-wider mb-0.5">Detected Provider</p>
            <p class="text-sm font-bold text-ink-primary">{{ providerLabel }}</p>
            <p class="text-[10px] text-ink-secondary mt-0.5">
              Confidence {{ Math.round(providerResult.score * 100) }}%
            </p>
          </div>
          <span class="text-xs font-bold px-3 py-1 rounded-full"
                :class="providerBadgeClass">
            {{ providerResult.kind.replaceAll('_', ' ') }}
          </span>
        </div>
      </div>

      <!-- Warning Callouts -->
      <div v-if="showDocumentWarning"
           class="bg-amber-500/10 border border-amber-500/20 rounded-2xl
                  px-4 py-3.5 mb-4 flex items-start gap-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="#f59e0b" stroke-width="2.5" class="mt-0.5 flex-shrink-0">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div>
          <p class="text-amber-500 dark:text-amber-400 text-sm font-bold mb-0.5">Check this upload</p>
          <p class="text-amber-600/80 dark:text-amber-400/70 text-xs leading-relaxed">
            {{ documentWarningText }}
          </p>
        </div>
      </div>

      <div v-if="nlpResult?.isSuspicious"
           class="bg-amber-500/10 border border-amber-500/20 rounded-2xl
                  px-4 py-3.5 mb-4 flex items-start gap-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="#f59e0b" stroke-width="2.5" class="mt-0.5 flex-shrink-0">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div>
          <p class="text-amber-500 dark:text-amber-400 text-sm font-bold mb-0.5">Needs review</p>
          <ul class="space-y-0.5">
            <li v-for="r in nlpResult.reasons" :key="r"
                 class="text-amber-600/80 dark:text-amber-400/70 text-xs">&#8226; {{ r }}</li>
          </ul>
        </div>
      </div>

      <div v-if="lowConfidence"
           class="bg-amber-500/10 border border-amber-500/20 rounded-2xl
                  px-4 py-3.5 mb-4 flex items-start gap-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="#f59e0b" stroke-width="2.5" class="mt-0.5 flex-shrink-0">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div>
          <p class="text-amber-500 dark:text-amber-400 text-sm font-bold mb-0.5">Low OCR confidence</p>
          <p class="text-amber-600/80 dark:text-amber-400/70 text-xs leading-relaxed">
            Image quality may be poor. Please verify extracted fields manually.
          </p>
        </div>
      </div>

      <!-- Extracted details form -->
      <div class="glass-card-premium p-5 mb-4 space-y-4">
        <p class="text-xs font-bold text-ink-muted uppercase tracking-widest">
          Extracted details
        </p>
        <div class="space-y-4">
          <div>
            <label class="text-[10px] font-bold text-ink-secondary mb-1.5 block uppercase tracking-wider">Amount (₹)</label>
            <input v-model.number="editableFields.amount"
                   type="number" class="input-field font-mono font-bold" />
          </div>
          <div>
            <label class="text-[10px] font-bold text-ink-secondary mb-1.5 block uppercase tracking-wider">UPI ID</label>
            <input v-model="editableFields.upiId" class="input-field font-mono" />
          </div>
          <div>
            <label class="text-[10px] font-bold text-ink-secondary mb-1.5 block uppercase tracking-wider">Transaction ID</label>
            <input v-model="editableFields.transactionId" class="input-field font-mono" />
          </div>
          <div>
            <label class="text-[10px] font-bold text-ink-secondary mb-1.5 block uppercase tracking-wider">Merchant</label>
            <input v-model="editableFields.merchantName" class="input-field" />
          </div>
          <div>
            <label class="text-[10px] font-bold text-ink-secondary mb-1.5 block uppercase tracking-wider">Date</label>
            <input v-model="editableFields.transactionDate" class="input-field font-mono" />
          </div>
          <div>
            <label class="text-[10px] font-bold text-ink-secondary mb-1.5 block uppercase tracking-wider">Category</label>
            <select v-model="editableFields.category" class="input-field w-full">
              <option v-for="cat in CATEGORIES" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-[color:var(--border-color)]">
            <span class="text-xs font-semibold text-ink-secondary">Transaction Direction</span>
            <span class="text-xs font-bold px-3 py-1 rounded-full"
                  :class="nlpResult?.label === 'sent'
                    ? 'bg-red-500/15 text-red-400'
                    : 'bg-emerald-500/15 text-emerald-400'">
              {{ nlpResult?.label ?? 'unknown' }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="isDuplicateReceipt"
           class="bg-red-500/10 border border-red-500/20 rounded-2xl
                  px-4 py-3.5 mb-4 flex items-start gap-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="#f87171" stroke-width="2.5" class="mt-0.5 flex-shrink-0">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <p class="text-red-400 text-sm font-bold mb-0.5">Already Scanned</p>
          <p class="text-red-400/70 text-xs leading-relaxed">
            This receipt matches one already in your ledger.
          </p>
        </div>
      </div>

      <!-- ── Verify Ownership card ─────────────────────────────────── -->
      <div v-if="ownershipStatus !== 'matched'"
           class="bg-rose-500/5 border border-rose-500/20 rounded-2xl
                  px-5 py-5 mb-5 flex flex-col gap-4 shadow-sm">
        <div class="flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="#f43f5e" stroke-width="2.5" class="mt-0.5 flex-shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <p class="text-rose-500 dark:text-rose-400 text-sm font-bold mb-1">Verify Ownership</p>
            <p class="text-rose-600/80 dark:text-rose-400/75 text-xs leading-relaxed">
              We could not verify that this receipt belongs to you.
              Upload your bank statement as a PDF to verify automatically.
            </p>
          </div>
        </div>

        <!-- Manual confirm checkbox (fallback) -->
        <label class="flex items-center gap-3 cursor-pointer select-none">
          <input type="checkbox" v-model="hasConfirmedOwnership"
                 :disabled="statementVerified"
                 class="w-4 h-4 rounded border-slate-300 dark:border-slate-800 text-rose-500 focus:ring-rose-500/20" />
          <span class="text-xs font-semibold"
                :class="statementVerified ? 'text-ink-muted line-through' : 'text-ink-primary'">
            I confirm this is my personal receipt
          </span>
        </label>

        <!-- Bank statement upload + verify -->
        <div class="mt-2 pt-4 border-t border-rose-500/10 space-y-3.5">
          <p class="text-xs font-bold text-rose-500 uppercase tracking-wider">Verify via Bank Statement (PDF)</p>

          <!-- Upload row -->
          <div class="flex items-center gap-3">
            <label class="flex-1 cursor-pointer">
              <div class="flex items-center gap-2.5 px-4.5 py-3 rounded-xl
                          bg-surface-card border border-[color:var(--border-color)]
                          hover:border-rose-400/40 hover:bg-rose-500/5 transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" class="text-rose-400 flex-shrink-0">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                <span class="text-xs text-ink-secondary font-semibold flex-1 truncate">
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
              class="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 rounded-xl
                     bg-rose-500/10 border border-rose-500/25 text-rose-400
                     text-xs font-bold hover:bg-rose-500/20 active:scale-[0.98] transition-all
                     disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg v-if="verifier.isVerifying.value"
                   class="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor"
                        stroke-width="2.5" stroke-dasharray="32" stroke-dashoffset="12"/>
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              {{ verifier.isVerifying.value ? 'Verifying…' : 'Verify' }}
            </button>
          </div>

          <!-- ✅ Verified badge -->
          <div v-if="statementVerified"
               class="flex items-start gap-2.5 px-4 py-3 rounded-xl
                      bg-emerald-500/10 border border-emerald-500/20 shadow-inner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="#10b981" stroke-width="2.5" class="mt-0.5 flex-shrink-0">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <div>
              <p class="text-emerald-500 dark:text-emerald-400 text-xs font-bold">Transaction verified in statement</p>
              <p class="text-emerald-600/75 dark:text-emerald-400/70 text-[10px] font-semibold mt-0.5">
                Matched on: {{ verificationResult?.found ? verificationResult.matchedOn.join(', ') : '' }}
              </p>
            </div>
          </div>

          <!-- ❌ Verification failed/rejected badge -->
          <div v-if="verificationResult && !verificationResult.found"
               class="flex items-start gap-2.5 px-4 py-3 rounded-xl
                      bg-red-500/10 border border-red-500/20 shadow-inner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="#f87171" stroke-width="2.5" class="mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <div>
              <p class="text-red-500 dark:text-red-400 text-xs font-bold">Verification rejected (Not found in statement)</p>
              <p class="text-red-600/75 dark:text-red-400/70 text-[10px] font-semibold mt-0.5">
                {{ verificationResult.reason }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Not-Found Modal overlay ─────────────────────────────────── -->
      <Transition name="modal-fade">
        <div v-if="showNotFoundModal"
             class="fixed inset-0 z-50 flex items-center justify-center p-4"
             style="background: rgba(0,0,0,0.75); backdrop-filter: blur(8px);"
             @click.self="showNotFoundModal = false">
          <div class="glass-card-premium border border-red-500/20 rounded-2xl p-6 w-full max-w-sm
                      shadow-2xl space-y-4">
            <!-- Icon -->
            <div class="flex justify-center">
              <div class="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20
                          flex items-center justify-center shadow-glow-sm">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                     stroke="#f87171" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
            </div>

            <div class="text-center">
              <h3 class="text-red-400 font-bold text-base mb-1">
                Transaction Not Found
              </h3>
              <p class="text-ink-secondary text-sm leading-relaxed">
                This transaction was <strong class="text-red-300">not found</strong>
                in your bank statement.
              </p>
              <p v-if="verificationResult && !verificationResult.found"
                 class="text-ink-muted text-xs font-semibold font-mono mt-2 bg-surface-input/30 py-1 rounded">
                {{ verificationResult.reason }}
              </p>
            </div>

            <div class="text-[10px] font-semibold text-ink-muted bg-surface-input/50 rounded-xl px-4.5 py-3 leading-relaxed">
              You can still confirm manually using the checkbox above, or try uploading
              a different / complete bank statement.
            </div>

            <button
              @click="showNotFoundModal = false"
              class="w-full py-3 rounded-xl bg-red-500/20 border border-red-500/30
                     text-red-300 text-sm font-bold active:scale-[0.98]
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
             stroke="#0ea5e9" stroke-width="2">
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
import { CATEGORIES, categorizeMerchant } from '~/composables/useCategoryHelper'
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
  category: 'Others',
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
  editableFields.category = categorizeMerchant(mergedFields.merchantName, ocrText.value)
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

    const oMode = (ownershipStatus.value === 'matched' || statementVerified.value) ? 'auto' : 'manual'
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
      txnData.statementVerified = statementVerified.value
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
    category: 'Others',
  })

  if (videoRef.value) await camera.startCamera(videoRef.value)
}
</script>
