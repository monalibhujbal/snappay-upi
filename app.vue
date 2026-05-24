<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useTheme } from '~/composables/useTheme'

const { initTheme } = useTheme()

onMounted(() => {
  initTheme()
})

useHead({
  titleTemplate: '%s — UPI SnapPay',
  meta: [
    { name: 'viewport',
      content: 'width=device-width,initial-scale=1,viewport-fit=cover' },
    { name: 'theme-color', content: '#0ea5e9' },
  ],
  link: [
    { rel: 'apple-touch-icon', href: '/icons/icon-192.png' },
  ],
})
</script>