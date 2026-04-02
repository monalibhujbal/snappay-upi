import { useAuthStore } from '../stores/auth'

export default defineNuxtRouteMiddleware((to, from) => {
  const authStore = useAuthStore()

  // Wait for loading to finish if necessary, but middleware is synchronous.
  // We'll just check if they are logged in.
  // Note: On SSR, Firebase might not be initialized yet, so isLoggedIn could be false.
  // A common approach is to skip this on server, or handle it via a cookie.
  if (import.meta.server) return

  if (!authStore.isLoggedIn && to.path !== '/auth') {
    return navigateTo('/auth')
  }
})
