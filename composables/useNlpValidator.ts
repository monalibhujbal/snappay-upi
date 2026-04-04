// composables/useNlpValidator.ts
import { ref } from 'vue'

let pipelineInstance: any = null

async function getPipeline() {
    if (pipelineInstance) return pipelineInstance
    const { pipeline } = await import('@xenova/transformers')
    pipelineInstance = await pipeline(
        'zero-shot-classification',
        'Xenova/distilbart-mnli-12-1'
    )
    return pipelineInstance
}

export interface NlpResult {
    label: 'sent' | 'received' | 'unknown'
    score: number
    isSuspicious: boolean
    reasons: string[]
}

export function useNlpValidator() {
    const isLoading = ref(false)
    const error = ref<string | null>(null)

    async function classify(text: string, amount: number): Promise<NlpResult> {
        isLoading.value = true
        error.value = null

        try {
            const classifier = await getPipeline()

            const result = await classifier(text, [
                'money sent to someone',
                'money received from someone',
                'transaction failed',
                'refund or reversal'
            ])

            const topLabel = result.labels[0] as string
            const topScore = result.scores[0] as number

            const label = topLabel.includes('sent')
                ? 'sent'
                : topLabel.includes('received')
                    ? 'received'
                    : 'unknown'

            const reasons: string[] = []
            if (amount > 50000) reasons.push('Large transaction (>₹50,000)')
            if (text.toLowerCase().includes('pending')) reasons.push('Status shows pending')
            if (text.toLowerCase().includes('failed')) reasons.push('Receipt shows failure')
            if (topScore < 0.6) reasons.push('Low confidence classification')

            return {
                label: label as 'sent' | 'received' | 'unknown',
                score: topScore,
                isSuspicious: reasons.length > 0,
                reasons
            }
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'NLP failed'
            return { label: 'unknown', score: 0, isSuspicious: false, reasons: [] }
        } finally {
            isLoading.value = false
        }
    }

    return { isLoading, error, classify }
}