<template>
  <div class="min-h-screen bg-surface-base bg-grid-pattern
              flex items-center justify-center px-5 overflow-hidden relative">

    <!-- Background orbs -->
    <div class="orb-1 absolute top-[-120px] right-[-80px] w-[380px] h-[380px]
                rounded-full bg-brand-500/8 blur-3xl pointer-events-none" />
    <div class="orb-2 absolute bottom-[-80px] left-[-60px] w-[280px] h-[280px]
                rounded-full bg-brand-600/6 blur-3xl pointer-events-none" />

    <div class="w-full max-w-[360px] relative z-10">

      <!-- Logo -->
      <div class="fade-up-1 text-center mb-10">
        <div class="inline-flex items-center justify-center w-16 h-16
                    rounded-2xl bg-brand-500/10 border border-brand-500/20
                    shadow-glow-sm mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L4.5 13.5H12L11 22L19.5 10.5H12L13 2Z"
                  fill="#14b8a6" stroke="#14b8a6"
                  stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        </div>
        <h1 class="text-2xl font-semibold text-ink-primary tracking-tight">
          SnapPay
        </h1>
        <p class="text-ink-secondary text-sm mt-1.5">
          Verify UPI receipts in seconds
        </p>
      </div>

      <!-- Card -->
      <div class="fade-up-2 glass-card p-6">

        <!-- Phone step -->
        <div v-if="!otpSent">
          <p class="text-xs font-medium text-ink-muted uppercase tracking-widest mb-4">
            Sign in
          </p>

          <label class="text-xs text-ink-secondary mb-1.5 block">
            Mobile number
          </label>
          <div class="flex gap-2 mb-4">
            <div class="input-field w-16 text-center flex-shrink-0
                        text-ink-secondary text-sm">
              +91
            </div>
            <input
              v-model="phone"
              type="tel"
              maxlength="10"
              placeholder="9876543210"
              class="input-field flex-1"
              @keyup.enter="sendOTP"
            />
          </div>

          <button
            class="btn-primary w-full mb-4"
            :disabled="phone.length !== 10 || loading"
            @click="sendOTP"
          >
            <span v-if="!loading">Send OTP</span>
            <span v-else class="flex items-center justify-center gap-2">
              <svg class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor"
                        stroke-width="3" stroke-dasharray="32" stroke-dashoffset="12"/>
              </svg>
              Sending...
            </span>
          </button>

          <div class="flex items-center gap-3 mb-4">
            <div class="flex-1 h-px bg-slate-700/60"></div>
            <span class="text-xs text-ink-muted">or</span>
            <div class="flex-1 h-px bg-slate-700/60"></div>
          </div>

          <button class="btn-ghost w-full flex items-center justify-center gap-3"
                  @click="signInGoogle">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </div>

        <!-- OTP step -->
        <div v-else>
          <button class="flex items-center gap-2 text-ink-muted text-xs mb-5
                         hover:text-ink-primary transition-colors"
                  @click="otpSent = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </button>

          <p class="text-xs font-medium text-ink-muted uppercase tracking-widest mb-1">
            Verification
          </p>
          <p class="text-ink-secondary text-sm mb-5">
            Code sent to
            <span class="text-ink-primary font-medium">+91 {{ phone }}</span>
          </p>

          <input
            v-model="otp"
            type="tel"
            maxlength="6"
            placeholder="000000"
            class="input-field otp-input text-center text-2xl mb-4
                   tracking-[0.5em] font-mono"
            @keyup.enter="verifyOTP"
          />

          <button
            class="btn-primary w-full"
            :disabled="otp.length !== 6 || loading"
            @click="verifyOTP"
          >
            <span v-if="!loading">Verify & Continue</span>
            <span v-else class="flex items-center justify-center gap-2">
              <svg class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor"
                        stroke-width="3" stroke-dasharray="32" stroke-dashoffset="12"/>
              </svg>
              Verifying...
            </span>
          </button>
        </div>

        <!-- Error -->
        <div v-if="authStore.error"
             class="mt-4 flex items-start gap-2 bg-red-500/10 border
                    border-red-500/20 rounded-xl px-4 py-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="#f87171" stroke-width="2" class="mt-0.5 flex-shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
          <p class="text-red-400 text-xs">{{ authStore.error }}</p>
        </div>
      </div>

      <!-- Footer -->
      <p class="fade-up-3 text-center text-ink-muted text-xs mt-6">
        Protected by Firebase Auth · End-to-end encrypted
      </p>
    </div>

    <div id="recaptcha-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { navigateTo, useNuxtApp } from 'nuxt/app'
import { useAuthStore } from '../stores/auth'
import { useUIStore } from '../stores/ui'

definePageMeta({ layout: false })

const authStore = useAuthStore()
const uiStore   = useUIStore()
const phone     = ref('')
const otp       = ref('')
const otpSent   = ref(false)
const loading   = ref(false)
let confirmResult: any = null

let $auth: any                  = null
let $RecaptchaVerifier: any     = null
let $signInWithPhoneNumber: any = null
let $GoogleAuthProvider: any    = null
let $signInWithPopup: any       = null

onMounted(() => {
  const nuxt = useNuxtApp() as any
  $auth                  = nuxt.$auth
  $RecaptchaVerifier     = nuxt.$RecaptchaVerifier
  $signInWithPhoneNumber = nuxt.$signInWithPhoneNumber
  $GoogleAuthProvider    = nuxt.$GoogleAuthProvider
  $signInWithPopup       = nuxt.$signInWithPopup
  if (authStore.isLoggedIn) navigateTo('/')
})

async function sendOTP() {
  loading.value = true
  authStore.setError('')
  try {
    const recaptcha = new $RecaptchaVerifier(
      $auth, 'recaptcha-container', { size: 'invisible' }
    )
    confirmResult = await $signInWithPhoneNumber(
      $auth, `+91${phone.value}`, recaptcha
    )
    otpSent.value = true
    uiStore.info('OTP sent successfully')
  } catch (e: any) {
    authStore.setError(e.message)
  } finally {
    loading.value = false
  }
}

async function verifyOTP() {
  loading.value = true
  authStore.setError('')
  try {
    const result = await confirmResult.confirm(otp.value)
    authStore.setUser(result.user)
    navigateTo('/')
  } catch (e: any) {
    authStore.setError('Invalid OTP. Please try again.')
  } finally {
    loading.value = false
  }
}

async function signInGoogle() {
  loading.value = true
  authStore.setError('')
  try {
    const provider = new $GoogleAuthProvider()
    const result   = await $signInWithPopup($auth, provider)
    authStore.setUser(result.user)
    navigateTo('/')
  } catch (e: any) {
    authStore.setError(e.message)
  } finally {
    loading.value = false
  }
}
</script>