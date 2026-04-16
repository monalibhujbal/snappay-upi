import type { DocumentKind, ExtractedFields, ProviderKind } from '~/types/transaction'

const RUPEE = '\u20B9'
const TXN_ID_REGEX = /\b(\d{12,18})\b/
const UPI_ID_REGEX = /([a-zA-Z0-9._-]+@[a-zA-Z]{2,})/i
const DATE_REGEX = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i
const RECEIPT_MERCHANT_REGEX = /(?:paid\s+to|sent\s+to|to|merchant|receiver|beneficiary)[:\s]+([A-Za-z0-9\s&.'-]{2,60}?)(?:\n|$|UPI|@|\d)/i
const VOUCHER_MERCHANT_REGEX = /(?:sold\s+by|vendor|merchant|invoice\s+to|bill\s+to)[:\s]+([A-Za-z0-9\s&.'-]{2,60}?)(?:\n|$|\d)/i
const CURRENCY_AMOUNT_REGEX = /(?:\u20B9|rs\.?|inr|mrp)\s*[:\-]?\s*([\d]{1,3}(?:,[\d]{2,3})*(?:\.\d{1,2})?|[\d]+(?:\.\d{1,2})?)/gi
const PLAIN_AMOUNT_REGEX = /\b([\d]{1,3}(?:,[\d]{2,3})*(?:\.\d{1,2})?|[\d]+(?:\.\d{1,2})?)\b/g

const PROVIDER_POSITIVE_CUES: Record<ProviderKind, string[]> = {
    gpay: ['google pay', 'g pay', 'google transaction id', 'completed'],
    phonepe: ['phonepe', 'transaction successful', 'payment details', 'paid to'],
    paytm: ['paytm', 'money received', 'upi ref no', 'rupees'],
    generic_upi: ['paid', 'received', 'upi transaction', 'transaction id'],
    unknown_provider: [],
}

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

const STATEMENT_AMOUNT_CUES = [
    'debit',
    'credit',
    'withdrawal',
    'deposit',
    'upi',
    'transfer',
    'txn',
]

const VOUCHER_AMOUNT_CUES = [
    'total',
    'grand total',
    'amount due',
    'net amount',
    'subtotal',
    'invoice amount',
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
        .replace(/\u20B9|₹|â‚¹|Ã¢â€šÂ¹/g, RUPEE)
        .replace(/\bR(?=\s*\d{1,6}(?:\.\d{1,2})?\b)/g, RUPEE)
        .replace(/\bRS(?=\s*\d{1,6}(?:\.\d{1,2})?\b)/gi, 'Rs')
        .replace(/\b(?:rs|rs\.|inr)\b/gi, 'Rs')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{2,}/g, '\n')
        .trim()
}

function parseAmount(value: string): number | null {
    const normalized = value
        .replace(new RegExp(RUPEE, 'g'), '')
        .replace(/\b(?:r|rs|inr|mrp)\b/gi, '')
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

function getLines(text: string) {
    return text.split('\n').map(line => line.trim()).filter(Boolean)
}

function buildCandidate(raw: string, index: number, lines: string[]): AmountCandidate | null {
    const amount = parseAmount(raw)
    if (amount === null) return null
    if (looksLikeDate(raw) || looksLikeTime(raw)) return null

    const lineIndex = Math.max(
        0,
        lines.findIndex(line => line.toLowerCase().includes(raw.toLowerCase().trim()))
    )

    return {
        value: amount,
        raw,
        index,
        lineIndex,
        score: 0,
    }
}

function collectCurrencyCandidates(text: string, lines: string[]) {
    const candidates: AmountCandidate[] = []
    const seen = new Set<string>()

    for (const match of text.matchAll(CURRENCY_AMOUNT_REGEX)) {
        const candidate = buildCandidate(match[0], match.index ?? 0, lines)
        if (!candidate) continue

        const key = `${candidate.value}-${candidate.lineIndex}-${Math.floor(candidate.index / 8)}`
        if (seen.has(key)) continue
        seen.add(key)
        candidates.push(candidate)
    }

    return candidates
}

function providerBonus(provider: ProviderKind, lineContext: string, textContext: string) {
    let score = 0
    const combined = `${lineContext} ${textContext}`

    for (const cue of PROVIDER_POSITIVE_CUES[provider] ?? []) {
        if (combined.includes(cue)) score += cue.includes(' ') ? 3 : 2
    }

    if (provider === 'gpay' && /completed|google pay|g pay/.test(combined)) score += 2
    if (provider === 'phonepe' && /phonepe|transaction successful|paid to/.test(combined)) score += 2
    if (provider === 'paytm' && /paytm|money received|upi ref no/.test(combined)) score += 2

    return score
}

function scoreReceiptCandidate(
    rawText: string,
    candidate: AmountCandidate,
    lines: string[],
    provider: ProviderKind
) {
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

    score += providerBonus(provider, lineContext, textContext)

    if (candidate.raw.includes(RUPEE) || /\br(?=\d)|\brs\b|\binr\b/i.test(candidate.raw)) score += 8
    if (candidate.value >= 1 && candidate.value <= 200000) score += 2
    if (candidate.value > 500000) score -= 8
    if (Number.isInteger(candidate.value)) score += 1
    if (/success|completed|paid|received|debited|credited/i.test(lineContext)) score += 4
    if (/failed|pending|processing/i.test(lineContext)) score -= 1

    if (provider === 'gpay' && candidate.lineIndex <= 4) score += 5
    if (provider === 'phonepe' && candidate.lineIndex <= 5) score += 4
    if (provider === 'paytm' && candidate.lineIndex <= 6) score += 4

    return score
}

function scoreStatementCandidate(line: string, candidate: AmountCandidate) {
    let score = 0
    const lineContext = line.toLowerCase()

    for (const cue of STATEMENT_AMOUNT_CUES) {
        if (lineContext.includes(cue)) score += 3
    }

    if (/balance/.test(lineContext)) score -= 8
    if (/opening balance|closing balance|available balance/.test(lineContext)) score -= 12
    if (candidate.raw.includes(RUPEE) || /\brs\b|\binr\b/i.test(candidate.raw)) score += 5
    if (candidate.value >= 1 && candidate.value <= 200000) score += 2

    return score
}

function scoreVoucherCandidate(line: string, candidate: AmountCandidate) {
    let score = 0
    const lineContext = line.toLowerCase()

    for (const cue of VOUCHER_AMOUNT_CUES) {
        if (lineContext.includes(cue)) score += cue.includes(' ') ? 5 : 3
    }

    if (/gst|tax|cgst|sgst|discount/.test(lineContext)) score -= 2
    if (candidate.raw.includes(RUPEE) || /\brs\b|\binr\b/i.test(candidate.raw)) score += 5
    if (candidate.value >= 1 && candidate.value <= 500000) score += 2

    return score
}

function extractProviderMerchant(text: string, provider: ProviderKind) {
    const lines = getLines(text)

    if (provider === 'gpay') {
        const topMatch = lines.slice(0, 6).find(line => /^to\s+/i.test(line))
        if (topMatch) return topMatch.replace(/^to\s*:?/i, '').trim()
    }

    if (provider === 'phonepe') {
        const paidToLine = lines.find(line => /paid to/i.test(line))
        if (paidToLine) return paidToLine.replace(/paid to/i, '').trim()
    }

    if (provider === 'paytm') {
        const fromLine = lines.find(line => /^from\s*:/i.test(line))
        const toLine = lines.find(line => /^to\s*:/i.test(line))
        if (fromLine || toLine) {
            return (toLine ?? fromLine ?? '').replace(/^(from|to)\s*:/i, '').trim()
        }
    }

    return RECEIPT_MERCHANT_REGEX.exec(text)?.[1]?.trim() ?? ''
}

function extractReceiptAmount(text: string, provider: ProviderKind) {
    const lines = getLines(text)
    const candidates = collectCurrencyCandidates(text, lines)

    for (const match of text.matchAll(PLAIN_AMOUNT_REGEX)) {
        const raw = match[1] ?? ''
        if (!raw) continue

        const context = buildContext(text, match.index ?? 0, 18)
        const hasMoneyCue = new RegExp(`${RUPEE}|\\br(?=\\d)|rs|inr|amount|paid|payment|received|debited|credited|total|money`, 'i').test(context)
        if (!hasMoneyCue) continue

        const candidate = buildCandidate(raw, match.index ?? 0, lines)
        if (!candidate) continue
        candidates.push(candidate)
    }

    const ranked = candidates
        .map(candidate => ({
            ...candidate,
            score: scoreReceiptCandidate(text, candidate, lines, provider),
        }))
        .sort((a, b) => b.score - a.score)

    return ranked[0]?.value ?? 0
}

function extractStatementAmount(text: string) {
    const lines = getLines(text)
    const ranked = collectCurrencyCandidates(text, lines)
        .map(candidate => ({
            ...candidate,
            score: scoreStatementCandidate(lines[candidate.lineIndex] || '', candidate),
        }))
        .sort((a, b) => b.score - a.score)

    return ranked[0]?.value ?? 0
}

function extractVoucherAmount(text: string) {
    const lines = getLines(text)
    const ranked = collectCurrencyCandidates(text, lines)
        .map(candidate => ({
            ...candidate,
            score: scoreVoucherCandidate(lines[candidate.lineIndex] || '', candidate),
        }))
        .sort((a, b) => b.score - a.score)

    return ranked[0]?.value ?? 0
}

function extractStatementDate(text: string) {
    const lines = getLines(text)
    const transactionLine = lines.find(line => /\b(?:upi|debit|credit|withdrawal|deposit|transfer)\b/i.test(line))
    return DATE_REGEX.exec(transactionLine || text)?.[1] ?? ''
}

function extractStatementMerchant(text: string) {
    const lines = getLines(text)
    const transactionLine = lines.find(line => /\b(?:upi|debit|credit|withdrawal|deposit|transfer)\b/i.test(line)) ?? ''

    const upiMerchant = /(?:to|from|upi)\s+([A-Za-z0-9\s&.'-]{2,60})/i.exec(transactionLine)
    if (upiMerchant?.[1]) return upiMerchant[1].trim()

    return transactionLine
        .replace(DATE_REGEX, '')
        .replace(CURRENCY_AMOUNT_REGEX, '')
        .replace(/\b(?:debit|credit|withdrawal|deposit|upi|transfer|txn)\b/gi, '')
        .trim()
}

function extractVoucherDate(text: string) {
    return DATE_REGEX.exec(text)?.[1] ?? ''
}

function extractByDocumentType(
    text: string,
    kind: DocumentKind,
    provider: ProviderKind
): Partial<ExtractedFields> {
    switch (kind) {
        case 'bank_statement':
            return {
                transactionId: TXN_ID_REGEX.exec(text)?.[1] ?? '',
                upiId: UPI_ID_REGEX.exec(text)?.[1]?.toLowerCase() ?? '',
                amount: extractStatementAmount(text),
                merchantName: extractStatementMerchant(text),
                transactionDate: extractStatementDate(text),
            }

        case 'voucher':
            return {
                transactionId: TXN_ID_REGEX.exec(text)?.[1] ?? '',
                upiId: '',
                amount: extractVoucherAmount(text),
                merchantName: VOUCHER_MERCHANT_REGEX.exec(text)?.[1]?.trim() ?? '',
                transactionDate: extractVoucherDate(text),
            }

        case 'upi_receipt_failed':
        case 'upi_receipt_pending':
        case 'upi_receipt_success':
        case 'unknown':
        default:
            return {
                transactionId: TXN_ID_REGEX.exec(text)?.[1] ?? '',
                upiId: UPI_ID_REGEX.exec(text)?.[1]?.toLowerCase() ?? '',
                amount: extractReceiptAmount(text, provider),
                merchantName: extractProviderMerchant(text, provider),
                transactionDate: DATE_REGEX.exec(text)?.[1] ?? '',
            }
    }
}

export function useFieldExtractor() {
    function extract(
        rawText: string,
        kind: DocumentKind = 'unknown',
        provider: ProviderKind = 'unknown_provider'
    ): Partial<ExtractedFields> {
        const text = normalizeOcrText(rawText)
        return extractByDocumentType(text, kind, provider)
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
