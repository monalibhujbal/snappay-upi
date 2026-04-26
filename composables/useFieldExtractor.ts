import type { DocumentKind, ExtractedFields, ProviderKind } from '~/types/transaction'

const RUPEE = '\u20B9'
const TXN_ID_REGEX = /\b([A-Z]?\d{12,20})\b/
// PhonePe transaction ID: T followed by 23 digits
const PHONEPE_TXN_REGEX = /\b(T\d{23})\b/
// UTR number: 12 digits
const UTR_REGEX = /\b(?:UTR|utr)[:\s]*(\d{12})\b/i
const UPI_ID_REGEX = /([a-zA-Z0-9._-]+@[a-zA-Z]{2,})/i
// Phone number as UPI ID (10 digits, optionally with +91 prefix)
const PHONE_UPI_REGEX = /\+?(91)?(\d{10})\b/
const DATE_REGEX = /(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,\s]+\d{2,4}|\d{4}[\/-]\d{2}[\/-]\d{2})/i
const TIME_REGEX = /\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:am|pm|AM|PM))?/
const DATETIME_REGEX = /(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)[,\s]+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,\s]+\d{2,4})/i
const DATETIME_ON_REGEX = /(\d{1,2}:\d{2}\s*(?:am|pm))\s+on\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i
const DATE_ONLY_REGEX = /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i
const RECEIPT_MERCHANT_REGEX = /(?:paid\s+to|sent\s+to|to|merchant|receiver|beneficiary)[:\s]+([A-Za-z0-9\s&.'-]{2,60}?)(?:\n|$|UPI|@|\d)/i
const VOUCHER_MERCHANT_REGEX = /(?:sold\s+by|vendor|merchant|invoice\s+to|bill\s+to)[:\s]+([A-Za-z0-9\s&.'-]{2,60}?)(?:\n|$|\d)/i
const CURRENCY_AMOUNT_REGEX = /(?:\u20B9|rs\.?|inr|mrp)\s*[:\-]?\s*([\d]{1,3}(?:,[\d]{2,3})*(?:\.\d{1,2})?|[\d]+(?:\.\d{1,2})?)/gi
const PLAIN_AMOUNT_REGEX = /\b([\d]{1,3}(?:,[\d]{2,3})*(?:\.\d{1,2})?|[\d]+(?:\.\d{1,2})?)\b/g

const PROVIDER_POSITIVE_CUES: Record<ProviderKind, string[]> = {
    gpay: ['google pay', 'g pay', 'google transaction id', 'completed', 'paid to'],
    phonepe: ['phonepe', 'transaction successful', 'payment details', 'paid to', 'debited from'],
    paytm: ['paytm', 'money received', 'upi ref no', 'rupees', 'paid successfully'],
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
    'completed',
    'success',
    'successful',
    'paid successfully',
    'transaction successful',
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
    'upi transaction id',
    'google transaction id',
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

const STATEMENT_AMOUNT_CUES = ['debit', 'credit', 'withdrawal', 'deposit', 'upi', 'transfer', 'txn']
const VOUCHER_AMOUNT_CUES = ['total', 'grand total', 'amount due', 'net amount', 'subtotal', 'invoice amount']

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
        .replace(/\u20B9|â‚¹|Ã¢â€šÂ¹|ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹/g, RUPEE)
        .replace(/\bR(?=\s*\d{1,6}(?:\.\d{1,2})?\b)/g, RUPEE)
        .replace(/\bRS(?=\s*\d{1,6}(?:\.\d{1,2})?\b)/gi, 'Rs')
        .replace(/\b(?:rs|rs\.|inr)\b/gi, 'Rs')
        .replace(/(?<=\d)[oO](?=\d)/g, '0')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{2,}/g, '\n')
        .trim()
}

function normalizeOcrTextForAmount(rawText: string) {
    let text = rawText
        .replace(/\r\n/g, '\n')
        .replace(/[|]/g, 'I')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\u20B9|â‚¹|Ã¢â€šÂ¹|ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹/g, RUPEE)
        .replace(/\bR(?=\s*\d{1,6}(?:\.\d{1,2})?\b)/g, RUPEE)
        .replace(/\bRS(?=\s*\d{1,6}(?:\.\d{1,2})?\b)/gi, 'Rs')
        .replace(/\b(?:rs|rs\.|inr)\b/gi, 'Rs')
        .replace(/(?<=\d)[oO](?=\d)/g, '0')
    
    // Smart "2" to "₹" conversion for amounts
    // Only convert when it's clearly a misread rupee symbol, not a legitimate "2"
    
    // Pattern 1: "2 " followed by 2-4 digits (likely misread ₹)
    // Examples: "2 41" → "₹ 41", "2 123" → "₹ 123"
    // But NOT if preceded by another digit (to avoid "12 345" → "1₹ 345")
    text = text.replace(/(?<!\d)\b2\s+(\d{2,4}(?:[,\.]\d+)?)\b/g, `${RUPEE} $1`)
    
    // Pattern 2: Line starts with "2" followed by exactly 2-3 digits (e.g., "241" → "₹41", "2123" → "₹123")
    // But check if it's really an amount context (not a year like "2026" or ID like "2303")
    text = text.replace(/^2(\d{2,3})\b/gm, (match, digits) => {
        const fullNum = parseInt('2' + digits, 10)
        // Don't convert if it looks like a year (2000-2099) or large number (>2200)
        if (fullNum >= 2000 && fullNum <= 2099) return match
        if (fullNum > 2200) return match // Likely a transaction ID or ref number
        return `${RUPEE}${digits}`
    })
    
    return text
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{2,}/g, '\n')
        .trim()
}

function parseAmount(value: string): number | null {
    const normalized = value
        .replace(new RegExp(RUPEE, 'g'), '')
        .replace(/\b(?:r|rs|inr|mrp)\b/gi, '')
        .replace(/(?<=\d)[oO](?=\d)/g, '0')
        .replace(/,/g, '')
        .trim()

    if (!normalized) return null
    const amount = Number.parseFloat(normalized)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 200000) return null
    return amount
}

function looksLikeDate(value: string) {
    return /^(\d{1,2}[:\/-]\d{1,2}([:\/-]\d{2,4})?|\d{4}[:\/-]\d{1,2}[:\/-]\d{1,2})$/.test(value)
}

function looksLikeTime(value: string) {
    return /^\d{1,2}:\d{2}(:\d{2})?$/.test(value)
}

function buildContext(text: string, start: number, radius = 40) {
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

    const lineIndex = Math.max(0, lines.findIndex(line => line.toLowerCase().includes(raw.toLowerCase().trim())))
    return { value: amount, raw, index, lineIndex, score: 0 }
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

function lineHasCurrencyMarker(line: string) {
    return new RegExp(`${RUPEE}|\\br(?=\\d)|\\brs\\b|\\binr\\b`, 'i').test(line)
}

function boostTopLineAmountCandidates(text: string, lines: string[], provider: ProviderKind) {
    const boosted: AmountCandidate[] = []
    const topWindow = provider === 'gpay' ? 8 : provider === 'phonepe' ? 12 : provider === 'paytm' ? 12 : 10

    for (let i = 0; i < Math.min(topWindow, lines.length); i += 1) {
        const line = lines[i] ?? ''
        const matches = [...line.matchAll(/(?:₹|rs\.?|inr)?\s*(\d{1,6}(?:,\d{2,3})*(?:\.\d{1,2})?)/gi)]
        for (const match of matches) {
            const raw = match[0]?.trim() ?? ''
            if (!raw) continue

            const candidate = buildCandidate(raw, text.indexOf(line), lines)
            if (!candidate) continue
            if (!lineHasCurrencyMarker(raw) && !/paid|received|completed|successful|amount/i.test(line)) continue

            candidate.lineIndex = i
            candidate.score += Math.max(0, 18 - i)
            boosted.push(candidate)
        }
    }

    return boosted
}

function findProviderAnchoredAmount(text: string, lines: string[], provider: ProviderKind): number | null {
    const normalized = text.toLowerCase()

    if (provider === 'gpay') {
        const pattern = /(?:amount\s+)?(?:₹|rs\.?|inr)\s*[:\-]?\s*(\d{1,6}(?:,\d{2,3})*(?:\.\d{1,2})?)/i
        for (const line of lines.slice(0, 8)) {
            const match = line.match(pattern)
            if (!match?.[1]) continue
            const amount = parseAmount(match[1])
            if (amount !== null) return amount
        }

        if (/paid to|to\s+[a-z]/i.test(normalized)) {
            const topCurrencyMatch = lines.slice(0, 8).join('\n').match(pattern)
            if (topCurrencyMatch?.[1]) {
                const amount = parseAmount(topCurrencyMatch[1])
                if (amount !== null) return amount
            }
        }
    }

    if (provider === 'phonepe') {
        // PhonePe shows amount as small text on the right side
        // Look for standalone amount lines (just ₹XX format)
        const topAmountLine = lines.slice(0, 12).find(line => {
            const trimmed = line.trim()
            // Match lines that are just amount (₹41, ₹123, etc.)
            return /^(?:₹|rs\.?|inr)\s*\d+(?:,\d{2,3})*(?:\.\d{1,2})?$/i.test(trimmed) && 
                   !/debited from|utr|transaction id|ref no/i.test(trimmed)
        })
        if (topAmountLine) {
            const match = topAmountLine.match(/(?:₹|rs\.?|inr)\s*[:\-]?\s*(\d{1,6}(?:,\d{2,3})*(?:\.\d{1,2})?)/i)
            if (match?.[1]) {
                const amount = parseAmount(match[1])
                if (amount !== null) return amount
            }
        }

        // Also look for amount near "paid to" or "transaction successful"
        const paidToPattern = /(?:paid to|transaction successful)[\s\S]{0,80}?(?:₹|rs\.?|inr)\s*[:\-]?\s*(\d{1,6}(?:,\d{2,3})*(?:\.\d{1,2})?)/i
        const paidToMatch = normalized.match(paidToPattern)
        if (paidToMatch?.[1]) {
            const amount = parseAmount(paidToMatch[1])
            if (amount !== null) return amount
        }
    }

    if (provider === 'paytm') {
        const paidSuccessfullyMatch = normalized.match(/paid successfully[\s\S]{0,60}?(?:₹|rs\.?|inr)\s*[:\-]?\s*(\d{1,6}(?:,\d{2,3})*(?:\.\d{1,2})?)/i)
        if (paidSuccessfullyMatch?.[1]) {
            const amount = parseAmount(paidSuccessfullyMatch[1])
            if (amount !== null) return amount
        }

        const moneyReceivedMatch = normalized.match(/money received[\s\S]{0,60}?(?:₹|rs\.?|inr)\s*[:\-]?\s*(\d{1,6}(?:,\d{2,3})*(?:\.\d{1,2})?)/i)
        if (moneyReceivedMatch?.[1]) {
            const amount = parseAmount(moneyReceivedMatch[1])
            if (amount !== null) return amount
        }

        const topAmountLine = lines.slice(0, 10).find(line =>
            /(?:₹|rs\.?|inr)\s*\d/.test(line) && !/upi ref no|from|to\s*:/i.test(line)
        )
        if (topAmountLine) {
            const match = topAmountLine.match(/(?:₹|rs\.?|inr)\s*[:\-]?\s*(\d{1,6}(?:,\d{2,3})*(?:\.\d{1,2})?)/i)
            if (match?.[1]) {
                const amount = parseAmount(match[1])
                if (amount !== null) return amount
            }
        }
    }

    return null
}

function providerBonus(provider: ProviderKind, lineContext: string, textContext: string) {
    let score = 0
    const combined = `${lineContext} ${textContext}`

    for (const cue of PROVIDER_POSITIVE_CUES[provider] ?? []) {
        if (combined.includes(cue)) score += cue.includes(' ') ? 3 : 2
    }

    if (provider === 'gpay' && /completed|google pay|g pay/.test(combined)) score += 2
    if (provider === 'phonepe' && /phonepe|transaction successful|paid to/.test(combined)) score += 2
    if (provider === 'paytm' && /paytm|money received|upi ref no|paid successfully/.test(combined)) score += 2

    return score
}

function scoreReceiptCandidate(rawText: string, candidate: AmountCandidate, lines: string[], provider: ProviderKind) {
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
    if (Number.isInteger(candidate.value)) score += 1
    if (/success|completed|paid|received|debited|credited/.test(lineContext)) score += 4
    if (/failed|pending|processing/.test(lineContext)) score -= 1
    if (/transaction id|google transaction id|upi transaction id|utr|ref|rrn/.test(lineContext)) score -= 10
    if (/debited from|credited to|credited in/.test(lineContext)) score -= 3
    if (/^\s*(?:₹|rs\.?|inr)\s*\d[\d,]*(?:\.\d{1,2})?\s*$/i.test(lineContext)) score += 14
    if (candidate.lineIndex <= 3) score += 6
    if (candidate.lineIndex >= 10) score -= 4

    if (provider === 'gpay' && candidate.lineIndex <= 4) score += 5
    if (provider === 'phonepe' && candidate.lineIndex <= 6) score += 4
    if (provider === 'paytm' && candidate.lineIndex <= 6) score += 4
    if (provider === 'gpay' && /paid to|completed|google pay|g pay/.test(nearbyContext)) score += 3
    if (provider === 'phonepe' && /paid to|transaction successful|payment details/.test(nearbyContext)) score += 3
    // PhonePe: Boost standalone amount lines (just ₹XX format)
    if (provider === 'phonepe' && /^\s*(?:₹|rs\.?|inr)\s*\d[\d,]*(?:\.\d{1,2})?\s*$/i.test(lineContext)) score += 12
    if (provider === 'paytm' && /paid successfully|money received|upiintent/.test(nearbyContext)) score += 4

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

    const standaloneIndex = lines.findIndex(line => /^(paid to|sent to|to\s*:?|to|from\s*:?|from)$/i.test(line))
    if (standaloneIndex !== -1) {
        const nextLine = lines[standaloneIndex + 1]
        if (nextLine) return nextLine.trim()
    }

    if (provider === 'gpay') {
        const topMatch = lines.slice(0, 6).find(line => /^to\s+/i.test(line))
        if (topMatch) return topMatch.replace(/^to\s*:?/i, '').trim()
    }

    if (provider === 'phonepe') {
        // Handle inline "Paid to [Name] ₹Amount" pattern
        const inlinePaidToMatch = text.match(/paid\s+to\s+([A-Z][A-Za-z\s&.'-]{2,60}?)(?:\s+₹|\s+Rs\.?|\s+\d+|$)/i)
        if (inlinePaidToMatch?.[1]) {
            const name = inlinePaidToMatch[1].trim()
            if (!/phonepe|transaction|payment|upi|debited/i.test(name)) {
                return name
            }
        }
        
        // Handle "Received from" pattern
        const receivedFromLine = lines.findIndex(line => /^received from$/i.test(line))
        if (receivedFromLine !== -1) {
            const nextLine = lines[receivedFromLine + 1]
            if (nextLine && !/phonepe|transaction|payment|upi|debited|credited/i.test(nextLine)) {
                // Clean up the name (remove phone numbers, amounts, etc.)
                const cleaned = nextLine
                    .replace(/[₹₨]\s*\d+/g, '') // Remove amounts with rupee symbol
                    .replace(/\s+[₹₨]?\d+$/g, '') // Remove trailing amounts (e.g., "X330", "3260")
                    .replace(/\+?\d{10,}/g, '') // Remove phone numbers
                    .replace(/[A-Z]\)\s*/g, '') // Remove "A)" type prefixes
                    .replace(/\s+X\d+$/g, '') // Remove "X330" type suffixes
                    .trim()
                if (cleaned) return cleaned
            }
        }
        
        // Handle "Paid to" pattern (standalone line)
        const paidToLine = lines.find(line => /^paid to$/i.test(line))
        if (paidToLine) {
            const index = lines.indexOf(paidToLine)
            const nextLine = lines[index + 1]
            if (nextLine && !/phonepe|transaction|payment|upi|debited/i.test(nextLine)) {
                const cleaned = nextLine
                    .replace(/[₹₨]\s*\d+/g, '')
                    .replace(/\s+[₹₨]?\d+$/g, '')
                    .replace(/\+?\d{10,}/g, '')
                    .replace(/[A-Z]\)\s*/g, '')
                    .replace(/\s+X\d+$/g, '')
                    .trim()
                if (cleaned) return cleaned
            }
        }
        
        const namePattern = /^([A-Z][A-Z\s]{2,40})$/
        for (const line of lines.slice(0, 8)) {
            if (namePattern.test(line) && !/phonepe|transaction|payment|debited/i.test(line)) {
                return line.trim()
            }
        }
    }

    if (provider === 'paytm') {
        const fromLine = lines.find(line => /^from\s*:/i.test(line))
        const toLine = lines.find(line => /^to\s*:/i.test(line))
        if (fromLine || toLine) return (toLine ?? fromLine ?? '').replace(/^(from|to)\s*:/i, '').trim()
        
        const namePattern = /^([A-Z][A-Za-z\s]{2,40})$/
        for (const line of lines.slice(0, 8)) {
            if (namePattern.test(line) && !/paytm|upiintent|rupees|paid/i.test(line)) {
                return line.trim()
            }
        }
    }

    return RECEIPT_MERCHANT_REGEX.exec(text)?.[1]?.trim() ?? ''
}

function extractUpiId(text: string, provider: ProviderKind): string {
    // First try standard UPI ID format (xxx@yyy)
    const upiMatch = UPI_ID_REGEX.exec(text)
    if (upiMatch?.[1]) return upiMatch[1].toLowerCase()
    
    // For PhonePe, look for masked UPI ID patterns like "****8011@idbi"
    if (provider === 'phonepe') {
        // Pattern: asterisks followed by digits and @bank
        const maskedUpiMatch = text.match(/\*+(\d+)@([a-zA-Z0-9]+)/i)
        if (maskedUpiMatch?.[1] && maskedUpiMatch?.[2]) {
            return `${maskedUpiMatch[1]}@${maskedUpiMatch[2]}`.toLowerCase()
        }
        
        // Fallback: phone numbers are often used as UPI IDs
        const phoneMatch = PHONE_UPI_REGEX.exec(text)
        if (phoneMatch) {
            const phone = phoneMatch[2] // Get the 10-digit number
            if (phone) return phone
        }
    }
    
    return ''
}

function extractTransactionId(text: string, provider: ProviderKind): string {
    const normalized = text.toLowerCase()
    
    // PhonePe: Extract UTR number (12 digits) as transaction ID
    if (provider === 'phonepe') {
        console.log('[Transaction ID] Starting PhonePe UTR extraction...')
        console.log('[Transaction ID] Text length:', text.length)
        console.log('[Transaction ID] First 500 chars:', text.substring(0, 500))
        
        // Strategy 1: Look for "UTR:" or "UTR " followed by 12 digits (most reliable)
        const utrWithLabel = text.match(/UTR[:\s]+(\d{12})(?:\s|$)/i)
        if (utrWithLabel?.[1]) {
            console.log('[Transaction ID] Found via UTR label:', utrWithLabel[1])
            return utrWithLabel[1]
        }
        
        // Strategy 2: Look for "UTR" on one line and 12 digits on next line
        const lines = text.split('\n')
        console.log('[Transaction ID] Total lines:', lines.length)
        for (let i = 0; i < lines.length - 1; i++) {
            const currentLine = lines[i]?.trim() ?? ''
            if (/^UTR\s*:?$/i.test(currentLine)) {
                console.log('[Transaction ID] Found UTR label on line', i, ':', currentLine)
                const nextLine = lines[i + 1]?.trim() ?? ''
                console.log('[Transaction ID] Next line:', nextLine)
                const match = nextLine.match(/^(\d{12})(?:\s|$)/)
                if (match?.[1]) {
                    console.log('[Transaction ID] Found via line-by-line:', match[1])
                    return match[1]
                }
            }
        }
        
        // Strategy 3: Look for 12-digit number that appears AFTER "UTR" text
        const utrIndex = normalized.indexOf('utr')
        console.log('[Transaction ID] UTR keyword index:', utrIndex)
        if (utrIndex !== -1) {
            const afterUtr = text.substring(utrIndex, utrIndex + 100)
            console.log('[Transaction ID] Text after UTR:', afterUtr)
            const digitMatch = afterUtr.match(/\b(\d{12})\b/)
            if (digitMatch?.[1]) {
                console.log('[Transaction ID] Found after UTR keyword:', digitMatch[1])
                return digitMatch[1]
            }
        }
        
        // Strategy 4: Look for 12-digit numbers but exclude those that are part of longer numbers
        const allMatches = text.match(/(?:^|\s)(\d{12})(?:\s|$)/gm)
        console.log('[Transaction ID] All 12-digit matches:', allMatches)
        if (allMatches && allMatches.length > 0) {
            const cleanMatch = allMatches[0]?.trim()
            if (cleanMatch) {
                console.log('[Transaction ID] Found standalone 12-digit:', cleanMatch)
                return cleanMatch
            }
        }
        
        console.log('[Transaction ID] No UTR found for PhonePe')
        return ''
    }
    
    // Paytm: Look for UPI Ref No
    if (provider === 'paytm') {
        const paytmMatch = text.match(/UPI Ref No[:\s]*(\d{12,20})/i)
        if (paytmMatch?.[1]) return paytmMatch[1]
    }
    
    // Google Pay: Look for Google Transaction ID
    if (provider === 'gpay') {
        const gpayMatch = text.match(/(?:Google Transaction ID|Transaction ID)[:\s]*([A-Z0-9]{12,20})/i)
        if (gpayMatch?.[1]) return gpayMatch[1]
    }
    
    // Fallback: Generic transaction ID pattern
    const genericMatch = TXN_ID_REGEX.exec(text)
    return genericMatch?.[1] ?? ''
}

function extractReceiptAmount(text: string, provider: ProviderKind) {
    const lines = getLines(text)
    const anchored = findProviderAnchoredAmount(text, lines, provider)
    if (anchored !== null) return anchored

    const candidates = collectCurrencyCandidates(text, lines)
    candidates.push(...boostTopLineAmountCandidates(text, lines, provider))

    for (const match of text.matchAll(PLAIN_AMOUNT_REGEX)) {
        const raw = match[1] ?? ''
        if (!raw) continue

        const context = buildContext(text, match.index ?? 0, 20)
        const hasMoneyCue = new RegExp(`${RUPEE}|\\br(?=\\d)|rs|inr|amount|paid|payment|received|debited|credited|total|money|completed|success|successful`, 'i').test(context)
        if (!hasMoneyCue) continue

        const candidate = buildCandidate(raw, match.index ?? 0, lines)
        if (!candidate) continue

        const exactLine = lines[candidate.lineIndex] ?? ''
        if (/transaction id|google transaction id|upi transaction id|utr|ref(?:erence)?|mobile|phone/i.test(exactLine)) continue
        candidates.push(candidate)
    }

    const ranked = candidates
        .map(candidate => ({ ...candidate, score: candidate.score + scoreReceiptCandidate(text, candidate, lines, provider) }))
        .sort((a, b) => b.score - a.score)

    return ranked[0]?.value ?? 0
}

function extractStatementAmount(text: string) {
    const lines = getLines(text)
    const ranked = collectCurrencyCandidates(text, lines)
        .map(candidate => ({ ...candidate, score: scoreStatementCandidate(lines[candidate.lineIndex] || '', candidate) }))
        .sort((a, b) => b.score - a.score)
    return ranked[0]?.value ?? 0
}

function extractVoucherAmount(text: string) {
    const lines = getLines(text)
    const ranked = collectCurrencyCandidates(text, lines)
        .map(candidate => ({ ...candidate, score: scoreVoucherCandidate(lines[candidate.lineIndex] || '', candidate) }))
        .sort((a, b) => b.score - a.score)
    return ranked[0]?.value ?? 0
}

function extractStatementDate(text: string) {
    const lines = getLines(text)
    
    // Look for date in transaction-related lines first
    const transactionLine = lines.find(line => /\b(?:upi|debit|credit|withdrawal|deposit|transfer)\b/i.test(line))
    if (transactionLine) {
        const match = DATE_REGEX.exec(transactionLine)
        if (match?.[1]) return match[1]
    }
    
    // Then search top 15 lines
    const topText = lines.slice(0, 15).join('\n')
    const topMatch = DATE_REGEX.exec(topText)
    if (topMatch?.[1]) return topMatch[1]
    
    // Finally search full text
    return DATE_REGEX.exec(text)?.[1] ?? ''
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
    const lines = getLines(text)
    
    // Look in top 20 lines first (invoices have dates near top)
    const topText = lines.slice(0, 20).join('\n')
    const topMatch = DATE_REGEX.exec(topText)
    if (topMatch?.[1]) return topMatch[1]
    
    // Then search full text
    return DATE_REGEX.exec(text)?.[1] ?? ''
}

function extractByDocumentType(text: string, kind: DocumentKind, provider: ProviderKind): Partial<ExtractedFields> {
    // Use amount-specific normalization for amount extraction
    const amountText = normalizeOcrTextForAmount(text)
    // Use regular normalization for other fields
    const normalText = normalizeOcrText(text)
    
    switch (kind) {
        case 'bank_statement':
            return {
                transactionId: TXN_ID_REGEX.exec(normalText)?.[1] ?? '',
                upiId: UPI_ID_REGEX.exec(normalText)?.[1]?.toLowerCase() ?? '',
                amount: extractStatementAmount(amountText),
                merchantName: extractStatementMerchant(normalText),
                transactionDate: extractStatementDate(normalText),
            }
        case 'voucher':
            return {
                transactionId: TXN_ID_REGEX.exec(normalText)?.[1] ?? '',
                upiId: '',
                amount: extractVoucherAmount(amountText),
                merchantName: VOUCHER_MERCHANT_REGEX.exec(normalText)?.[1]?.trim() ?? '',
                transactionDate: extractVoucherDate(normalText),
            }
        case 'upi_receipt_failed':
        case 'upi_receipt_pending':
        case 'upi_receipt_success':
        case 'unknown':
        default: {
            const lines = getLines(normalText)
            
            // Try multiple date extraction strategies
            let extractedDate = ''
            
            console.log('[Date Extraction] Starting date extraction...')
            console.log('[Date Extraction] First 20 lines:', lines.slice(0, 20))
            
            // Strategy 1: DateTime with "on" (PhonePe format: "08:07 am on 28 Feb 2026")
            const dateTimeOnMatch = DATETIME_ON_REGEX.exec(normalText)
            if (dateTimeOnMatch?.[2]) {
                extractedDate = dateTimeOnMatch[2]
                console.log('[Date Extraction] Found via DATETIME_ON_REGEX:', extractedDate)
            }
            
            // Strategy 2: DateTime with comma (Paytm format: "12:48 AM, 13 Feb 2026")
            if (!extractedDate) {
                const dateTimeMatch = DATETIME_REGEX.exec(normalText)
                if (dateTimeMatch?.[2]) {
                    extractedDate = dateTimeMatch[2]
                    console.log('[Date Extraction] Found via DATETIME_REGEX:', extractedDate)
                }
            }
            
            // Strategy 3: Date only pattern (e.g., "13 Feb 2026")
            if (!extractedDate) {
                const dateOnlyMatch = DATE_ONLY_REGEX.exec(normalText)
                if (dateOnlyMatch?.[0]) {
                    extractedDate = dateOnlyMatch[0]
                    console.log('[Date Extraction] Found via DATE_ONLY_REGEX:', extractedDate)
                }
            }
            
            // Strategy 4: Search top 20 lines for standalone date
            if (!extractedDate) {
                const topText = lines.slice(0, 20).join('\n')
                const topDateMatch = DATE_REGEX.exec(topText)
                if (topDateMatch?.[1]) {
                    extractedDate = topDateMatch[1]
                    console.log('[Date Extraction] Found in top 20 lines:', extractedDate)
                }
            }
            
            // Strategy 5: Look for date near UPI Ref or Transaction ID
            if (!extractedDate) {
                const upiRefIndex = lines.findIndex(line => /upi\s*ref|transaction\s*id|utr/i.test(line))
                if (upiRefIndex !== -1) {
                    const contextLines = lines.slice(Math.max(0, upiRefIndex - 2), Math.min(lines.length, upiRefIndex + 3)).join('\n')
                    const contextDateMatch = DATE_REGEX.exec(contextLines)
                    if (contextDateMatch?.[1]) {
                        extractedDate = contextDateMatch[1]
                        console.log('[Date Extraction] Found near UPI Ref:', extractedDate)
                    }
                }
            }
            
            // Strategy 6: Full text search as last resort
            if (!extractedDate) {
                const fullDateMatch = DATE_REGEX.exec(normalText)
                if (fullDateMatch?.[1]) {
                    extractedDate = fullDateMatch[1]
                    console.log('[Date Extraction] Found in full text:', extractedDate)
                }
            }
            
            console.log('[Date Extraction] Final extracted date:', extractedDate)
            
            return {
                transactionId: extractTransactionId(normalText, provider),
                upiId: extractUpiId(normalText, provider),
                amount: extractReceiptAmount(amountText, provider),
                merchantName: extractProviderMerchant(normalText, provider),
                transactionDate: extractedDate,
            }
        }
    }
}

export function useFieldExtractor() {
    function extract(rawText: string, kind: DocumentKind = 'unknown', provider: ProviderKind = 'unknown_provider'): Partial<ExtractedFields> {
        const text = normalizeOcrText(rawText)
        return extractByDocumentType(text, kind, provider)
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
