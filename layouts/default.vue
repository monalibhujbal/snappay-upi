<template>
  <div class="min-h-screen flex flex-col bg-surface-base">
    <main class="flex-1 overflow-y-auto">
      <slot />
    </main>

    <nav class="fixed bottom-0 inset-x-0 bg-surface-card/80 backdrop-blur-xl
                border-t border-slate-700/40 px-2 py-2
                flex items-center justify-around">
      <NuxtLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: route.path === item.path }"
      >
        <svg v-if="item.icon === 'scan'" width="22" height="22"
             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z"/>
          <circle cx="12" cy="13" r="3"/>
        </svg>
        <svg v-else-if="item.icon === 'ledger'" width="22" height="22"
             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
          <path d="M9 12h6M9 16h4"/>
        </svg>
        <svg v-else width="22" height="22" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>

        <span>{{ item.label }}</span>

        <div v-if="route.path === item.path"
             class="w-1 h-1 rounded-full bg-brand-500 mt-0.5"></div>
      </NuxtLink>
    </nav>

    <UiToastContainer />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const navItems = [
  { path: '/scan',    label: 'Scan',    icon: 'scan'    },
  { path: '/ledger',  label: 'Ledger',  icon: 'ledger'  },
  { path: '/profile', label: 'Profile', icon: 'profile' },
]
</script>
