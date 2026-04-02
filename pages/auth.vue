<template>
  <div class="min-h-screen flex flex-col items-center
              justify-center px-6 bg-surface-base">

    <div class="mb-10 text-center">
      <div class="w-16 h-16 bg-brand-500/10 rounded-2xl
                  flex items-center justify-center mx-auto mb-4">
        <span class="text-3xl">⚡</span>
      </div>
      <h1 class="text-2xl font-semibold text-white">SnapPay</h1>
      <p class="text-slate-400 text-sm mt-1">
        Verify your UPI receipts instantly
      </p>
    </div>

    <div class="w-full max-w-sm">
      <div v-if="!otpSent">
        <label class="text-xs text-slate-400 mb-2 block">
          Mobile number
        </label>
        <div class="flex gap-2">
          <div class="input-field w-16 text-center flex-shrink-0">+91</div>
          <input
            v-model="phone"
            type="tel"
            maxlength="10"
            placeholder="98765 43210"
            class="input-field flex-1"
            @keyup.enter="sendOTP"
          />
        </div>
        <button
          class="btn-primary w-full mt-4"
          :disabled="phone.length !== 10 || loading"
          @click="sendOTP"
        >
          {{ loading ? 'Sending...' : 'Send OTP' }}
        </button>

        <div class="relative my-6">
          <div class="border-t border-slate-700"></div>
          <span class="absolute -top-2.5 left-1/2 -translate-x-1/2
                       bg-surface-base px-3 text-xs text-slate-500">
            or
          </span>
        </div>

        <button class="btn-ghost w-full" @click="signInGoogle">
          Continue with Google
        </button>
      </div>

      <div v-else>
        <p class="text-slate-300 text-sm mb-4">
          Enter the OTP sent to +91 {{ phone }}
        </p>
        <input
          v-model="otp"
          type="number"
          maxlength="6"
          placeholder="• • • • • •"
          class="input-field text-center text-xl tracking-widest"
        />
        <button
          class="btn-primary w-full mt-4"
          :disabled="otp.length !== 6 || loading"
          @click="verifyOTP"
        >
          {{ loading ? 'Verifying...' : 'Verify OTP' }}
        </button>
        <button class="btn-ghost w-full mt-3" @click="otpSent = false">
          Back
        </button>
      </div>

      <p v-if="authStore.error"
         class="text-red-400 text-xs text-center mt-4">
        {{ authStore.error }}
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

// Firebase refs — only populated client-side in onMounted
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

  // ✅ If already logged in (e.g. page refresh), skip auth page
  if (authStore.isLoggedIn) {
    navigateTo('/')
  }
})

async function sendOTP() {
  loading.value = true
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