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

            for (const [kind, keywords] of Object.entries(DOCUMENT_KEYWORDS) as Array<[DocumentKind, string[]]>) {
                let score = 0

                for (const keyword of keywords) {
                    if (text.includes(keyword)) {
                        score += keyword.includes(' ') ? 3 : 2
                    }
                }

                scores.set(kind, score)
            }

            if (/@[a-z]{2,}/i.test(rawText)) {
                scores.set('upi_receipt_success', (scores.get('upi_receipt_success') ?? 0) + 2)
            }

            if (/\b(?:utr|rrn|transaction id|upi ref)\b/i.test(rawText)) {
                scores.set('upi_receipt_success', (scores.get('upi_receipt_success') ?? 0) + 2)
                scores.set('upi_receipt_failed', (scores.get('upi_receipt_failed') ?? 0) + 1)
                scores.set('upi_receipt_pending', (scores.get('upi_receipt_pending') ?? 0) + 1)
            }

            if (/\b(?:opening balance|closing balance|statement period)\b/i.test(rawText)) {
                scores.set('bank_statement', (scores.get('bank_statement') ?? 0) + 4)
            }

            if (/\b(?:invoice|voucher|gst|subtotal)\b/i.test(rawText)) {
                scores.set('voucher', (scores.get('voucher') ?? 0) + 4)
            }

            const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1])
            const [bestKind, bestScore] = sorted[0] ?? ['unknown', 0]
            const [secondKind, secondScore] = sorted[1] ?? ['unknown', 0]

            if (bestScore <= 0) {
                reasons.push('No strong receipt or statement cues found in the OCR text.')
                return { kind: 'unknown', score: 0, reasons }
            }

            if (bestKind === 'upi_receipt_success' && /failed|declined|unsuccessful/i.test(rawText)) {
                reasons.push('Failure words were stronger than the success cues.')
                return { kind: 'upi_receipt_failed', score: 0.85, reasons }
            }

            if (bestKind === 'upi_receipt_success' && /pending|processing|awaiting/i.test(rawText)) {
                reasons.push('Pending words were stronger than the success cues.')
                return { kind: 'upi_receipt_pending', score: 0.82, reasons }
            }

            if (bestScore - secondScore <= 1 && bestScore < 4) {
                reasons.push(`This looks close to both ${bestKind} and ${secondKind}.`)
                return { kind: 'unknown', score: 0.35, reasons }
            }

            reasons.push(`Matched ${bestScore} classification cues for ${bestKind}.`)

            return {
                kind: bestKind,
                score: Math.min(0.98, 0.45 + bestScore * 0.08),
                reasons,
            }
        } finally {
            isLoading.value = false
        }
    }

    return { isLoading, error, classify }
}
