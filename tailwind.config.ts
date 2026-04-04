import type { Config } from 'tailwindcss'

export default {
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        brand: {
          50: '#f0fffe',
          100: '#ccfef6',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          900: '#042f2e',
        },
        surface: {
          base: '#080e1a',
          card: '#0f1829',
          input: '#162033',
          glass: 'rgba(15,24,41,0.7)',
        },
        ink: {
          primary: '#f1f5f9',
          secondary: '#94a3b8',
          muted: '#475569',
        }
      },
      boxShadow: {
        'glow-teal': '0 0 24px rgba(20,184,166,0.25)',
        'glow-sm': '0 0 12px rgba(20,184,166,0.15)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
      },
      backgroundImage: {
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2314b8a6' fill-opacity='0.03'%3E%3Cpath d='M0 0h40v40H0V0zm1 1h38v38H1V1z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
} satisfies Config