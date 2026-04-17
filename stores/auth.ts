import { defineStore } from 'pinia'
import type { User } from 'firebase/auth'
import { signOut as firebaseSignOut } from 'firebase/auth'
import { navigateTo, useNuxtApp } from 'nuxt/app'

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

function mapAuthError(error: any) {
  const code = error?.code ?? ''

  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is disabled in Firebase Console. Enable the Email/Password provider in Authentication > Sign-in method.'
    case 'auth/email-already-in-use':
      return 'This email is already registered. Try signing in instead.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/invalid-login-credentials':
      return 'Invalid email or password.'
    case 'auth/user-not-found':
      return 'No account was found for this email.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.'
    default:
      return error?.message || 'Authentication failed.'
  }
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
      await firebaseSignOut($auth)
      this.user = null
      navigateTo('/auth')
    },

    async signInWithEmail(email: string, pass: string) {
      const { $auth, $signInWithEmailAndPassword } = useNuxtApp() as any
      this.loading = true
      this.error = null
      try {
        const normalizedEmail = email.trim().toLowerCase()
        const result = await $signInWithEmailAndPassword($auth, normalizedEmail, pass)
        this.user = result.user
        navigateTo('/')
      } catch (e: any) {
        this.error = mapAuthError(e)
        this.loading = false
        throw e
      }
    },

    async signUpWithEmail(email: string, pass: string, name: string) {
      const { $auth, $createUserWithEmailAndPassword, $updateProfile, $db } = useNuxtApp() as any
      this.loading = true
      this.error = null
      try {
        const normalizedEmail = email.trim().toLowerCase()
        const cleanName = name.trim()
        const result = await $createUserWithEmailAndPassword($auth, normalizedEmail, pass)

        await $updateProfile(result.user, { displayName: cleanName })

        // Also save to Firestore users collection
        const { doc, setDoc } = await import('firebase/firestore')
        await setDoc(doc($db, 'users', result.user.uid), {
          displayName: cleanName,
          email: normalizedEmail,
          createdAt: new Date().toISOString()
        })

        this.user = result.user
        navigateTo('/')
      } catch (e: any) {
        this.error = mapAuthError(e)
        this.loading = false
        throw e
      }
    },

    async updateUserProfile(data: { displayName?: string, bio?: string, address?: string, legalName?: string }) {
      if (!this.user) return
      const { $auth, $updateProfile, $db } = useNuxtApp() as any
      this.loading = true
      try {
        if (data.displayName) {
          await $updateProfile(this.user, { displayName: data.displayName })
          this.user = { ...this.user, displayName: data.displayName } as User
        }

        // Save extra data to Firestore
        const { doc, setDoc } = await import('firebase/firestore')
        await setDoc(doc($db, 'users', this.user.uid), {
          ...(data.displayName ? { displayName: data.displayName } : {}),
          ...(data.bio !== undefined ? { bio: data.bio } : {}),
          ...(data.address !== undefined ? { address: data.address } : {}),
          ...(data.legalName !== undefined ? { legalName: data.legalName } : {})
        }, { merge: true })

      } catch (e: any) {
        this.error = mapAuthError(e)
        throw e
      } finally {
        this.loading = false
      }
    },

    async signInWithGoogle() {
      const { $auth, $signInWithPopup, $GoogleAuthProvider, $db } = useNuxtApp() as any
      this.loading = true
      this.error = null

      try {
        const provider = new $GoogleAuthProvider()
        const result = await $signInWithPopup($auth, provider)

        // Save user info in Firestore
        const { doc, setDoc } = await import('firebase/firestore')
        await setDoc(
          doc($db, 'users', result.user.uid),
          {
            displayName: result.user.displayName,
            email: result.user.email,
            photoURL: result.user.photoURL,
          },
          { merge: true }
        )

        this.user = result.user
        navigateTo('/')
      } catch (e: any) {
        console.error(e)
        this.error = mapAuthError(e)
        this.loading = false
        throw e
      } finally {
        this.loading = false
      }
    }
  },
})
