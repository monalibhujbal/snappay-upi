import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  onAuthStateChanged,
} from 'firebase/auth'

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig()

  const firebaseConfig = {
    apiKey: config.public.firebaseApiKey,
    authDomain: config.public.firebaseAuthDomain,
    projectId: config.public.firebaseProjectId,
    storageBucket: config.public.firebaseStorageBucket,
    messagingSenderId: config.public.firebaseMessagingSenderId,
    appId: config.public.firebaseAppId,
  }

  const app = getApps().length > 0
    ? getApps()[0]!
    : initializeApp(firebaseConfig)

  const db = getFirestore(app)
  const auth = getAuth(app)

  // ✅ Bootstrap auth state ONCE on app load
  // This resolves before any page renders, preventing the
  // "loading flicker" and auth guard race conditions
  const authStore = useAuthStore()

  await new Promise<void>((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      authStore.setUser(user)
      unsub()       // unsubscribe after first emission
      resolve()     // unblock page render
    })
  })

  return {
    provide: {
      firebase: app,
      db,
      auth,
      GoogleAuthProvider,
      signInWithPopup: (auth: any, provider: any) => signInWithPopup(auth, provider),
      signInWithPhoneNumber: (auth: any, phone: any, recaptcha: any) => signInWithPhoneNumber(auth, phone, recaptcha),
      RecaptchaVerifier,
      // ✅ wrapped as a real callable — fixes "$onAuthStateChanged is not a function"
      onAuthStateChanged: (auth: any, cb: any) => onAuthStateChanged(auth, cb),
    },
  }
})