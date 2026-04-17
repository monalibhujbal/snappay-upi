export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  ssr: false,
  devtools: { enabled: false },

  css: ['~/assets/css/main.css'],

  modules: [
    '@vite-pwa/nuxt',
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@nuxtjs/google-fonts',
  ],

  googleFonts: {
    families: {
      'DM Sans': [300, 400, 500, 600],
      'DM Mono': [400, 500],
    },
    display: 'swap',
  },

  vite: {
    optimizeDeps: {
      include: ['tesseract.js'],
      exclude: ['@xenova/transformers']
    },
    worker: {
      format: 'es'
    }
  },

  nitro: {
    routeRules: {
      '/**': {
        headers: {
          'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
          'Cross-Origin-Embedder-Policy': 'unsafe-none'
        }
      }
    }
  },

  pwa: {
    manifest: {
      name: 'UPI SnapPay',
      short_name: 'SnapPay',
      description: 'Verify & log UPI transactions instantly',
      theme_color: '#0F172A',
      background_color: '#0F172A',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      icons: [
        {
          src: '/icons/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/icons/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
        },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/firestore\.googleapis\.com/,
          handler: 'NetworkFirst',
          options: { cacheName: 'firebase-cache' },
        },
      ],
    },
    devOptions: {
      enabled: false,
      type: 'module',
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  runtimeConfig: {
    public: {
      firebaseApiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY || '',
      firebaseAuthDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
      firebaseProjectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      firebaseStorageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
      firebaseMessagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      firebaseAppId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID || '',
    },
  },
})
