import { ref } from 'vue'
import type { ProviderKind } from '~/types/transaction'

export interface ProviderClassificationResult {
    kind: ProviderKind
    score: number
    reasons: string[]
}

const PROVIDER_KEYWORDS: Record<ProviderKind, string[]> = {
    gpay: ['google pay', 'g pay', 'google transaction id', 'powered by upi'],
    phonepe: ['phonepe', 'contact phonepe support', 'share receipt', 'split expense', 'view history'],
    paytm: ['paytm', 'money received', 'upi ref no', 'paytm cashback'],
    generic_upi: ['upi', 'transaction id', 'utr', 'rrn'],
    unknown_provider: [],
}

/** Simple iterative Levenshtein distance */
function lev(a: string, b: string): number {
    const m = a.length, n = b.length
    const d: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
    )
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            d[i]![j] = a[i - 1] === b[j - 1]
                ? d[i - 1]![j - 1]!
                : 1 + Math.min(d[i - 1]![j]!, d[i]![j - 1]!, d[i - 1]![j - 1]!)
    return d[m]![n]!
}

/** Fuzzy provider name detection — catches OCR-mangled names like "Ph0nePe", "P4ytm" */
function fuzzyProviderScore(text: string): Map<ProviderKind, number> {
    const result = new Map<ProviderKind, number>()
    const words = text.toLowerCase().split(/\s+/)
    const targets: Array<[string, ProviderKind, number]> = [
        ['phonepe',   'phonepe',      6],
        ['googlepay', 'gpay',         5],
        ['paytm',     'paytm',        5],
        ['gpay',      'gpay',         4],
        ['bhim',      'generic_upi',  3],
    ]
    for (const word of words) {
        if (word.length < 4) continue
        for (const [target, kind, bonus] of targets) {
            if (lev(word, target) <= 2)
                result.set(kind, (result.get(kind) ?? 0) + bonus)
        }
    }
    return result
}

/** Layout-based provider hints from structural text patterns */
function layoutProviderHints(rawText: string): Map<ProviderKind, number> {
    const hints = new Map<ProviderKind, number>()
    const lower = rawText.toLowerCase()

    // Standalone "Paid to" on its own line → PhonePe / GPay style
    if (/(^|\n)\s*paid to\s*$/.test(lower))
        hints.set('phonepe', (hints.get('phonepe') ?? 0) + 3)

    // "Google Transaction ID" is definitively GPay
    if (/google transaction id/i.test(rawText))
        hints.set('gpay', (hints.get('gpay') ?? 0) + 8)

    // "UPI Ref No" is definitively Paytm
    if (/upi ref no/i.test(rawText))
        hints.set('paytm', (hints.get('paytm') ?? 0) + 8)

    // "Transaction Successful" + "Paid to" → PhonePe
    if (/transaction successful/i.test(rawText) && /paid to/i.test(rawText))
        hints.set('phonepe', (hints.get('phonepe') ?? 0) + 4)

    // "Rupees" keyword → Paytm
    if (/\brupees\b/i.test(rawText))
        hints.set('paytm', (hints.get('paytm') ?? 0) + 3)

    return hints
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

            // ── Keyword scoring ──────────────────────────────────────────
            for (const [kind, keywords] of Object.entries(PROVIDER_KEYWORDS) as Array<[ProviderKind, string[]]>) {
                let score = 0
                for (const keyword of keywords)
                    if (text.includes(keyword)) score += keyword.includes(' ') ? 3 : 2
                scores.set(kind, score)
            }

            // ── Layout hints ─────────────────────────────────────────────
            for (const [kind, bonus] of layoutProviderHints(rawText))
                scores.set(kind, (scores.get(kind) ?? 0) + bonus)

            // ── Fuzzy matching ────────────────────────────────────────────
            for (const [kind, bonus] of fuzzyProviderScore(rawText))
                scores.set(kind, (scores.get(kind) ?? 0) + bonus)

            const sorted = [...scores.entries()]
                .filter(([k]) => k !== 'unknown_provider')
                .sort((a, b) => b[1] - a[1])

            const [bestKind, bestScore] = sorted[0] ?? ['unknown_provider', 0]
            const secondScore = sorted[1]?.[1] ?? 0

            if (bestScore <= 0) {
                if (/\b(?:upi|transaction id|utr|rrn)\b/i.test(rawText)) {
                    reasons.push('Looks like a UPI receipt but no provider-specific cues were strong enough.')
                    return { kind: 'generic_upi', score: 0.45, reasons }
                }
                reasons.push('No provider-specific wording found in the OCR text.')
                return { kind: 'unknown_provider', score: 0, reasons }
            }

            if (bestScore - secondScore <= 1 && bestScore < 5) {
                reasons.push('Provider cues too close to call — treating as generic UPI.')
                return { kind: 'generic_upi', score: 0.42, reasons }
            }

            reasons.push(`Matched ${bestScore} provider cues for ${bestKind}.`)
            return {
                kind: bestKind,
                score: Math.min(0.98, 0.50 + bestScore * 0.07),
                reasons,
            }
        } finally {
            isLoading.value = false
        }
    }

    return { isLoading, error, classify }
}
