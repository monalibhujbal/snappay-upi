import type { ExtractedFields } from '~/types/transaction'

const RUPEE = '\u20B9'
const TXN_ID_REGEX = /\b(\d{12,18})\b/
const UPI_ID_REGEX = /([a-zA-Z0-9._-]+@[a-zA-Z]{2,})/i
const DATE_REGEX = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i
const MERCHANT_REGEX = /(?:paid\s+to|sent\s+to|to|merchant|receiver|beneficiary)[:\s]+([A-Za-z0-9\s&.'-]{2,60}?)(?:\n|$|UPI|@|\d)/i
const CURRENCY_AMOUNT_REGEX = /(?:\u20B9|rs\.?|inr|mrp)\s*[:\-]?\s*([\d]{1,3}(?:,[\d]{2,3})*(?:\.\d{1,2})?|[\d]+(?:\.\d{1,2})?)/gi
const PLAIN_AMOUNT_REGEX = /\b([\d]{1,3}(?:,[\d]{2,3})*(?:\.\d{1,2})?|[\d]+(?:\.\d{1,2})?)\b/g

const POSITIVE_AMOUNT_CUES = [
    'paid',
    'paid to',
    'you paid',
    'sent',
    'sent to',
    'received',
    'received from',
    'debited',
    'credited',
    'payment',
    'amount',
    'transaction amount',
    'total',
    'transfer',
    'collect',
]

const NEGATIVE_AMOUNT_CUES = [
    'balance',
    'available balance',
    'closing balance',
    'opening balance',
    'ref',
    'ref no',
    'reference',
    'transaction id',
    'utr',
    'rrn',
    'date',
    'time',
    'bank',
    'account',
    'a/c',
    'mobile',
    'phone',
]

interface AmountCandidate {
    value: number
    raw: string
    index: number
    lineIndex: number
    score: number
}

function normalizeOcrText(rawText: string) {
    return rawText
        .replace(/\r\n/g, '\n')
        .replace(/[|]/g, 'I')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\u20B9|â‚¹|Ã¢â€šÂ¹/g, RUPEE)
        .replace(/\b(?:rs|rs\.|inr)\b/gi, 'Rs')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{2,}/g, '\n')
        .trim()
}

function parseAmount(value: string): number | null {
    const normalized = value
        .replace(new RegExp(RUPEE, 'g'), '')
        .replace(/\b(?:rs|inr|mrp)\b/gi, '')
        .replace(/,/g, '')
        .trim()

    if (!normalized) return null

    const amount = Number.parseFloat(normalized)
    if (!Number.isFinite(amount) || amount <= 0) return null

    return amount
}

function looksLikeDate(value: string) {
    return /^(\d{1,2}[:\/-]\d{1,2}([:\/-]\d{2,4})?|\d{4}[:\/-]\d{1,2}[:\/-]\d{1,2})$/.test(value)
}

function looksLikeTime(value: string) {
    return /^\d{1,2}:\d{2}(:\d{2})?$/.test(value)
}

function buildContext(text: string, start: number, radius = 36) {
    const left = Math.max(0, start - radius)
    const right = Math.min(text.length, start + radius)
    return text.slice(left, right).toLowerCase()
}

function scoreCandidate(rawText: string, candidate: AmountCandidate, lines: string[]) {
    let score = 0
    const textContext = buildContext(rawText, candidate.index)
    const lineContext = (lines[candidate.lineIndex] || '').toLowerCase()
    const nearbyContext = `${textContext} ${lineContext}`

    for (const cue of POSITIVE_AMOUNT_CUES) {
        if (nearbyContext.includes(cue)) score += cue.includes(' ') ? 4 : 2
    }

    for (const cue of NEGATIVE_AMOUNT_CUES) {
        if (nearbyContext.includes(cue)) score -= cue.includes(' ') ? 4 : 2
    }

    if (candidate.raw.includes(RUPEE) || /\brs\b|\binr\b/i.test(candidate.raw)) score += 8
    if (candidate.value >= 1 && candidate.value <= 200000) score += 2
    if (candidate.value < 1) score -= 10
    if (candidate.value > 500000) score -= 8
    if (Number.isInteger(candidate.value)) score += 1

    if (/success|completed|paid|received|debited|credited/i.test(lineContext)) {
        score += 4
    }

    if (/failed|pending|processing/i.test(lineContext)) {
        score -= 1
    }

    return score
}

function extractCandidates(text: string) {
    const candidates: AmountCandidate[] = []
    const seen = new Set<string>()
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean)

    const addCandidate = (raw: string, index: number) => {
        const amount = parseAmount(raw)
        if (amount === null) return
        if (looksLikeDate(raw) || looksLikeTime(raw)) return

        const lineIndex = Math.max(
            0,
            lines.findIndex(line => line.toLowerCase().includes(raw.toLowerCase().trim()))
        )

        const key = `${amount}-${lineIndex}-${Math.floor(index / 8)}`
        if (seen.has(key)) return
        seen.add(key)

        const candidate: AmountCandidate = {
            value: amount,
            raw,
            index,
            lineIndex,
            score: 0,
        }

        candidate.score = scoreCandidate(text, candidate, lines)
        candidates.push(candidate)
    }

    for (const match of text.matchAll(CURRENCY_AMOUNT_REGEX)) {
        addCandidate(match[0], match.index ?? 0)
    }

    for (const match of text.matchAll(PLAIN_AMOUNT_REGEX)) {
        const raw = match[1] ?? ''
        if (!raw) continue

        const context = buildContext(text, match.index ?? 0, 18)
        const hasMoneyCue = new RegExp(`${RUPEE}|rs|inr|amount|paid|payment|received|debited|credited|total`, 'i').test(context)
        if (!hasMoneyCue) continue

        addCandidate(raw, match.index ?? 0)
    }

    return candidates.sort((a, b) => b.score - a.score)
}

function extractAmount(text: string) {
    const candidates = extractCandidates(text)
    return candidates[0]?.value ?? 0
}

export function useFieldExtractor() {
    function extract(rawText: string): Partial<ExtractedFields> {
        const text = normalizeOcrText(rawText)

        const txnMatch = TXN_ID_REGEX.exec(text)
        const upiMatch = UPI_ID_REGEX.exec(text)
        const dateMatch = DATE_REGEX.exec(text)
        const merchantMatch = MERCHANT_REGEX.exec(text)
        const amount = extractAmount(text)

        return {
            transactionId: txnMatch?.[1] ?? '',
            upiId: upiMatch?.[1]?.toLowerCase() ?? '',
            amount,
            merchantName: merchantMatch?.[1]?.trim() ?? '',
            transactionDate: dateMatch?.[1] ?? '',
        }
    }

    function validate(fields: Partial<ExtractedFields>): {
        valid: boolean
        issues: string[]
    } {
        const issues: string[] = []

        if (!fields.transactionId) issues.push('Transaction ID not found')
        if (!fields.upiId) issues.push('UPI ID not found')
        if (!fields.amount || fields.amount <= 0) issues.push('Amount is zero or missing')
        if (!fields.transactionDate) issues.push('Date not found')

        return { valid: issues.length === 0, issues }
    }

    return { extract, validate }
}
