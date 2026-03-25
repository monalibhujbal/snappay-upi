import { defineStore } from 'pinia'
import type { User } from 'firebase/auth'

interface AuthState {
  user:    User | null
  loading: boolean
  error:   string | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user:    null,
    loading: true,   // true on init — waiting for Firebase
    error:   null,
  }),

  getters: {
    isLoggedIn:    (state) => state.user !== null,
    userId:        (state) => state.user?.uid ?? null,
    userPhone:     (state) => state.user?.phoneNumber ?? null,
    userEmail:     (state) => state.user?.email ?? null,
    displayName:   (state) => state.user?.displayName ?? 'User',
  },

  actions: {
    setUser(user: User | null) {
      this.user    = user
      this.loading = false
      this.error   = null
    },

    setError(msg: string) {
      this.error   = msg
      this.loading = false
    },

    setLoading(val: boolean) {
      this.loading = val
    },

    async signOut() {
      const { $auth } = useNuxtApp()
      await $auth.signOut()
      this.user = null
      navigateTo('/auth')
    },
  },
})