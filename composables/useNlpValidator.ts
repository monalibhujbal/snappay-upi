// composables/useNlpValidator.ts
import { ref } from 'vue'

export interface NlpResult {
    label: 'sent' | 'received' | 'unknown'
    score: number
    isSuspicious: boolean
    reasons: string[]
}

export function useNlpValidator() {
    const isLoading = ref(false)
    const error = ref<string | null>(null)

    function classify(text: string, amount: number): NlpResult {
        isLoading.value = true
        error.value = null

        try {
            const lower = text.toLowerCase()

            // Direction detection — keyword matching
            const sentKeywords = [
                'paid to', 'sent to', 'debit', 'debited',
                'payment to', 'transferred to', 'you paid',
                'money sent', 'paid'
            ]
            const receivedKeywords = [
                'received from', 'credit', 'credited',
                'payment from', 'transferred from', 'you received',
                'money received', 'received'
            ]

            const sentScore = sentKeywords.filter(k => lower.includes(k)).length
            const receivedScore = receivedKeywords.filter(k => lower.includes(k)).length

            let label: 'sent' | 'received' | 'unknown'
            let score: number

            if (sentScore > receivedScore) {
                label = 'sent'
                score = Math.min(0.95, 0.6 + sentScore * 0.1)
            } else if (receivedScore > sentScore) {
                label = 'received'
                score = Math.min(0.95, 0.6 + receivedScore * 0.1)
            } else if (sentScore === receivedScore && sentScore > 0) {
                // tie — default to sent for UPI receipts
                label = 'sent'
                score = 0.55
            } else {
                label = 'unknown'
                score = 0
            }

            // Fraud / suspicious checks
            const reasons: string[] = []
            if (amount > 50000)
                reasons.push('Large transaction (>₹50,000)')
            if (lower.includes('pending'))
                reasons.push('Status shows pending')
            if (lower.includes('failed') || lower.includes('failure'))
                reasons.push('Receipt shows failure')
            if (lower.includes('declined'))
                reasons.push('Transaction declined')
            if (score < 0.6 && label !== 'unknown')
                reasons.push('Low confidence classification')

            return {
                label,
                score,
                isSuspicious: reasons.length > 0,
                reasons
            }
        } finally {
            isLoading.value = false
        }
    }

    return { isLoading, error, classify }
}