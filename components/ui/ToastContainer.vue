<template>
  <Teleport to="body">
    <div class="fixed top-4 inset-x-4 z-50 flex flex-col gap-2
                pointer-events-none">
      <TransitionGroup name="toast">
        <div
          v-for="toast in uiStore.toasts"
          :key="toast.id"
          class="flex items-center gap-3 px-4 py-3 rounded-xl
                 shadow-lg pointer-events-auto cursor-pointer
                 border text-sm font-medium"
          :class="toastClass(toast.type)"
          @click="uiStore.removeToast(toast.id)"
        >
          <span>{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useUIStore } from '../../stores/ui';

const uiStore = useUIStore()

function toastClass(type: string) {
  const map: Record<string, string> = {
    success: 'bg-green-900/90 border-green-700 text-green-100',
    error:   'bg-red-900/90 border-red-700 text-red-100',
    warning: 'bg-amber-900/90 border-amber-700 text-amber-100',
    info:    'bg-slate-800/90 border-slate-600 text-slate-100',
  }
  return map[type] ?? map.info
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(-12px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>