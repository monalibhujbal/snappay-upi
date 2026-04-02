<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
useHead({
  titleTemplate: '%s — UPI SnapPay',
  meta: [
    { name: 'viewport',
      content: 'width=device-width,initial-scale=1,viewport-fit=cover' },
    { name: 'theme-color', content: '#0F172A' },
  ],
  link: [
    { rel: 'apple-touch-icon', href: '/icons/icon-192.png' },
  ],
})
</script>