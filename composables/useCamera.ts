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
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            })
            el.srcObject = stream.value
            await el.play()
            isActive.value = true
            error.value = null
        } catch (e) {
            try {
                stream.value = await navigator.mediaDevices.getUserMedia({ video: true })
                el.srcObject = stream.value
                await el.play()
                isActive.value = true
                error.value = null
            } catch (fallbackError) {
                error.value = fallbackError instanceof Error ? fallbackError.message : 'Camera access denied'
                isActive.value = false
            }
        }
    }

    function captureFrame(): string | null {
        if (!videoEl.value || !isActive.value) return null

        const canvas = document.createElement('canvas')
        canvas.width = videoEl.value.videoWidth
        canvas.height = videoEl.value.videoHeight

        const ctx = canvas.getContext('2d')!
        ctx.drawImage(videoEl.value, 0, 0)

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
