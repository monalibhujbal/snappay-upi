import { ref } from 'vue'

export interface NlpResult {
    label: 'sent' | 'received' | 'unknown'
    score: number
    isSuspicious: boolean
    reasons: string[]
}

function countMatches(text: string, pats: string[]): number {
    return pats.reduce((n, p) => n + (text.includes(p) ? 1 : 0), 0)
}

/** Returns 1.5 if the phrase appears in the top-5 lines, else 1 */
function positionWeight(text: string, phrase: string): number {
    const topLines = text.split('\n').slice(0, 5).join('\n')
    return topLines.includes(phrase) ? 1.5 : 1
}

export function useNlpValidator() {
    const isLoading = ref(false)
    const error = ref<string | null>(null)

    function classify(rawText: string, amount: number): NlpResult {
        isLoading.value = true
        error.value = null

        try {
            const lower = rawText.toLowerCase().replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ')
            const topLines = lower.split('\n').slice(0, 8).join('\n')

            // ── Sent signals ──────────────────────────────────────────────
            const sentKeywords = [
                'paid to', 'sent to', 'debit', 'debited', 'debited from',
                'payment to', 'transferred to', 'you paid', 'money sent',
                'paid successfully', 'transaction successful',
                // Hindi-transliterated terms common on Indian receipts
                'bheja', 'bhejo', 'paisa bheja',
            ]

            // ── Received signals ──────────────────────────────────────────
            const receivedKeywords = [
                'received from', 'credit', 'credited', 'credited to',
                'credited in', 'payment from', 'transferred from',
                'you received', 'money received', 'collected from',
                'mila', 'paisa mila',
            ]

            let sentScore    = countMatches(lower, sentKeywords)
            let receivedScore = countMatches(lower, receivedKeywords)

            // ── Position-weighted phrase boosts ───────────────────────────
            const sentBoosted = ['paid to', 'sent to', 'debited from', 'paid successfully', 'transaction successful']
            const recvBoosted = ['received from', 'money received', 'credited to', 'credited in']

            for (const phrase of sentBoosted)
                if (lower.includes(phrase)) sentScore += Math.round(4 * positionWeight(lower, phrase))
            for (const phrase of recvBoosted)
                if (lower.includes(phrase)) receivedScore += Math.round(4 * positionWeight(lower, phrase))

            // Paytm "To:" / "From:" header
            if (/\bto\s*:/.test(lower) && /\bfrom\s*:/.test(lower) && /completed|paid successfully|transaction successful/.test(lower))
                sentScore += 5

            // Top-line cue bonus
            if (/paid to|paid successfully|debited from|transaction successful/.test(topLines)) sentScore += 3
            if (/received from|money received|credited/.test(topLines)) receivedScore += 3

            // ── Label + score ─────────────────────────────────────────────
            let label: 'sent' | 'received' | 'unknown'
            let score: number

            if (sentScore > receivedScore) {
                label = 'sent'
                score = Math.min(0.97, 0.62 + sentScore * 0.07)
            } else if (receivedScore > sentScore) {
                label = 'received'
                score = Math.min(0.97, 0.62 + receivedScore * 0.07)
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

            // ── Suspicion reasons ─────────────────────────────────────────
            const reasons: string[] = []
            if (amount > 50_000) reasons.push('Large transaction (>Rs 50,000)')
            if (amount > 0 && (amount % 100_000 === 0 || /^(\d)\1{4,}$/.test(String(Math.round(amount)))))
                reasons.push('Unusual round or repeating amount — possible anomaly')
            if (lower.includes('pending')) reasons.push('Status shows pending')
            if (/failed|failure/.test(lower)) reasons.push('Receipt shows failure')
            if (lower.includes('declined')) reasons.push('Transaction declined')
            if (sentScore > 0 && receivedScore > 0 && Math.abs(sentScore - receivedScore) <= 2)
                reasons.push('Debit and credit cues are mixed — direction confidence is lower')
            if (score < 0.6 && label !== 'unknown') reasons.push('Low confidence classification')

            return { label, score, isSuspicious: reasons.length > 0, reasons }
        } finally {
            isLoading.value = false
        }
    }

    return { isLoading, error, classify }
}
