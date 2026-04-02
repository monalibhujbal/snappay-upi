<template>
  <div class="px-4 pt-12 text-white">
    <h1 class="text-xl font-semibold mb-4">Ledger</h1>
    <p class="text-slate-400">Your transactions will appear here.</p>
  </div>
</template>

<script setup lang="ts">
  definePageMeta({ middleware: ['auth'] })
</script>
