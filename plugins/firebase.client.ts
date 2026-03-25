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

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const firebaseConfig = {
    apiKey:            config.public.firebaseApiKey,
    authDomain:        config.public.firebaseAuthDomain,
    projectId:         config.public.firebaseProjectId,
    storageBucket:     config.public.firebaseStorageBucket,
    messagingSenderId: config.public.firebaseMessagingSenderId,
    appId:             config.public.firebaseAppId,
  }

  // Prevent duplicate initialization on hot reload
  const app = getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0]

  const db   = getFirestore(app)
  const auth = getAuth(app)

  return {
    provide: {
      firebase: app,
      db,
      auth,
      GoogleAuthProvider,
      signInWithPopup,
      signInWithPhoneNumber,
      RecaptchaVerifier,
      onAuthStateChanged,
    },
  }
})