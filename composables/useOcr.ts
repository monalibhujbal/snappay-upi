// composables/useOcr.ts
import { ref } from 'vue'
import type { OcrResult } from '~/types/transaction'

let workerInstance: any = null
let initPromise: Promise<any> | null = null

const ocrProgress = ref(0)

async function getWorker(): Promise<any> {
    if (workerInstance) return workerInstance
    if (initPromise) return initPromise

    initPromise = (async () => {
        // v7 requires dynamic import to work with Vite
        const { createWorker } = await import('tesseract.js')

        const w = await createWorker('eng', 1, {
            logger: (m: any) => {
                if (m.status === 'recognizing text') {
                    ocrProgress.value = Math.floor(m.progress * 100)
                }
            }
        })

        await w.setParameters({
            tessedit_pageseg_mode: '6' as any,
            preserve_interword_spaces: '1' as any,
        })

        workerInstance = w
        return w
    })()

    return initPromise
}

export function useOcr() {
    const isProcessing = ref(false)
    const error = ref<string | null>(null)

    async function recognize(imageData: string): Promise<OcrResult | null> {
        isProcessing.value = true
        ocrProgress.value = 0
        error.value = null

        try {
            const worker = await getWorker()
            console.log('Tesseract worker ready, recognizing...')
            const { data } = await worker.recognize(imageData)
            console.log('Tesseract raw result:', data)
            return {
                text: data.text,
                confidence: data.confidence
            }
        } catch (e) {
            console.error('Tesseract error:', e)
            error.value = e instanceof Error ? e.message : 'OCR failed'
            return null
        } finally {
            isProcessing.value = false
        }
    }

    async function terminate() {
        if (workerInstance) {
            await workerInstance.terminate()
            workerInstance = null
            initPromise = null
        }
    }

    return { isProcessing, ocrProgress, error, recognize, terminate }
}