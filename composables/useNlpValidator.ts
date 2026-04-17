import { ref } from 'vue'

export interface NlpResult {
    label: 'sent' | 'received' | 'unknown'
    score: number
    isSuspicious: boolean
    reasons: string[]
}

function normalizeText(text: string) {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/[|]/g, 'I')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{2,}/g, '\n')
        .trim()
        .toLowerCase()
}

function countMatches(text: string, patterns: string[]) {
    return patterns.reduce((total, pattern) => total + (text.includes(pattern) ? 1 : 0), 0)
}

export function useNlpValidator() {
    const isLoading = ref(false)
    const error = ref<string | null>(null)

    function classify(text: string, amount: number): NlpResult {
        isLoading.value = true
        error.value = null

        try {
            const lower = normalizeText(text)
            const topLines = lower.split('\n').slice(0, 8).join('\n')

            const sentKeywords = [
                'paid to',
                'sent to',
                'debit',
                'debited',
                'debited from',
                'payment to',
                'transferred to',
                'you paid',
                'money sent',
                'paid successfully',
                'transaction successful',
            ]

            const receivedKeywords = [
                'received from',
                'credit',
                'credited',
                'credited to',
                'credited in',
                'payment from',
                'transferred from',
                'you received',
                'money received',
                'collected from',
            ]

            let sentScore = countMatches(lower, sentKeywords)
            let receivedScore = countMatches(lower, receivedKeywords)

            if (/(^|\n)\s*paid to\b/.test(lower)) sentScore += 5
            if (/(^|\n)\s*sent to\b/.test(lower)) sentScore += 5
            if (/(^|\n)\s*debited from\b/.test(lower)) sentScore += 6
            if (/(^|\n)\s*received from\b/.test(lower)) receivedScore += 6
            if (/(^|\n)\s*money received\b/.test(lower)) receivedScore += 7
            if (/(^|\n)\s*credited (?:to|in)\b/.test(lower)) receivedScore += 6

            if (/\bto\s*:/.test(lower) && /\bfrom\s*:/.test(lower) && /(completed|paid successfully|transaction successful)/.test(lower)) {
                sentScore += 5
            }

            if (/paid to|paid successfully|debited from|transaction successful/.test(topLines)) sentScore += 3
            if (/received from|money received|credited/.test(topLines)) receivedScore += 3

            let label: 'sent' | 'received' | 'unknown'
            let score: number

            if (sentScore > receivedScore) {
                label = 'sent'
                score = Math.min(0.97, 0.62 + sentScore * 0.08)
            } else if (receivedScore > sentScore) {
                label = 'received'
                score = Math.min(0.97, 0.62 + receivedScore * 0.08)
            } else if (/paid to|sent to|paid successfully|debited from/.test(lower)) {
                label = 'sent'
                score = 0.62
            } else if (/received from|money received|credited/.test(lower)) {
                label = 'received'
                score = 0.62
            } else {
                label = 'unknown'
                score = 0
            }

            const reasons: string[] = []
            if (amount > 50000) reasons.push('Large transaction (>Rs50,000)')
            if (lower.includes('pending')) reasons.push('Status shows pending')
            if (lower.includes('failed') || lower.includes('failure')) reasons.push('Receipt shows failure')
            if (lower.includes('declined')) reasons.push('Transaction declined')
            if (sentScore > 0 && receivedScore > 0 && Math.abs(sentScore - receivedScore) <= 2) {
                reasons.push('Debit and credit cues are mixed, so direction confidence is lower')
            }
            if (score < 0.6 && label !== 'unknown') reasons.push('Low confidence classification')

            return {
                label,
                score,
                isSuspicious: reasons.length > 0,
                reasons,
            }
        } finally {
            isLoading.value = false
        }
    }

    return { isLoading, error, classify }
}
