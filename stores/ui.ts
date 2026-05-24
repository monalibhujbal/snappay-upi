import { defineStore } from 'pinia'
import type { ToastMessage } from '../types'

export const useUIStore = defineStore('ui', {
    state: () => ({
        toasts: [] as ToastMessage[],
        privacyMode: typeof window !== 'undefined' ? localStorage.getItem('privacy_mode') === 'true' : false,
    }),

    actions: {
        togglePrivacyMode() {
            this.privacyMode = !this.privacyMode
            if (typeof window !== 'undefined') {
                localStorage.setItem('privacy_mode', this.privacyMode.toString())
            }
        },
        showToast(
            message: string,
            type: ToastMessage['type'] = 'info',
            duration = 3000
        ) {
            const id = `toast-${Date.now()}`
            this.toasts.push({ id, message, type, duration })

            setTimeout(() => {
                this.removeToast(id)
            }, duration)
        },

        removeToast(id: string) {
            this.toasts = this.toasts.filter(t => t.id !== id)
        },

        success(msg: string) { this.showToast(msg, 'success') },
        error(msg: string) { this.showToast(msg, 'error', 5000) },
        warning(msg: string) { this.showToast(msg, 'warning') },
        info(msg: string) { this.showToast(msg, 'info') },
    },
})