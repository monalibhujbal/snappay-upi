import type {
    DocumentKind,
    ProviderKind,
    SemanticExtractionResult,
} from '~/types/transaction'

const PROMPT_TEMPLATE = `You are a highly reliable information extraction system specialized in financial transaction data from UPI payment receipts.

You will be given OCR-extracted text from a receipt image. The text may be noisy, partially incorrect, or unstructured.

Your task is to interpret the text semantically (like a human reader) and extract the correct transaction details.

----------------------------------------
CORE OBJECTIVE
----------------------------------------
Extract the primary transaction details accurately, even when:
- Formatting varies across apps (GPay, PhonePe, Paytm, etc.)
- Multiple numbers are present
- OCR errors exist

----------------------------------------
FIELDS TO EXTRACT
----------------------------------------
Return a JSON object with:
- amount: number (only the actual paid/sent amount)
- currency: string (default "INR" if ₹, Rs, INR present)
- receiver: string (merchant/person receiving money)
- transaction_id: string (UPI reference / txn ID)
- date: string (ISO format YYYY-MM-DD if possible)

----------------------------------------
REASONING RULES
----------------------------------------
1. AMOUNT SELECTION (CRITICAL)
   - Prioritize numbers associated with:
     "paid", "sent", "debited", "transferred"
   - Ignore:
     cashback, rewards, wallet balance, available balance
   - If multiple candidates exist:
     choose the most contextually relevant transaction amount

2. CONTEXTUAL UNDERSTANDING
   - Do NOT rely on fixed templates or positions
   - Use surrounding words and semantics to infer meaning
   - Handle variations like:
     "Paid ₹500", "₹500 sent", "Amount: 500 INR"

3. OCR ERROR HANDLING
   - Correct common OCR issues:
     "Rs." → INR
     "5OO" → 500 (letter O vs zero)
     extra spaces or broken words
   - Infer missing structure where possible

4. RECEIVER IDENTIFICATION
   - Extract entity following patterns like:
     "to <name>", "paid to <name>", "sent to <name>"
   - Prefer human-readable names over IDs

5. DATE NORMALIZATION
   - Convert formats like:
     12/02/2026 → 2026-02-12
     Feb 12, 2026 → 2026-02-12
   - If unclear, return raw string

6. TRANSACTION ID
   - Look for:
     "UPI Ref", "Txn ID", "Transaction ID", "Ref No"

----------------------------------------
OUTPUT FORMAT (STRICT)
----------------------------------------
- Return ONLY valid JSON
- No explanations, no extra text
- Use null for missing fields

----------------------------------------
CONFIDENCE HEURISTIC (IMPLICIT)
----------------------------------------
- Prefer high-certainty fields
- Avoid guessing when ambiguous
- If unsure, return null instead of incorrect data`

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
        .replace(/â‚¹|Ã¢â€šÂ¹/g, '₹')
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

function buildContext(text: string, index: number, radius = 48) {
    const left = Math.max(0, index - radius)
    const right = Math.min(text.length, index + radius)
    return text.slice(left, right).toLowerCase()
}

function parseAmount(raw: string) {
    const cleaned = raw
        .replace(/[₹,]/g, '')
        .replace(/\b(?:rs|inr)\b/gi, '')
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
        'phone',
        'mobile',
    ]

    for (const cue of positiveCues) {
        if (context.includes(cue)) score += cue.includes(' ') ? 4 : 2
    }

    for (const cue of negativeCues) {
        if (context.includes(cue)) score -= cue.includes(' ') ? 5 : 2
    }

    if (/₹|rs|inr/i.test(raw)) score += 10
    if (/^\s*(?:₹|rs)?\s*\d+(?:\.\d{1,2})?\s*$/i.test(raw)) score += 12

    return score
}

function extractAmount(text: string) {
    const normalized = normalizeText(text)
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

    const directLine = lines.find(line =>
        /^(paid to|sent to|to:|to )/i.test(line)
    )
    if (directLine) {
        return cleanEntity(directLine.replace(/^(paid to|sent to|to:|to )\s*/i, '')) || null
    }

    const match = normalizeText(text).match(/(?:paid to|sent to|to)\s+([A-Za-z0-9\s&.'-]{2,60})/i)
    return match?.[1] ? cleanEntity(match[1]) : null
}

function extractSender(text: string) {
    const lines = getLines(text)
    const directLine = lines.find(line => /^(from:|from )/i.test(line))
    if (directLine) {
        return cleanEntity(directLine.replace(/^(from:|from )\s*/i, '')) || null
    }

    const match = normalizeText(text).match(/from\s+([A-Za-z0-9\s&.'-]{2,60})/i)
    return match?.[1] ? cleanEntity(match[1]) : null
}

function extractTransactionId(text: string) {
    const patterns = [
        /(?:upi\s*ref(?:erence)?\s*(?:no|number)?|utr|rrn|txn\s*id|transaction\s*id|ref(?:erence)?\s*no)[:\s-]*([A-Za-z0-9_-]{8,30})/i,
        /\b(\d{10,20})\b/,
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

    const slashDate = compact.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/)
    if (slashDate) {
        const day = Number.parseInt(slashDate[1] ?? '', 10)
        const month = Number.parseInt(slashDate[2] ?? '', 10)
        const year = Number.parseInt(slashDate[3] ?? '', 10)
        const fullYear = year < 100 ? 2000 + year : year

        if (day && month && fullYear) {
            return `${fullYear.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
        }
    }

    const isoDate = compact.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (isoDate) return isoDate[0]

    return raw
}

function extractDate(text: string) {
    const normalized = normalizeText(text)
    const patterns = [
        /(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})/i,
        /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/,
        /(\d{4}-\d{2}-\d{2})/,
    ]

    for (const pattern of patterns) {
        const match = normalized.match(pattern)
        if (match?.[1]) return normalizeDate(match[1])
    }

    return null
}

function detectStatus(text: string, kind?: DocumentKind) {
    const lower = normalizeText(text).toLowerCase()
    if (kind === 'upi_receipt_failed' || /failed|declined|unsuccessful/.test(lower)) return 'failed'
    if (kind === 'upi_receipt_pending' || /pending|processing|awaiting/.test(lower)) return 'pending'
    if (/completed|successful|success/.test(lower)) return 'completed'
    return null
}

function detectCurrency(text: string) {
    return /₹|rs|inr/i.test(normalizeText(text)) ? 'INR' : null
}

function detectProvider(text: string, provider?: ProviderKind) {
    if (provider && provider !== 'unknown_provider') return provider

    const lower = normalizeText(text).toLowerCase()
    if (lower.includes('google pay') || lower.includes('g pay')) return 'gpay'
    if (lower.includes('phonepe')) return 'phonepe'
    if (lower.includes('paytm')) return 'paytm'
    if (lower.includes('upi')) return 'generic_upi'
    return null
}

let qaPipeline: any = null

export function useSemanticExtractor() {
    function buildPrompt(ocrText: string) {
        return `${PROMPT_TEMPLATE}

----------------------------------------
INPUT
----------------------------------------
${ocrText}`
    }

    async function extract(
        ocrText: string,
        options?: { provider?: ProviderKind; documentKind?: DocumentKind }
    ): Promise<SemanticExtractionResult> {
        const normalized = normalizeText(ocrText)
        
        // Initial heuristic extraction
        let aiAmount = extractAmount(normalized)
        let aiReceiver = extractReceiver(normalized)

        // WebAI QA with Transformers
        try {
            if (!qaPipeline && typeof window !== 'undefined') {
                const transformers = await import('@xenova/transformers')
                transformers.env.allowLocalModels = false
                transformers.env.useBrowserCache = true
                transformers.env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/'
                qaPipeline = await transformers.pipeline('question-answering', 'Xenova/distilbert-base-uncased-distilled-squad')
            }

            if (qaPipeline) {
                // Ask the QA model for amount
                const amountAns = await qaPipeline('What is the total amount paid?', normalized)
                if (amountAns && amountAns.score > 0.3) {
                    const cleanedAmount = parseAmount(amountAns.answer)
                    if (cleanedAmount) aiAmount = cleanedAmount; 
                }

                // Ask the QA model for receiver/merchant
                const receiverAns = await qaPipeline('Who is the receiver or merchant?', normalized)
                if (receiverAns && receiverAns.score > 0.3) {
                     const cleanedReceiver = cleanEntity(receiverAns.answer)
                     if (cleanedReceiver && cleanedReceiver.length > 2) aiReceiver = cleanedReceiver
                }
            }

        } catch (e) {
            console.warn('Transformer QA Failed:', e)
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
        }
    }

    return { buildPrompt, extract }
}
