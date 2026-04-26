/**
 * useFieldExtractor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * World-class field extractor for UPI payment receipts.
 *
 * Architecture:
 *   1. Normalise OCR text via the shared useOcrNormalizer module
 *   2. Run structural key-value parser (most reliable for well-formed receipts)
 *   3. Fall through to context-aware regex extractors for each field
 *   4. Apply scoring / ranking for ambiguous candidates (especially amounts)
 *
 * 100 % browser-compatible, zero external deps beyond useOcrNormalizer.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { DocumentKind, ExtractedFields, ProviderKind } from '~/types/transaction'
import {
    RUPEE,
    normalizeOcrText,
    normalizeOcrTextForAmount,
    applyOcrCharFixes,
    extractFromKeyValuePairs,
    parseRupeeAmount,
    normalizeDateString,
} from '~/composables/useOcrNormalizer'

// ─── Compiled regexes ──────────────────────────────────────────────────────

// Transaction / reference IDs
const PHONEPE_TXN_REGEX  = /\b(T\d{23})\b/
const UTR_LABEL_REGEX    = /\bUTR\s*:?\s*(\d{12})\b/i
const UTR_NEXTLINE_REGEX = /^UTR\s*:?\s*$/i
const RRN_REGEX          = /\bRRN\s*:?\s*(\d{12})\b/i
const GENERIC_TXN_REGEX  = /\b([A-Z]?\d{12,20})\b/
const GPAY_TXN_REGEX     = /(?:Google\s+Transaction\s+ID|Transaction\s+ID)\s*:?\s*([A-Z0-9]{12,20})/i
const PAYTM_REF_REGEX    = /UPI\s+Ref\s+No\.?\s*:?\s*(\d{12,20})/i

// UPI IDs
const UPI_ID_REGEX       = /([a-zA-Z0-9._\-+]{2,256}@[a-zA-Z]{2,64})/
const MASKED_UPI_REGEX   = /\*+(\d{4,})@([a-zA-Z0-9]+)/
const PHONE_UPI_REGEX    = /\+?(?:91)?([6-9]\d{9})\b/

// Dates
const DATE_ON_REGEX      = /(\d{1,2}:\d{2}\s*(?:am|pm))\s+on\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i
const DATE_COMMA_REGEX   = /(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)[,\s]+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,\s]+\d{2,4})/i
const DATE_NAMED_REGEX   = /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i
const DATE_NUMERIC_REGEX = /\b(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})\b/
const DATE_ISO_REGEX     = /\b(\d{4}[-\/]\d{2}[-\/]\d{2})\b/

// Currency amounts
const CURRENCY_AMOUNT_REGEX = /(?:₹|rs\.?|inr|mrp)\s*:?\s*([\d]{1,3}(?:,[\d]{2,3})*(?:\.\d{1,2})?|[\d]+(?:\.\d{1,2})?)/gi
const PLAIN_AMOUNT_REGEX    = /\b([\d]{1,3}(?:,[\d]{2,3})*(?:\.\d{1,2})?|[\d]{2,}(?:\.\d{1,2})?)\b/g

// Merchant name extractors for fallback
const RECEIPT_MERCHANT_REGEX = /(?:paid\s+to|sent\s+to|to|merchant|receiver|beneficiary)[:\s]+([A-Za-z0-9\s&.'\-]{2,60}?)(?:\n|$|UPI|@|\d)/i
const VOUCHER_MERCHANT_REGEX = /(?:sold\s+by|vendor|merchant|invoice\s+to|bill\s+to)[:\s]+([A-Za-z0-9\s&.'\-]{2,60}?)(?:\n|$|\d)/i

// ─── Positive/negative cues ────────────────────────────────────────────────

const POSITIVE_AMOUNT_CUES = [
    'you paid', 'paid to', 'paid successfully', 'transaction successful',
    'paid', 'sent to', 'sent', 'received from', 'received',
    'debited', 'credited', 'amount', 'transaction amount',
    'total', 'payment', 'transfer', 'completed', 'success',
]

const NEGATIVE_AMOUNT_CUES = [
    'available balance', 'closing balance', 'opening balance', 'balance',
    'google transaction id', 'upi transaction id', 'transaction id',
    'ref no', 'reference', 'utr', 'rrn', 'a/c', 'account',
    'mobile', 'phone', 'date', 'time', 'bank',
]

const PROVIDER_CUES: Record<ProviderKind, string[]> = {
    gpay:             ['google pay', 'g pay', 'google transaction id', 'completed', 'paid to'],
    phonepe:          ['phonepe', 'transaction successful', 'payment details', 'paid to', 'debited from'],
    paytm:            ['paytm', 'money received', 'upi ref no', 'rupees', 'paid successfully'],
    generic_upi:      ['paid', 'received', 'upi transaction', 'transaction id'],
    unknown_provider: [],
}

// ─── Utility helpers ────────────────────────────────────────────────────────

function getLines(text: string): string[] {
    return text.split('\n').map(l => l.trim()).filter(Boolean)
}

function buildContext(text: string, start: number, radius = 45): string {
    return text.slice(Math.max(0, start - radius), Math.min(text.length, start + radius)).toLowerCase()
}

function looksLikeDate(v: string): boolean {
    return /^(\d{1,2}[:\-\/]\d{1,2}([\-\/]\d{2,4})?|\d{4}[\-\/]\d{2}[\-\/]\d{2})$/.test(v)
}

function looksLikeTime(v: string): boolean {
    return /^\d{1,2}:\d{2}(:\d{2})?$/.test(v)
}

/** Clean extracted merchant / person names */
function cleanName(raw: string): string {
    return raw
        .replace(/\s{2,}/g, ' ')
        .replace(/\b(?:google pay|phonepe|paytm|gpay|g pay|upi|bank|ltd|pvt|limited)\b.*$/i, '')
        .replace(/[₹₨]\s*\d+/g, '')
        .replace(/\s+[₹₨]?\d+$/g, '')
        .replace(/\+?\d{10,}/g, '')
        .replace(/[|]/g, '')
        .trim()
}

/** Best-effort phone → UPI ID fallback */
function phoneToUpi(text: string): string {
    const m = PHONE_UPI_REGEX.exec(text)
    return m?.[1] ?? ''
}

// ─── Amount candidate infrastructure ───────────────────────────────────────

interface AmountCandidate {
    value: number
    raw: string
    index: number
    lineIndex: number
    score: number
}

function buildCandidate(raw: string, index: number, lines: string[]): AmountCandidate | null {
    const amount = parseRupeeAmount(raw)
    if (amount === null) return null
    if (looksLikeDate(raw) || looksLikeTime(raw)) return null

    const lineIndex = Math.max(0, lines.findIndex(l =>
        l.toLowerCase().includes(raw.toLowerCase().trim())
    ))
    return { value: amount, raw, index, lineIndex, score: 0 }
}

function collectCurrencyCandidates(text: string, lines: string[]): AmountCandidate[] {
    const candidates: AmountCandidate[] = []
    const seen = new Set<string>()

    for (const m of text.matchAll(CURRENCY_AMOUNT_REGEX)) {
        const c = buildCandidate(m[0], m.index ?? 0, lines)
        if (!c) continue
        const key = `${c.value}-${c.lineIndex}-${Math.floor(c.index / 8)}`
        if (!seen.has(key)) { seen.add(key); candidates.push(c) }
    }
    return candidates
}

function scoreAmountCandidate(
    text: string,
    c: AmountCandidate,
    lines: string[],
    provider: ProviderKind
): number {
    let score = 0
    const ctx = buildContext(text, c.index)
    const lineCtx = (lines[c.lineIndex] ?? '').toLowerCase()
    const combined = `${ctx} ${lineCtx}`

    for (const cue of POSITIVE_AMOUNT_CUES)
        if (combined.includes(cue)) score += cue.includes(' ') ? 5 : 2

    for (const cue of NEGATIVE_AMOUNT_CUES)
        if (combined.includes(cue)) score -= cue.includes(' ') ? 6 : 2

    for (const cue of PROVIDER_CUES[provider] ?? [])
        if (combined.includes(cue)) score += cue.includes(' ') ? 3 : 2

    // Currency marker is the strongest single signal
    if (/₹|\brs\b|\binr\b/i.test(c.raw)) score += 10
    // Standalone amount line (just ₹XX)
    if (/^\s*(?:₹|rs\.?|inr)\s*[\d,]+(?:\.\d{1,2})?\s*$/i.test(lineCtx)) score += 16
    // Position heuristic (most receipts show amount in the top quarter)
    if (c.lineIndex <= 3) score += 8
    else if (c.lineIndex >= 12) score -= 4

    // Provider-specific bonuses
    if (provider === 'gpay' && c.lineIndex <= 4) score += 6
    if (provider === 'phonepe' && /^\s*(?:₹|rs\.?|inr)\s*\d/i.test(lineCtx)) score += 14
    if (provider === 'paytm' && /paid successfully|money received/i.test(combined)) score += 5

    // Suppress known non-amount patterns
    if (/transaction id|google transaction id|upi transaction id|utr|ref(?:erence)?|mobile|phone/i.test(lineCtx)) score -= 12
    if (/failed|pending|processing/.test(lineCtx)) score -= 2
    if (/success|completed|paid|received|debited|credited/.test(lineCtx)) score += 4
    if (c.value >= 1 && c.value <= 200_000) score += 2
    if (Number.isInteger(c.value)) score += 1

    return score
}

// ─── Provider-anchored amount extraction ───────────────────────────────────

function findProviderAnchoredAmount(text: string, lines: string[], provider: ProviderKind): number | null {
    const pattern = /(?:₹|rs\.?|inr)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/i

    if (provider === 'gpay') {
        for (const line of lines.slice(0, 10)) {
            const m = line.match(pattern)
            if (m?.[1]) { const v = parseRupeeAmount(m[1]); if (v) return v }
        }
    }

    if (provider === 'phonepe') {
        // Look for a standalone "₹XX" line in the top 15 lines
        const amountLine = lines.slice(0, 15).find(l =>
            /^(?:₹|rs\.?|inr)\s*\d[\d,]*(?:\.\d{1,2})?$/i.test(l.trim()) &&
            !/debited from|utr|transaction id|ref no/i.test(l)
        )
        if (amountLine) {
            const m = amountLine.match(pattern)
            if (m?.[1]) { const v = parseRupeeAmount(m[1]); if (v) return v }
        }

        const inlineMatch = text.match(
            /paid\s+to\s+[A-Za-z\s&.'\-]{2,60}?\s*(₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i
        )
        if (inlineMatch?.[2]) { const v = parseRupeeAmount(inlineMatch[2]); if (v) return v }
    }

    if (provider === 'paytm') {
        const paidOk = text.match(/paid successfully[\s\S]{0,80}?(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i)
        if (paidOk?.[1]) { const v = parseRupeeAmount(paidOk[1]); if (v) return v }
        const monOk = text.match(/money received[\s\S]{0,80}?(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i)
        if (monOk?.[1]) { const v = parseRupeeAmount(monOk[1]); if (v) return v }
        const topLine = lines.slice(0, 12).find(l =>
            pattern.test(l) && !/upi ref no|from|to\s*:/i.test(l)
        )
        if (topLine) {
            const m = topLine.match(pattern)
            if (m?.[1]) { const v = parseRupeeAmount(m[1]); if (v) return v }
        }
    }

    return null
}

// ─── Amount extractors ─────────────────────────────────────────────────────

function extractReceiptAmount(text: string, provider: ProviderKind): number {
    const lines = getLines(text)

    // 1. Provider-specific fast path
    const anchored = findProviderAnchoredAmount(text, lines, provider)
    if (anchored !== null) return anchored

    // 2. Build candidates from currency-marked tokens
    const candidates = collectCurrencyCandidates(text, lines)

    // 3. Also scan plain numbers that are near money cues
    for (const m of text.matchAll(PLAIN_AMOUNT_REGEX)) {
        const raw = m[1] ?? ''
        if (!raw) continue
        const ctx = buildContext(text, m.index ?? 0, 22)
        const hasCue = /₹|\brs\b|\binr\b|amount|paid|payment|received|debited|credited|total|completed|success/i.test(ctx)
        if (!hasCue) continue
        const c = buildCandidate(raw, m.index ?? 0, lines)
        if (!c) continue
        // Suppress number if on a known non-amount line
        const lineCtx = (lines[c.lineIndex] ?? '').toLowerCase()
        if (/transaction id|google transaction id|upi transaction id|utr|ref|mobile|phone|account/i.test(lineCtx)) continue
        candidates.push(c)
    }

    const ranked = candidates
        .map(c => ({ ...c, score: scoreAmountCandidate(text, c, lines, provider) }))
        .sort((a, b) => b.score - a.score)

    return ranked[0]?.value ?? 0
}

function extractStatementAmount(text: string): number {
    const lines = getLines(text)
    const STMT_CUES = ['debit', 'credit', 'withdrawal', 'deposit', 'upi', 'transfer', 'txn']
    const ranked = collectCurrencyCandidates(text, lines).map(c => {
        let score = 0
        const lc = (lines[c.lineIndex] ?? '').toLowerCase()
        for (const cue of STMT_CUES) if (lc.includes(cue)) score += 3
        if (/balance/.test(lc)) score -= 8
        if (/opening balance|closing balance|available balance/.test(lc)) score -= 14
        if (/₹|\brs\b|\binr\b/i.test(c.raw)) score += 6
        return { ...c, score }
    }).sort((a, b) => b.score - a.score)
    return ranked[0]?.value ?? 0
}

function extractVoucherAmount(text: string): number {
    const lines = getLines(text)
    const VCHR_CUES = ['total', 'grand total', 'amount due', 'net amount', 'subtotal', 'invoice amount']
    const ranked = collectCurrencyCandidates(text, lines).map(c => {
        let score = 0
        const lc = (lines[c.lineIndex] ?? '').toLowerCase()
        for (const cue of VCHR_CUES) if (lc.includes(cue)) score += (cue.includes(' ') ? 5 : 3)
        if (/gst|tax|cgst|sgst|discount/.test(lc)) score -= 2
        if (/₹|\brs\b|\binr\b/i.test(c.raw)) score += 5
        return { ...c, score }
    }).sort((a, b) => b.score - a.score)
    return ranked[0]?.value ?? 0
}

// ─── Date extraction ────────────────────────────────────────────────────────

function extractDate(text: string): string {
    // Strategy 1: "08:07 am on 28 Feb 2026" (PhonePe)
    const m1 = DATE_ON_REGEX.exec(text)
    if (m1?.[2]) return normalizeDateString(m1[2]) ?? m1[2]

    // Strategy 2: "12:48 AM, 13 Feb 2026" (Paytm)
    const m2 = DATE_COMMA_REGEX.exec(text)
    if (m2?.[2]) return normalizeDateString(m2[2]) ?? m2[2]

    // Strategy 3: "13 Feb 2026" standalone
    const m3 = DATE_NAMED_REGEX.exec(text)
    if (m3?.[0]) return normalizeDateString(m3[0]) ?? m3[0]

    // Strategy 4: Search top 20 lines
    const lines = getLines(text)
    const topText = lines.slice(0, 20).join('\n')
    for (const re of [DATE_NAMED_REGEX, DATE_NUMERIC_REGEX, DATE_ISO_REGEX]) {
        const m = re.exec(topText)
        if (m?.[1] ?? m?.[0]) {
            const raw = m[1] ?? m[0]!
            return normalizeDateString(raw) ?? raw
        }
    }

    // Strategy 5: Look near UPI Ref / Transaction ID
    const refIdx = lines.findIndex(l => /upi\s*ref|transaction\s*id|utr/i.test(l))
    if (refIdx !== -1) {
        const ctx = lines.slice(Math.max(0, refIdx - 2), Math.min(lines.length, refIdx + 4)).join('\n')
        const m = DATE_NUMERIC_REGEX.exec(ctx)
        if (m?.[1]) return normalizeDateString(m[1]) ?? m[1]
    }

    // Strategy 6: Full text fallback
    for (const re of [DATE_NAMED_REGEX, DATE_NUMERIC_REGEX, DATE_ISO_REGEX]) {
        const m = re.exec(text)
        if (m?.[1] ?? m?.[0]) {
            const raw = m[1] ?? m[0]!
            return normalizeDateString(raw) ?? raw
        }
    }

    return ''
}

// ─── Transaction ID extraction ─────────────────────────────────────────────

function extractTransactionId(text: string, provider: ProviderKind): string {
    if (provider === 'phonepe') {
        // Strategy 1: "UTR: 123456789012"
        const m1 = UTR_LABEL_REGEX.exec(text)
        if (m1?.[1]) return m1[1]

        // Strategy 2: "UTR\n123456789012"
        const lines = text.split('\n')
        for (let i = 0; i < lines.length - 1; i++) {
            if (UTR_NEXTLINE_REGEX.test(lines[i]!.trim())) {
                const next = lines[i + 1]!.trim()
                const m = next.match(/^(\d{12})(?:\s|$)/)
                if (m?.[1]) return m[1]
            }
        }

        // Strategy 3: 12-digit after UTR keyword
        const utrIdx = text.toLowerCase().indexOf('utr')
        if (utrIdx !== -1) {
            const snippet = text.slice(utrIdx, utrIdx + 100)
            const m = snippet.match(/\b(\d{12})\b/)
            if (m?.[1]) return m[1]
        }

        // Strategy 4: RRN
        const rrn = RRN_REGEX.exec(text)
        if (rrn?.[1]) return rrn[1]

        // Strategy 5: Any standalone 12-digit block
        const all = text.match(/(?:^|\s)(\d{12})(?:\s|$)/gm)
        if (all?.[0]) return all[0].trim()

        return ''
    }

    if (provider === 'paytm') {
        const m = PAYTM_REF_REGEX.exec(text)
        if (m?.[1]) return m[1]
    }

    if (provider === 'gpay') {
        const m = GPAY_TXN_REGEX.exec(text)
        if (m?.[1]) return m[1]
    }

    // Generic fallback: branded patterns first, then any long number
    const utrGeneric = UTR_LABEL_REGEX.exec(text)
    if (utrGeneric?.[1]) return utrGeneric[1]

    const generic = GENERIC_TXN_REGEX.exec(text)
    return generic?.[1] ?? ''
}

// ─── UPI ID extraction ─────────────────────────────────────────────────────

function extractUpiId(text: string, provider: ProviderKind): string {
    const standard = UPI_ID_REGEX.exec(text)
    if (standard?.[1]) return standard[1].toLowerCase()

    if (provider === 'phonepe') {
        const masked = MASKED_UPI_REGEX.exec(text)
        if (masked?.[1] && masked?.[2]) return `${masked[1]}@${masked[2]}`.toLowerCase()
        return phoneToUpi(text)
    }

    return ''
}

// ─── Merchant name extraction ───────────────────────────────────────────────

function extractMerchantName(text: string, provider: ProviderKind): string {
    const lines = getLines(text)

    // Step 1: Structural KV parse has already run – the caller passes KV hits.
    // Here we handle the remaining heuristic approaches.

    // Standalone key → next line value pattern
    const standaloneIdx = lines.findIndex(l =>
        /^(paid to|sent to|to\s*:?|to|from\s*:?|from)$/i.test(l)
    )
    if (standaloneIdx !== -1) {
        const next = lines[standaloneIdx + 1]
        if (next) return cleanName(next)
    }

    if (provider === 'gpay') {
        const top = lines.slice(0, 6).find(l => /^to\s+/i.test(l))
        if (top) return cleanName(top.replace(/^to\s*:?/i, ''))
    }

    if (provider === 'phonepe') {
        // Inline "Paid to Name ₹Amount"
        const inline = text.match(/paid\s+to\s+([A-Z][A-Za-z\s&.'\-]{2,60}?)(?:\s+₹|\s+Rs\.?|\s*\d+|$)/i)
        if (inline?.[1]) {
            const cleaned = cleanName(inline[1])
            if (cleaned && !/phonepe|transaction|payment|upi|debited/i.test(cleaned)) return cleaned
        }

        // "Received from" standalone → next line
        const rfIdx = lines.findIndex(l => /^received from$/i.test(l))
        if (rfIdx !== -1) {
            const next = lines[rfIdx + 1]
            if (next && !/phonepe|transaction|payment|upi|debited|credited/i.test(next))
                return cleanName(next)
        }

        // "Paid to" standalone → next line
        const ptIdx = lines.findIndex(l => /^paid to$/i.test(l))
        if (ptIdx !== -1) {
            const next = lines[ptIdx + 1]
            if (next && !/phonepe|transaction|payment|upi|debited/i.test(next))
                return cleanName(next)
        }

        // All-caps name pattern (common in PhonePe)
        const capName = lines.slice(0, 10).find(l =>
            /^[A-Z][A-Z\s]{2,40}$/.test(l) &&
            !/PHONEPE|TRANSACTION|PAYMENT|DEBITED|SUCCESSFUL|DETAILS/i.test(l)
        )
        if (capName) return cleanName(capName)
    }

    if (provider === 'paytm') {
        const fromLine = lines.find(l => /^from\s*:/i.test(l))
        const toLine = lines.find(l => /^to\s*:/i.test(l))
        if (fromLine || toLine)
            return cleanName((toLine ?? fromLine ?? '').replace(/^(from|to)\s*:/i, ''))

        const capName = lines.slice(0, 8).find(l =>
            /^[A-Z][A-Za-z\s]{2,40}$/.test(l) &&
            !/PAYTM|UPIINTENT|RUPEES|PAID/i.test(l)
        )
        if (capName) return cleanName(capName)
    }

    // Final regex fallback
    const fm = RECEIPT_MERCHANT_REGEX.exec(text)
    return cleanName(fm?.[1] ?? '')
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

function extractByDocumentType(
    text: string,
    kind: DocumentKind,
    provider: ProviderKind
): Partial<ExtractedFields> {
    // Run amount-specific normalization for amount fields
    const amountText = normalizeOcrTextForAmount(text)
    // General normalization for all other fields
    const normalText = normalizeOcrText(text)

    // ── Structural KV parse (most reliable)
    const kvLines = getLines(normalText)
    const kv = extractFromKeyValuePairs(kvLines)

    switch (kind) {

        case 'bank_statement': {
            return {
                transactionId: kv.transactionId ?? GENERIC_TXN_REGEX.exec(normalText)?.[1] ?? '',
                upiId: kv.upiId ?? UPI_ID_REGEX.exec(normalText)?.[1]?.toLowerCase() ?? '',
                amount: extractStatementAmount(amountText),
                merchantName: (() => {
                    const lines = getLines(normalText)
                    const txnLine = lines.find(l => /\b(?:upi|debit|credit|withdrawal|deposit|transfer)\b/i.test(l)) ?? ''
                    const m = /(?:to|from|upi)\s+([A-Za-z0-9\s&.'\-]{2,60})/i.exec(txnLine)
                    if (m?.[1]) return m[1].trim()
                    return txnLine
                        .replace(DATE_NUMERIC_REGEX, '')
                        .replace(CURRENCY_AMOUNT_REGEX, '')
                        .replace(/\b(?:debit|credit|withdrawal|deposit|upi|transfer|txn)\b/gi, '')
                        .trim()
                })(),
                transactionDate: (() => {
                    const lines = getLines(normalText)
                    const txnLine = lines.find(l => /\b(?:upi|debit|credit|withdrawal|deposit|transfer)\b/i.test(l))
                    if (txnLine) {
                        const m = DATE_NUMERIC_REGEX.exec(txnLine)
                        if (m?.[1]) return normalizeDateString(m[1]) ?? m[1]
                    }
                    return extractDate(normalText)
                })(),
            }
        }

        case 'voucher': {
            return {
                transactionId: kv.transactionId ?? GENERIC_TXN_REGEX.exec(normalText)?.[1] ?? '',
                upiId: kv.upiId ?? '',
                amount: extractVoucherAmount(amountText),
                merchantName: kv.merchantName ??
                    cleanName(VOUCHER_MERCHANT_REGEX.exec(normalText)?.[1] ?? ''),
                transactionDate: extractDate(normalText),
            }
        }

        case 'upi_receipt_failed':
        case 'upi_receipt_pending':
        case 'upi_receipt_success':
        case 'unknown':
        default: {
            const txnId   = kv.transactionId ?? kv.utr ?? kv.rrn ?? extractTransactionId(normalText, provider)
            const upiId   = kv.upiId ?? extractUpiId(normalText, provider)
            
            let merchant = kv.merchantName ? cleanName(kv.merchantName) : ''
            if (!merchant) merchant = extractMerchantName(normalText, provider)

            // Date: prefer KV parse, then multistrategy regex
            const date = kv.date
                ? normalizeDateString(kv.date) ?? kv.date
                : extractDate(normalText)

            const amount = extractReceiptAmount(amountText, provider)

            return { transactionId: txnId, upiId, amount, merchantName: merchant, transactionDate: date }
        }
    }
}

// ─── Public composable ───────────────────────────────────────────────────────

export function useFieldExtractor() {
    function extract(
        rawText: string,
        kind: DocumentKind = 'unknown',
        provider: ProviderKind = 'unknown_provider'
    ): Partial<ExtractedFields> {
        // Apply character-level fixes first, then hand off to full extraction
        const fixedText = applyOcrCharFixes(rawText)
        return extractByDocumentType(fixedText, kind, provider)
    }

    function validate(fields: Partial<ExtractedFields>) {
        const issues: string[] = []
        if (!fields.transactionId) issues.push('Transaction ID not found')
        if (!fields.upiId) issues.push('UPI ID not found')
        if (!fields.amount || fields.amount <= 0) issues.push('Amount is zero or missing')
        if (!fields.transactionDate) issues.push('Date not found')
        return { valid: issues.length === 0, issues }
    }

    return { extract, validate }
}
