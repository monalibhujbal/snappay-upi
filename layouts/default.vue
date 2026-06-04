<template>
  <div class="min-h-screen flex flex-col bg-surface-base">
    <main class="flex-1 overflow-y-auto">
      <slot />
    </main>

    <!-- Bottom nav -->
    <nav class="fixed bottom-5 left-4 right-4 md:max-w-md md:mx-auto bg-surface-card/80 backdrop-blur-2xl
                border border-[color:var(--border-color)] px-3 py-2.5
                flex items-center justify-around z-40 rounded-2xl shadow-[var(--shadow-card)]">
      <NuxtLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: route.path === item.path }"
      >
        <!-- Scan -->
        <svg v-if="item.icon === 'scan'" width="22" height="22"
             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             class="transition-all duration-300 transform" :class="{ 'scale-110 drop-shadow-[0_0_8px_rgba(var(--glow-color),0.5)]': route.path === item.path }">
          <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z"/>
          <circle cx="12" cy="13" r="3"/>
        </svg>
        <!-- Ledger -->
        <svg v-else-if="item.icon === 'ledger'" width="22" height="22"
             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             class="transition-all duration-300 transform" :class="{ 'scale-110 drop-shadow-[0_0_8px_rgba(var(--glow-color),0.5)]': route.path === item.path }">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
          <path d="M9 12h6M9 16h4"/>
        </svg>
        <!-- Analytics -->
        <svg v-else-if="item.icon === 'analytics'" width="22" height="22"
             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             class="transition-all duration-300 transform" :class="{ 'scale-110 drop-shadow-[0_0_8px_rgba(var(--glow-color),0.5)]': route.path === item.path }">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
        <!-- Profile -->
        <svg v-else width="22" height="22" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2"
             class="transition-all duration-300 transform" :class="{ 'scale-110 drop-shadow-[0_0_8px_rgba(var(--glow-color),0.5)]': route.path === item.path }">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>

        <span class="text-[10px] mt-0.5 tracking-wide transition-all duration-300" :class="{ 'font-bold': route.path === item.path }">{{ item.label }}</span>

        <!-- Active dot -->
        <div v-if="route.path === item.path"
             class="w-1.5 h-1.5 rounded-full bg-brand-500 mt-0.5 shadow-[0_0_8px_rgba(var(--glow-color),0.8)] animate-pulse"></div>
      </NuxtLink>
    </nav>

    <UiToastContainer />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const navItems = [
  { path: '/scan',      label: 'Scan',      icon: 'scan'      },
  { path: '/ledger',    label: 'Ledger',    icon: 'ledger'    },
  { path: '/analytics', label: 'Analytics', icon: 'analytics' },
  { path: '/profile',   label: 'Profile',   icon: 'profile'   },
]
</script>