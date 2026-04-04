// composables/useCamera.ts
import { ref, onUnmounted } from 'vue'

export function useCamera() {
    const stream = ref<MediaStream | null>(null)
    const videoEl = ref<HTMLVideoElement | null>(null)
    const isActive = ref(false)
    const error = ref<string | null>(null)
    const capturedImage = ref<string | null>(null)

    async function startCamera(el: HTMLVideoElement) {
        videoEl.value = el
        try {
            stream.value = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            })
            el.srcObject = stream.value
            await el.play()
            isActive.value = true
            error.value = null
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Camera access denied'
            isActive.value = false
        }
    }

    function captureFrame(): string | null {
        if (!videoEl.value || !isActive.value) return null

        const canvas = document.createElement('canvas')
        canvas.width = videoEl.value.videoWidth
        canvas.height = videoEl.value.videoHeight

        const ctx = canvas.getContext('2d')!
        ctx.drawImage(videoEl.value, 0, 0)

        // Grayscale + contrast boost for better OCR accuracy
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i] ?? 0
            const g = data[i + 1] ?? 0
            const b = data[i + 2] ?? 0
            const gray = r * 0.299 + g * 0.587 + b * 0.114
            const boosted = gray < 128
                ? Math.max(0, gray - 30)
                : Math.min(255, gray + 30)
            data[i] = data[i + 1] = data[i + 2] = boosted
        }
        ctx.putImageData(imageData, 0, 0)

        capturedImage.value = canvas.toDataURL('image/png')
        return capturedImage.value
    }

    function stopCamera() {
        stream.value?.getTracks().forEach(t => t.stop())
        stream.value = null
        isActive.value = false
    }

    function reset() {
        capturedImage.value = null
        error.value = null
    }

    onUnmounted(stopCamera)

    return {
        stream,
        isActive,
        error,
        capturedImage,
        startCamera,
        captureFrame,
        stopCamera,
        reset
    }
}