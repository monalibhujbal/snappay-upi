<template>
  <div class="min-h-screen flex flex-col bg-surface-base">

    <!-- Main content area -->
    <main class="flex-1 overflow-y-auto pb-20">
      <slot />
    </main>

    <!-- Bottom navigation bar -->
    <nav class="fixed bottom-0 inset-x-0 bg-surface-card
                border-t border-slate-700/50
                flex items-center justify-around
                px-2 py-2 safe-area-bottom">

      <NavItem
        v-for="item in navItems"
        :key="item.path"
        :item="item"
        :active="route.path === item.path"
      />
    </nav>

    <!-- Global toast notifications -->
    <ToastContainer />

  </div>
</template>

<script setup lang="ts">
const route = useRoute()

const navItems = [
  { path: '/',        label: 'Scan',    icon: 'scan'    },
  { path: '/ledger',  label: 'Ledger',  icon: 'ledger'  },
  { path: '/profile', label: 'Profile', icon: 'profile' },
]
</script>