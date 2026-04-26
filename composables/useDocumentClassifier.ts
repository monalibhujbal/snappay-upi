import { ref } from 'vue'
import type { DocumentKind } from '~/types/transaction'

export interface DocumentClassificationResult {
    kind: DocumentKind
    score: number
    reasons: string[]
}

const DOCUMENT_KEYWORDS: Record<DocumentKind, string[]> = {
    upi_receipt_success: [
        'paid to',
        'you paid',
        'payment successful',
        'transaction successful',
        'payment done',
        'sent to',
        'received from',
        'credited',
        'debited',
        'upi transaction',
        'completed',
        'google pay',
        'g pay',
        'phonepe',
        'paytm',
    ],
    upi_receipt_failed: [
        'payment failed',
        'transaction failed',
        'failed',
        'declined',
        'unsuccessful',
        'could not be processed',
    ],
    upi_receipt_pending: [
        'pending',
        'processing',
        'in progress',
        'awaiting confirmation',
        'payment pending',
    ],
    bank_statement: [
        'account statement',
        'statement period',
        'opening balance',
        'closing balance',
        'available balance',
        'withdrawal',
        'deposit',
        'debit',
        'credit',
        'account number',
        'branch',
    ],
    voucher: [
        'invoice',
        'voucher',
        'bill no',
        'tax invoice',
        'subtotal',
        'gst',
        'qty',
        'item',
        'total due',
    ],
    unknown: [],
}

/** Levenshtein distance (simple iterative, no extra deps) */
function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    )
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i]![j] = a[i - 1] === b[j - 1]
                ? dp[i - 1]![j - 1]!
                : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!)
    return dp[m]![n]!
}

/**
 * Fuzzy provider detection — catches OCR-mangled names like
 * "Ph0nePe", "G Pay", "Phon3Pe", "P4ytm" etc.
 */
function fuzzyProviderBoost(text: string): Map<DocumentKind, number> {
    const boosts = new Map<DocumentKind, number>()
    const words = text.toLowerCase().split(/\s+/)
    const TARGETS: Array<[string, DocumentKind, number]> = [
        ['phonepe', 'upi_receipt_success', 5],
        ['googlepay', 'upi_receipt_success', 4],
        ['paytm', 'upi_receipt_success', 4],
    ]
    for (const word of words) {
        if (word.length < 4) continue
        for (const [target, kind, bonus] of TARGETS) {
            if (levenshtein(word, target) <= 2) {
                boosts.set(kind, (boosts.get(kind) ?? 0) + bonus)
            }
        }
    }
    return boosts
}

/** Check for structural KV-pair lines as a strong UPI-receipt signal */
function hasKvStructure(text: string): boolean {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const KV_RE = /^([A-Za-z][A-Za-z\s]{2,30}):\s*(.+)$/
    return lines.filter(l => KV_RE.test(l)).length >= 3
}

export function useDocumentClassifier() {
    const isLoading = ref(false)
    const error = ref<string | null>(null)

    function classify(rawText: string): DocumentClassificationResult {
        isLoading.value = true
        error.value = null

        try {
            const text = rawText.toLowerCase()
            const scores = new Map<DocumentKind, number>()
            const reasons: string[] = []

            // ── Keyword scoring ────────────────────────────────────────────
            for (const [kind, keywords] of Object.entries(DOCUMENT_KEYWORDS) as Array<[DocumentKind, string[]]>) {
                let score = 0
                for (const keyword of keywords)
                    if (text.includes(keyword)) score += keyword.includes(' ') ? 3 : 2
                scores.set(kind, score)
            }

            // ── Structural signals ──────────────────────────────────────────
            if (/@[a-z]{2,}/i.test(rawText))
                scores.set('upi_receipt_success', (scores.get('upi_receipt_success') ?? 0) + 3)

            if (/\b(?:utr|rrn|transaction id|upi ref)\b/i.test(rawText)) {
                scores.set('upi_receipt_success', (scores.get('upi_receipt_success') ?? 0) + 3)
                scores.set('upi_receipt_failed',  (scores.get('upi_receipt_failed')  ?? 0) + 1)
                scores.set('upi_receipt_pending', (scores.get('upi_receipt_pending') ?? 0) + 1)
            }

            if (/\b(?:opening balance|closing balance|statement period)\b/i.test(rawText))
                scores.set('bank_statement', (scores.get('bank_statement') ?? 0) + 5)

            if (/\b(?:invoice|voucher|gst|subtotal)\b/i.test(rawText))
                scores.set('voucher', (scores.get('voucher') ?? 0) + 5)

            // Structural KV bonus
            if (hasKvStructure(rawText))
                scores.set('upi_receipt_success', (scores.get('upi_receipt_success') ?? 0) + 3)

            // ── Fuzzy provider detection (OCR noise compensation)
            for (const [kind, bonus] of fuzzyProviderBoost(rawText))
                scores.set(kind, (scores.get(kind) ?? 0) + bonus)

            // ── Determine winner ────────────────────────────────────────────
            const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1])
            const [bestKind, bestScore] = sorted[0] ?? ['unknown', 0]
            const [secondKind, secondScore] = sorted[1] ?? ['unknown', 0]

            if (bestScore <= 0) {
                reasons.push('No strong receipt or statement cues found in the OCR text.')
                return { kind: 'unknown', score: 0, reasons }
            }

            // Override success → failed / pending when explicit failure/pending words dominate
            if (bestKind === 'upi_receipt_success' && /failed|declined|unsuccessful/i.test(rawText)) {
                reasons.push('Failure indicators override success cues.')
                return { kind: 'upi_receipt_failed', score: 0.88, reasons }
            }

            if (bestKind === 'upi_receipt_success' && /pending|processing|awaiting/i.test(rawText)) {
                reasons.push('Pending indicators override success cues.')
                return { kind: 'upi_receipt_pending', score: 0.84, reasons }
            }

            if (bestScore - secondScore <= 1 && bestScore < 5) {
                reasons.push(`Close match between ${bestKind} and ${secondKind} — defaulting to unknown.`)
                return { kind: 'unknown', score: 0.35, reasons }
            }

            reasons.push(`Matched ${bestScore} classification cues for ${bestKind}.`)
            return {
                kind: bestKind,
                score: Math.min(0.98, 0.45 + bestScore * 0.07),
                reasons,
            }
        } finally {
            isLoading.value = false
        }
    }

    return { isLoading, error, classify }
}
