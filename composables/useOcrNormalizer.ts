/**
 * useOcrNormalizer.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * World-class, single-source-of-truth for all OCR text normalization in
 * SnapPay UPI.  Every other composable that touches raw OCR output imports
 * from here so that fixes are applied consistently and only in one place.
 *
 * 100 % browser-compatible — no Node APIs, no extra npm packages.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const RUPEE = '\u20B9'

// ---------------------------------------------------------------------------
// Character-level OCR error correction
// ---------------------------------------------------------------------------

/**
 * Fix common OCR character confusions INSIDE number sequences only.
 * We purposely keep this surgical – we only swap characters when the
 * surrounding context strongly implies a digit is expected, so we do
 * not accidentally corrupt real letters.
 */
export function applyOcrCharFixes(text: string): string {
    return text
        // Pipe char that Tesseract mis-reads as 'l' or 'I' inside digit runs
        .replace(/(\d)[lI|](\d)/g, '$10$2')  // e.g. "3l4" → "304"
        // Letter O surrounded by digits
        .replace(/(\d)[oO](\d)/g, '$10$2')
        // Common amount OCR artefacts: "₹1,0OO" → "₹1,000"
        .replace(/([\d,])O(?=\d)/g, '$10')
        // S / 5 confusion inside numeric tokens that already contain digits
        .replace(/\b(\d+)S(\d*)\b/g, '$15$2')
        // B / 8 confusion
        .replace(/\b(\d+)B(\d*)\b/g, '$18$2')
        // Z / 2 confusion
        .replace(/\bZ(\d{2,})\b/g, '2$1')
        // Rupee symbol mojibake variants (add every known bad encoding here)
        .replace(/â‚¹|Ã¢â€šÂ¹|ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹|\u00e2\u0082\u00b9/g, RUPEE)
        // Smart quotes → straight quotes
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        // Pipe character used as table separator → 'I'
        .replace(/\|/g, 'I')
        // Zero-width space / non-breaking space
        .replace(/[\u200b\u00a0]/g, ' ')
}

// ---------------------------------------------------------------------------
// Core normalisation (general fields)
// ---------------------------------------------------------------------------

export function normalizeOcrText(rawText: string): string {
    return applyOcrCharFixes(rawText)
        .replace(/\r\n/g, '\n')
        // Collapsed letter-O in digit runs  (applied after char fixes)
        .replace(/(?<=\d)[oO](?=\d)/g, '0')
        // Standalone 'R' or 'Rs' before a number → canonical 'Rs'
        .replace(/\bRS(?=\s*\d)/gi, 'Rs')
        .replace(/\b(?:rs|rs\.|inr)\b/gi, 'Rs')
        // 'R' immediately before digits is highly likely the ₹ glyph
        .replace(/\bR(?=\s*\d{1,6}(?:\.\d{1,2})?\b)/g, RUPEE)
        // Collapse runs of spaces / tabs; keep single newlines
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{2,}/g, '\n')
        .trim()
}

// ---------------------------------------------------------------------------
// Amount-specific normalisation (tighter ₹ heuristics)
// ---------------------------------------------------------------------------

/**
 * Extended normalisation used only when scanning for amounts.
 *
 * The "2→₹" heuristic is a common pain-point: Tesseract confuses the ₹ glyph
 * with the digit 2 on dark-background receipts.  We apply it only when there
 * is a strong context signal, drastically reducing false conversions on dates
 * and transaction IDs.
 */
export function normalizeOcrTextForAmount(rawText: string): string {
    let text = normalizeOcrText(rawText)

    // ── Pattern 1: "2 " + 2-4 digits with amount-context on same/adjacent line
    // Examples: "2 41" → "₹ 41"   but NOT "2 2026" or "12 345"
    text = text.replace(/(?<!\d)\b2\s+(\d{2,4}(?:[,.][\d]+)?)\b/g, (match, digits, _offset, _src) => {
        const full = parseInt('2' + digits.replace(/[,.]/g, ''), 10)
        // Reject years 2000-2099
        if (full >= 2000 && full <= 2099) return match
        // Reject very large numbers (transaction IDs, account numbers)
        if (full > 9999) return match
        return `${RUPEE} ${digits}`
    })

    // ── Pattern 2: Line starts with "2" + exactly 2-3 digits
    // Apply only when the line also contains a currency keyword nearby
    text = text.replace(/^2(\d{2,3})\b/gm, (match, digits, _offset, src) => {
        const full = parseInt('2' + digits, 10)
        if (full >= 2000 && full <= 2099) return match  // year
        if (full > 2200) return match                    // likely ID / ref
        // Require a currency cue somewhere in the same 120-char window
        const windowStart = Math.max(0, (src as string).lastIndexOf('\n', 0) + 1)
        const windowEnd = Math.min((src as string).length, windowStart + 120)
        const window = (src as string).slice(windowStart, windowEnd)
        const hasCue = /₹|Rs|INR|amount|paid|payment|received|total/i.test(window)
        if (!hasCue) return match
        return `${RUPEE}${digits}`
    })

    return text
}

// ---------------------------------------------------------------------------
// Key-value structural parser
// ---------------------------------------------------------------------------

export interface KvPairs {
    amount?: string
    transactionId?: string
    upiId?: string
    merchantName?: string
    date?: string
    time?: string
    status?: string
    utr?: string
    rrn?: string
    note?: string
}

/**
 * Many payment receipts are structured as "Label: Value" or
 * "Label\nValue" pairs.  Parsing them structurally is far more reliable
 * than scanning the full text with regex.
 *
 * Returns a KvPairs object for fields we recognise. Empty string means we
 * found the key but the value was blank; undefined means key not found.
 */
export function extractFromKeyValuePairs(rawLines: string[]): KvPairs {
    const result: KvPairs = {}
    const lines = rawLines.map(l => l.trim()).filter(Boolean)

    // Normalised key → canonical field name
    const KEY_MAP: Record<string, keyof KvPairs> = {
        // Amount variations
        'amount': 'amount',
        'total amount': 'amount',
        'txn amount': 'amount',
        'transaction amount': 'amount',
        'paid amount': 'amount',
        'you paid': 'amount',
        // Transaction ID
        'transaction id': 'transactionId',
        'txn id': 'transactionId',
        'google transaction id': 'transactionId',
        'upi transaction id': 'transactionId',
        'ref no': 'transactionId',
        'reference no': 'transactionId',
        'reference number': 'transactionId',
        // UTR
        'utr': 'utr',
        'utr no': 'utr',
        'utn': 'utr',  // common OCR misread
        // RRN
        'rrn': 'rrn',
        // UPI ID
        'upi id': 'upiId',
        'vpa': 'upiId',
        'payer vpa': 'upiId',
        'payee vpa': 'upiId',
        // Merchant / receiver
        'paid to': 'merchantName',
        'sent to': 'merchantName',
        'to': 'merchantName',
        'receiver': 'merchantName',
        'merchant': 'merchantName',
        'beneficiary': 'merchantName',
        'pay to': 'merchantName',
        // Sender / from
        'from': 'note',   // store in note – caller can promote to sender
        'received from': 'note',
        'debited from': 'note',
        // Date / time
        'date': 'date',
        'transaction date': 'date',
        'date & time': 'date',
        'date and time': 'date',
        'time': 'time',
        // Status
        'status': 'status',
        'upi ref no': 'transactionId',
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!

        // ── Inline "Key: Value" pattern
        const colonIdx = line.indexOf(':')
        if (colonIdx > 1 && colonIdx < line.length - 1) {
            const rawKey = line.slice(0, colonIdx).trim().toLowerCase()
            const rawValue = line.slice(colonIdx + 1).trim()

            const field = KEY_MAP[rawKey]
            if (field && rawValue) {
                if (!result[field]) result[field] = rawValue
                continue
            }
        }

        // ── Standalone key line followed by value on next line
        const rawKey = line.toLowerCase()
        const field = KEY_MAP[rawKey]
        if (field && i + 1 < lines.length) {
            const nextLine = lines[i + 1]!.trim()
            // Next line should not itself look like a key
            const nextIsKey = Object.keys(KEY_MAP).some(k => nextLine.toLowerCase() === k)
            if (!nextIsKey && nextLine.length > 0) {
                if (!result[field]) result[field] = nextLine
                i++ // consume the value line
            }
        }
    }

    return result
}

// ---------------------------------------------------------------------------
// Amount parsing utility (shared)
// ---------------------------------------------------------------------------

/**
 * Parses a raw string token into a numeric INR amount.
 * Returns null if the string does not represent a plausible receipt amount.
 */
export function parseRupeeAmount(raw: string): number | null {
    const cleaned = raw
        .replace(new RegExp(RUPEE, 'g'), '')
        .replace(/\brs\.?|inr|mrp\b/gi, '')
        .replace(/(?<=\d)[oO](?=\d)/g, '0')
        .replace(/,/g, '')
        .trim()

    if (!cleaned || !/\d/.test(cleaned)) return null

    const amount = Number.parseFloat(cleaned)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 200_000) return null
    return amount
}

// ---------------------------------------------------------------------------
// Date normalisation
// ---------------------------------------------------------------------------

const MONTH_MAP: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    january: 1, february: 2, march: 3, april: 4, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
}

/**
 * Attempts to convert any recognized date string into ISO `YYYY-MM-DD`.
 * Returns the original string if we cannot parse it.
 */
export function normalizeDateString(raw: string | null | undefined): string | null {
    if (!raw) return null
    const s = raw.replace(/,/g, '').trim()

    // ── "13 Feb 2026" / "1 February 2026"
    const named = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/)
    if (named) {
        const d = +named[1]!
        const m = MONTH_MAP[named[2]!.slice(0, 3).toLowerCase()]
        let y = +named[3]!
        if (y < 100) y += y <= 30 ? 2000 : 1900
        if (d && m && y) {
            return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`
        }
    }

    // ── "DD/MM/YYYY" | "DD.MM.YYYY" | "DD-MM-YYYY"
    const slash = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/)
    if (slash) {
        const d = +slash[1]!, m = +slash[2]!
        let y = +slash[3]!
        if (y < 100) y += y <= 30 ? 2000 : 1900
        if (d <= 31 && m <= 12)
            return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`
    }

    // ── "YYYY-MM-DD" / "YYYY/MM/DD"
    const iso = s.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/)
    if (iso) return `${iso[1]}-${iso[2]!.padStart(2, '0')}-${iso[3]!.padStart(2, '0')}`

    return raw  // return original – caller can display as-is
}

// ---------------------------------------------------------------------------
// Text-quality helpers
// ---------------------------------------------------------------------------

/**
 * Rough estimate of how "receipty" a string is.
 * Higher = more likely to be a structured UPI receipt.
 */
export function receiptQualityScore(text: string): number {
    const lower = text.toLowerCase()
    let score = 0
    if (/₹|rs\.|inr/i.test(text)) score += 20
    if (/paid|received|debited|credited/i.test(lower)) score += 15
    if (/upi|transaction|utr|rrn/i.test(lower)) score += 10
    if (/gpay|google pay|phonepe|paytm/i.test(lower)) score += 10
    if (/\d{12,}/.test(text)) score += 8    // transaction / UTR number
    if (/@[a-z]{2,}/i.test(text)) score += 8  // UPI ID
    if (/\d{2}[\/.-]\d{2}[\/.-]\d{2,4}/.test(text)) score += 5  // date
    return score
}
