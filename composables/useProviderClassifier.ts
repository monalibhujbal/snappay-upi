import { ref } from 'vue'
import type { ProviderKind } from '~/types/transaction'

export interface ProviderClassificationResult {
    kind: ProviderKind
    score: number
    reasons: string[]
}

const PROVIDER_KEYWORDS: Record<ProviderKind, string[]> = {
    gpay: [
        'google pay',
        'g pay',
        'google transaction id',
        'powered by upi',
    ],
    phonepe: [
        'phonepe',
        'contact phonepe support',
        'share receipt',
        'split expense',
        'view history',
    ],
    paytm: [
        'paytm',
        'money received',
        'upi ref no',
        'paytm cashback',
    ],
    generic_upi: [
        'upi',
        'transaction id',
        'utr',
        'rrn',
    ],
    unknown_provider: [],
}

export function useProviderClassifier() {
    const isLoading = ref(false)
    const error = ref<string | null>(null)

    function classify(rawText: string): ProviderClassificationResult {
        isLoading.value = true
        error.value = null

        try {
            const text = rawText.toLowerCase()
            const scores = new Map<ProviderKind, number>()
            const reasons: string[] = []

            for (const [kind, keywords] of Object.entries(PROVIDER_KEYWORDS) as Array<[ProviderKind, string[]]>) {
                let score = 0

                for (const keyword of keywords) {
                    if (text.includes(keyword)) {
                        score += keyword.includes(' ') ? 3 : 2
                    }
                }

                scores.set(kind, score)
            }

            if (/google transaction id|g pay|google pay/i.test(rawText)) {
                scores.set('gpay', (scores.get('gpay') ?? 0) + 4)
            }

            if (/contact phonepe support|phonepe/i.test(rawText)) {
                scores.set('phonepe', (scores.get('phonepe') ?? 0) + 4)
            }

            if (/paytm|upi ref no|money received/i.test(rawText)) {
                scores.set('paytm', (scores.get('paytm') ?? 0) + 4)
            }

            const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1])
            const [bestKind, bestScore] = sorted[0] ?? ['unknown_provider', 0]
            const secondScore = sorted[1]?.[1] ?? 0

            if (bestScore <= 0) {
                if (/\b(?:upi|transaction id|utr|rrn)\b/i.test(rawText)) {
                    reasons.push('The text looks like a UPI receipt, but no provider-specific cues were strong enough.')
                    return { kind: 'generic_upi', score: 0.45, reasons }
                }

                reasons.push('No provider-specific wording was found in the OCR text.')
                return { kind: 'unknown_provider', score: 0, reasons }
            }

            if (bestScore - secondScore <= 1 && bestScore < 4) {
                reasons.push('Provider cues were too close to call confidently.')
                return { kind: 'generic_upi', score: 0.4, reasons }
            }

            reasons.push(`Matched ${bestScore} provider cues for ${bestKind}.`)
            return {
                kind: bestKind,
                score: Math.min(0.98, 0.5 + bestScore * 0.08),
                reasons,
            }
        } finally {
            isLoading.value = false
        }
    }

    return { isLoading, error, classify }
}
