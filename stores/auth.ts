import { defineStore } from 'pinia'
import type { User } from 'firebase/auth'
import { signOut as firebaseSignOut } from 'firebase/auth'
import { navigateTo, useNuxtApp } from 'nuxt/app'

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    loading: true,
    error: null,
  }),

  getters: {
    isLoggedIn: (state) => state.user !== null,
    userId: (state) => state.user?.uid ?? null,
    userPhone: (state) => state.user?.phoneNumber ?? null,
    userEmail: (state) => state.user?.email ?? null,
    displayName: (state) => state.user?.displayName ?? 'User',
  },

  actions: {
    setUser(user: User | null) {
      this.user = user
      this.loading = false
      this.error = null
    },

    setError(msg: string) {
      this.error = msg
      this.loading = false
    },

    setLoading(val: boolean) {
      this.loading = val
    },

    async signOut() {
      const { $auth } = useNuxtApp() as any
      // ✅ use imported signOut function, not $auth.signOut()
      await firebaseSignOut($auth)
      this.user = null
      navigateTo('/auth')
    },
  },
})