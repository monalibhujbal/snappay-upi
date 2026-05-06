import type {
    DocumentKind,
    ProviderKind,
    SemanticExtractionResult,
} from '~/types/transaction'

const PROMPT_TEMPLATE = `You are a highly reliable information extraction system specialized in financial transaction data from UPI payment receipts.

You will be given OCR-extracted text from a receipt image. The text may be noisy, partially incorrect, or unstructured.

Your task is to interpret the text semantically (like a human reader) and extract the correct transaction details.`

const MONTHS: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
}

type AmountCandidate = {
    value: number
    raw: string
    index: number
    score: number
}

function normalizeText(text: string) {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/[|]/g, 'I')
        .replace(/Ã¢â€šÂ¹|ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹|â‚¹/g, '₹')
        // Smart "2" to "₹" conversion - only for clearly misread rupee symbols
        // Pattern 1: "2 " followed by 2-4 digits (e.g., "2 41" → "₹ 41")
        .replace(/(?<!\d)\b2\s+(\d{2,4}(?:[,\.]\d+)?)\b/g, '₹ $1')
        // Pattern 2: Line starts with "2" + 2-3 digits (e.g., "241" → "₹41")
        .replace(/^2(\d{2,3})\b/gm, (match, digits) => {
            const fullNum = parseInt('2' + digits, 10)
            if (fullNum >= 2000 && fullNum <= 2099) return match // Year
            if (fullNum > 2200) return match // Large number/ID
            return `₹${digits}`
        })
        .replace(/\bR(?=\s*\d)/g, '₹')
        .replace(/\bRS(?=\s*\d)/gi, 'Rs')
        .replace(/\b(?:rs|rs\.|inr)\b/gi, 'Rs')
        .replace(/(?<=\d)[oO](?=\d)/g, '0')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{2,}/g, '\n')
        .trim()
}

function getLines(text: string) {
    return normalizeText(text).split('\n').map(line => line.trim()).filter(Boolean)
}

function buildContext(text: string, index: number, radius = 28) {
    const left = Math.max(0, index - radius)
    const right = Math.min(text.length, index + radius)
    return text.slice(left, right).toLowerCase()
}

function parseAmount(raw: string) {
    const cleaned = raw
        .replace(/[₹,]/g, '')
        .replace(/\b(?:rs|inr)\b/gi, '')
        .replace(/(?<=\d)[oO](?=\d)/g, '0')
        .trim()

    const amount = Number.parseFloat(cleaned)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 200000) return null
    return amount
}

function looksLikeDateToken(value: string) {
    return /^(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})$/.test(value)
}

function looksLikeTimeToken(value: string) {
    return /^\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]m)?$/i.test(value)
}

function scoreAmountCandidate(text: string, raw: string, index: number) {
    let score = 0
    const context = buildContext(text, index)

    const positiveCues = [
        'amount',
        'paid',
        'sent',
        'received',
        'completed',
        'debited',
        'credited',
        'money received',
        'you paid',
        'payment',
        'paid successfully',
        'transaction successful',
    ]

    const negativeCues = [
        'balance',
        'cashback',
        'reward',
        'available balance',
        'opening balance',
        'closing balance',
        'transaction id',
        'upi transaction id',
        'google transaction id',
        'ref no',
        'mobile',
        'phone',
        'utr',
    ]

    for (const cue of positiveCues) {
        if (context.includes(cue)) score += cue.includes(' ') ? 4 : 2
    }

    for (const cue of negativeCues) {
        if (context.includes(cue)) score -= cue.includes(' ') ? 5 : 2
    }

    if (/₹|rs|inr/i.test(raw)) score += 12
    if (/^\s*(?:₹|rs)?\s*[\d,]+(?:\.\d{1,2})?\s*$/i.test(raw)) score += 14
    return score
}

function extractAmount(text: string) {
    const normalized = normalizeText(text)
    const lines = getLines(normalized)
    const candidates: AmountCandidate[] = []
    const seen = new Set<string>()
    const amountRegex = /(?:₹|rs\.?|inr)?\s*(\d{1,6}(?:,\d{2,3})*(?:\.\d{1,2})?|\d{1,6}(?:\.\d{1,2})?)/gi

    for (const match of normalized.matchAll(amountRegex)) {
        const raw = match[0]?.trim() ?? ''
        if (!raw) continue
        if (looksLikeDateToken(raw) || looksLikeTimeToken(raw)) continue

        const value = parseAmount(raw)
        if (value === null) continue

        const key = `${value}-${Math.floor((match.index ?? 0) / 8)}`
        if (seen.has(key)) continue
        seen.add(key)

        candidates.push({
            value,
            raw,
            index: match.index ?? 0,
            score: scoreAmountCandidate(normalized, raw, match.index ?? 0),
        })
    }

    for (const [lineIndex, line] of lines.slice(0, 10).entries()) {
        const trimmed = line.trim()
        // Prioritize standalone amount lines (just ₹XX format) - common in PhonePe
        if (/^(?:₹|rs\.?|inr)\s*\d+(?:,\d{2,3})*(?:\.\d{1,2})?$/i.test(trimmed)) {
            const match = trimmed.match(/(?:₹|rs\.?|inr)\s*[:\-]?\s*(\d{1,6}(?:,\d{2,3})*(?:\.\d{1,2})?)/i)
            if (match?.[0]) {
                const value = parseAmount(match[0])
                if (value !== null) {
                    candidates.push({
                        value,
                        raw: match[0],
                        index: normalized.indexOf(line),
                        score: 40 - lineIndex, // Higher score for standalone amounts
                    })
                }
            }
        } else {
            // Regular amount extraction
            const match = line.match(/(?:₹|rs\.?|inr)\s*[:\-]?\s*(\d{1,6}(?:,\d{2,3})*(?:\.\d{1,2})?)/i)
            if (!match?.[0]) continue
            const value = parseAmount(match[0])
            if (value === null) continue
            candidates.push({
                value,
                raw: match[0],
                index: normalized.indexOf(line),
                score: 32 - lineIndex,
            })
        }
    }

    return candidates.sort((a, b) => b.score - a.score)[0]?.value ?? null
}

function cleanEntity(value: string) {
    return value
        .replace(/\s{2,}/g, ' ')
        .replace(/\b(?:google pay|phonepe|paytm)\b.*$/i, '')
        .replace(/[|]/g, '')
        .trim()
}

function extractReceiver(text: string) {
    const lines = getLines(text)

    const standaloneIndex = lines.findIndex(line => /^(paid to|sent to|to:|to|transfer to)$/i.test(line))
    if (standaloneIndex !== -1) {
        const nextLine = lines[standaloneIndex + 1]
        if (nextLine) return cleanEntity(nextLine) || null
    }

    const directLine = lines.find(line => /^(paid to|sent to|to:|to )/i.test(line))
    if (directLine) return cleanEntity(directLine.replace(/^(paid to|sent to|to:|to )\s*/i, '')) || null

    const namePattern = /^([A-Z][A-Za-z\s]{2,50})$/
    for (const line of lines.slice(0, 10)) {
        if (namePattern.test(line) && !/phonepe|paytm|google pay|transaction|payment|debited|upi|rupees/i.test(line)) {
            return cleanEntity(line) || null
        }
    }

    const match = normalizeText(text).match(/(?:paid to|sent to|to)\s+([A-Za-z0-9\s&.'-]{2,60})/i)
    return match?.[1] ? cleanEntity(match[1]) : null
}

function extractSender(text: string) {
    const lines = getLines(text)
    
    const standaloneIndex = lines.findIndex(line => /^(from:|from|received from)$/i.test(line))
    if (standaloneIndex !== -1) {
        const nextLine = lines[standaloneIndex + 1]
        if (nextLine) return cleanEntity(nextLine) || null
    }
    
    const directLine = lines.find(line => /^(from:|from |received from )/i.test(line))
    if (directLine) return cleanEntity(directLine.replace(/^(from:|from |received from )\s*/i, '')) || null

    const namePattern = /^([A-Z][A-Za-z\s]{2,50})$/
    for (const line of lines.slice(0, 10)) {
        if (namePattern.test(line) && !/phonepe|paytm|google pay|transaction|payment|credited|upi|rupees/i.test(line)) {
            return cleanEntity(line) || null
        }
    }

    const match = normalizeText(text).match(/from\s+([A-Za-z0-9\s&.'-]{2,60})/i)
    return match?.[1] ? cleanEntity(match[1]) : null
}

function extractTransactionId(text: string) {
    const patterns = [
        /(?:upi\s*ref(?:erence)?\s*(?:no|number)?|utr|rrn|txn\s*id|transaction\s*id|ref(?:erence)?\s*no|google transaction id)[:\s-]*([A-Za-z0-9_-]{8,30})/i,
        /(?:upi\s*transaction\s*id)[:\s-]*([A-Za-z0-9]{10,30})/i,
        /\b(R\d{12,20})\b/,
        /\b(\d{12,20})\b/,
    ]

    for (const pattern of patterns) {
        const match = normalizeText(text).match(pattern)
        if (match?.[1]) return match[1]
    }

    return null
}

function normalizeDate(raw: string | null) {
    if (!raw) return null

    const compact = raw.replace(/,/g, '').trim()
    
    // Handle "13 Feb 2026" or "13 February 2026"
    const monthName = compact.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})/i)
    if (monthName) {
        const day = Number.parseInt(monthName[1] ?? '', 10)
        const month = MONTHS[(monthName[2] ?? '').slice(0, 3).toLowerCase()]
        const year = Number.parseInt(monthName[3] ?? '', 10)
        if (day && month && year) {
            const fullYear = year < 100 ? 2000 + year : year
            return `${fullYear.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
        }
    }

    // Handle "DD/MM/YYYY" or "DD-MM-YYYY" or "DD/MM/YY" or "DD.MM.YYYY"
    const slashDate = compact.match(/(\d{1,2})[\/.]\d{1,2}[\/.]\d{2,4}/)
    if (slashDate) {
        const parts = compact.split(/[\/.]/);
        const day = Number.parseInt(parts[0] ?? '', 10)
        const month = Number.parseInt(parts[1] ?? '', 10)
        const year = Number.parseInt(parts[2] ?? '', 10)
        const fullYear = year < 100 ? 2000 + year : year
        if (day && month && fullYear) {
            return `${fullYear.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
        }
    }

    // Handle "YYYY-MM-DD" (ISO format)
    const isoDate = compact.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (isoDate) return isoDate[0]
    
    return raw
}

function extractDate(text: string) {
    const normalized = normalizeText(text)
    const lines = getLines(normalized)
    
    console.log('[Semantic Date] Starting semantic date extraction...')
    console.log('[Semantic Date] First 20 lines:', lines.slice(0, 20))
    
    // Strategy 1: PhonePe format - "08:07 am on 28 Feb 2026"
    const dateTimeOnPattern = /(\d{1,2}:\d{2}\s*(?:am|pm))\s+on\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i
    const dateTimeOnMatch = normalized.match(dateTimeOnPattern)
    if (dateTimeOnMatch?.[2]) {
        console.log('[Semantic Date] Found PhonePe format:', dateTimeOnMatch[2])
        return normalizeDate(dateTimeOnMatch[2])
    }
    
    // Strategy 2: Paytm format - "12:48 AM, 13 Feb 2026"
    const dateTimePattern = /(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)[,\s]+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,\s]+\d{2,4})/i
    const dateTimeMatch = normalized.match(dateTimePattern)
    if (dateTimeMatch?.[2]) {
        console.log('[Semantic Date] Found Paytm format:', dateTimeMatch[2])
        return normalizeDate(dateTimeMatch[2])
    }
    
    // Strategy 3: Date only - "13 Feb 2026"
    const dateOnlyPattern = /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i
    const dateOnlyMatch = normalized.match(dateOnlyPattern)
    if (dateOnlyMatch?.[0]) {
        console.log('[Semantic Date] Found date only format:', dateOnlyMatch[0])
        return normalizeDate(dateOnlyMatch[0])
    }
    
    // Strategy 4: Try patterns in order of specificity
    const patterns = [
        /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,\s]+\d{2,4})/i,
        /(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4})/,
        /(\d{4}[\/-]\d{2}[\/-]\d{2})/,
    ]

    // First try to find date in top 20 lines (where dates usually appear)
    const topText = lines.slice(0, 20).join('\n')
    for (const pattern of patterns) {
        const match = topText.match(pattern)
        if (match?.[1]) {
            console.log('[Semantic Date] Found in top 20 lines:', match[1])
            return normalizeDate(match[1])
        }
    }
    
    // Then try full text
    for (const pattern of patterns) {
        const match = normalized.match(pattern)
        if (match?.[1]) {
            console.log('[Semantic Date] Found in full text:', match[1])
            return normalizeDate(match[1])
        }
    }

    console.log('[Semantic Date] No date found')
    return null
}

function detectStatus(text: string, kind?: DocumentKind): 'completed' | 'failed' | 'pending' | null {
    const lower = normalizeText(text).toLowerCase()
    if (kind === 'upi_receipt_failed' || /failed|declined|unsuccessful/.test(lower)) return 'failed'
    if (kind === 'upi_receipt_pending' || /pending|processing|awaiting/.test(lower)) return 'pending'
    if (/completed|successful|success|paid successfully/.test(lower)) return 'completed'
    return null
}

function detectDirection(text: string, kind?: DocumentKind): 'sent' | 'received' | 'unknown' | null {
    const lower = normalizeText(text).toLowerCase()
    if (kind === 'upi_receipt_failed' || kind === 'upi_receipt_pending') return 'unknown'

    const sentPhrases = [
        'paid to',
        'sent to',
        'debited from',
        'you paid',
        'paid successfully',
        'transaction successful',
        'transfer to',
    ]

    const receivedPhrases = [
        'received from',
        'money received',
        'credited to',
        'credited in',
        'you received',
        'collected from',
    ]

    let sentScore = sentPhrases.filter(phrase => lower.includes(phrase)).length
    let receivedScore = receivedPhrases.filter(phrase => lower.includes(phrase)).length

    if (/(^|\n)\s*to\s*:/.test(lower) && /(^|\n)\s*from\s*:/.test(lower)) sentScore += 3
    if (/(^|\n)\s*paid to\b/.test(lower)) sentScore += 4
    if (/(^|\n)\s*received from\b/.test(lower)) receivedScore += 4
    if (/(^|\n)\s*money received\b/.test(lower)) receivedScore += 5

    if (sentScore > receivedScore) return 'sent'
    if (receivedScore > sentScore) return 'received'
    return sentScore || receivedScore ? 'unknown' : null
}

function detectCurrency(text: string) {
    return /₹|rs|inr/i.test(normalizeText(text)) ? 'INR' : null
}

function detectProvider(text: string, provider?: ProviderKind): ProviderKind | null {
    if (provider && provider !== 'unknown_provider') return provider

    const lower = normalizeText(text).toLowerCase()
    if (lower.includes('google pay') || lower.includes('g pay')) return 'gpay'
    if (lower.includes('phonepe')) return 'phonepe'
    if (lower.includes('paytm')) return 'paytm'
    if (lower.includes('upi')) return 'generic_upi'
    return null
}

let qaPipeline: any = null
let qaPipelineFailed = false

export function useSemanticExtractor() {
    function buildPrompt(ocrText: string) {
        return `${PROMPT_TEMPLATE}\n\nINPUT\n${ocrText}`
    }

    async function extract(
        ocrText: string,
        options?: { provider?: ProviderKind; documentKind?: DocumentKind }
    ): Promise<SemanticExtractionResult> {
        const normalized = normalizeText(ocrText)

        let aiAmount = extractAmount(normalized)
        let aiReceiver = extractReceiver(normalized)

        try {
            if (!qaPipeline && typeof window !== 'undefined' && !qaPipelineFailed && (!aiAmount || !aiReceiver)) {
                const transformers = await import('@xenova/transformers')
                transformers.env.allowLocalModels = false
                transformers.env.useBrowserCache = true
                transformers.env.backends.onnx.wasm.numThreads = 1
                transformers.env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/'
                qaPipeline = await transformers.pipeline('question-answering', 'Xenova/distilbert-base-uncased-distilled-squad')
            }

            if (qaPipeline) {
                if (!aiAmount) {
                    const amountAns = await qaPipeline('What is the main transaction amount?', normalized)
                    if (amountAns && amountAns.score > 0.3) {
                        const cleanedAmount = parseAmount(amountAns.answer)
                        if (cleanedAmount) aiAmount = cleanedAmount
                    }
                }

                if (!aiReceiver) {
                    const receiverAns = await qaPipeline('Who received the money?', normalized)
                    if (receiverAns && receiverAns.score > 0.3) {
                        const cleanedReceiver = cleanEntity(receiverAns.answer)
                        if (cleanedReceiver && cleanedReceiver.length > 2) aiReceiver = cleanedReceiver
                    }
                }
            }
        } catch (e: any) {
            qaPipelineFailed = true
            console.warn(`[Local AI] Transformer QA model unavailable in this environment: ${e.message}`)
        }

        return {
            amount: aiAmount,
            currency: detectCurrency(normalized),
            receiver: aiReceiver,
            sender: extractSender(normalized),
            transaction_id: extractTransactionId(normalized),
            date: extractDate(normalized),
            status: detectStatus(normalized, options?.documentKind),
            provider: detectProvider(normalized, options?.provider),
            direction: detectDirection(normalized, options?.documentKind),
        }
    }

    return { buildPrompt, extract }
}
