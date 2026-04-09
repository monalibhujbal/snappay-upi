<template>
  <NuxtLink
    :to="item.path"
    class="flex flex-col items-center gap-1 px-4 py-1
           rounded-xl transition-all duration-200 min-w-[60px]"
    :class="active
      ? 'text-brand-500'
      : 'text-slate-500 hover:text-slate-300'"
  >
    <svg v-if="item.icon === 'scan'"
      class="w-6 h-6" fill="none" stroke="currentColor"
      stroke-width="1.5" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M3 9V6a3 3 0 013-3h3M3 15v3a3 3 0 003 3h3
           m6-18h3a3 3 0 013 3v3m0 6v3a3 3 0 01-3 3h-3
           M9 12h6m-3-3v6"/>
    </svg>

    <svg v-else-if="item.icon === 'ledger'"
      class="w-6 h-6" fill="none" stroke="currentColor"
      stroke-width="1.5" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5
           a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414
           5.414A1 1 0 0120 9.414V19a2 2 0 01-2 2z"/>
    </svg>

    <svg v-else-if="item.icon === 'profile'"
      class="w-6 h-6" fill="none" stroke="currentColor"
      stroke-width="1.5" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75
           3.75 0 017.5 0zM4.501 20.118a7.5 7.5
           0 0114.998 0A17.933 17.933 0 0112 21.75
           c-2.676 0-5.216-.584-7.499-1.632z"/>
    </svg>

    <span class="text-[10px] font-medium">
      {{ item.label }}
    </span>
  </NuxtLink>
</template>

<script setup lang="ts">
defineProps<{
  item:   { path: string; label: string; icon: string }
  active: boolean
}>()
</script>
