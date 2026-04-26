/**
 * useSemanticExtractor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Semantic / AI-augmented field extraction for UPI receipts.
 *
 * Pipeline:
 *   1. Normalise text via shared useOcrNormalizer
 *   2. Run structural KV-pair parser (free, instant, high accuracy)
 *   3. Apply rule-based NLP extractors for remaining fields
 *   4. Optionally run Xenova/distilbert QA pipeline for any field still missing
 *
 * 100 % browser-compatible, zero new package dependencies.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { DocumentKind, ProviderKind, SemanticExtractionResult } from '~/types/transaction'
import {
    normalizeOcrText,
    normalizeOcrTextForAmount,
    extractFromKeyValuePairs,
    parseRupeeAmount,
    normalizeDateString,
} from '~/composables/useOcrNormalizer'

// ─── Singleton AI pipeline ─────────────────────────────────────────────────
let qaPipeline: any = null
let qaPipelineFailed = false

// ─── Internal utilities ────────────────────────────────────────────────────

function getLines(text: string): string[] {
    return text.split('\n').map(l => l.trim()).filter(Boolean)
}

function buildContext(text: string, index: number, radius = 32): string {
    const left = Math.max(0, index - radius)
    const right = Math.min(text.length, index + radius)
    return text.slice(left, right).toLowerCase()
}

function cleanEntity(value: string): string {
    return value
        .replace(/\s{2,}/g, ' ')
        .replace(/\b(?:google pay|phonepe|paytm|gpay|g pay|upi|bank|ltd|pvt|limited)\b.*$/i, '')
        .replace(/[₹₨]\s*\d+/g, '')
        .replace(/\s+[₹₨]?\d+$/g, '')
        .replace(/\+?\d{10,}/g, '')
        .replace(/[|]/g, '')
        .trim()
}

// ─── Amount extraction ─────────────────────────────────────────────────────

const POSITIVE_CUES = [
    'amount', 'paid', 'sent', 'received', 'completed', 'debited', 'credited',
    'money received', 'you paid', 'payment', 'paid successfully', 'transaction successful',
]

const NEGATIVE_CUES = [
    'balance', 'cashback', 'reward', 'available balance', 'opening balance',
    'closing balance', 'transaction id', 'upi transaction id', 'google transaction id',
    'ref no', 'mobile', 'phone', 'utr', 'rrn',
]

// Lines that almost never contain the actual transaction amount
const AMOUNT_SUPPRESS_RE = /\b(utr|rrn|ref(?:erence)?|transaction id|balance|account|mobile|phone)\b/i

function extractAmount(text: string): number | null {
    const normalized = normalizeOcrTextForAmount(text)
    const lines = getLines(normalized)

    type Candidate = { value: number; raw: string; index: number; score: number }
    const candidates: Candidate[] = []
    const seen = new Set<string>()
    const amountRe = /(?:₹|rs\.?|inr)?[\s]*(\d{1,6}(?:,\d{2,3})*(?:\.\d{1,2})?|\d{1,6}(?:\.\d{1,2})?)/gi

    for (const m of normalized.matchAll(amountRe)) {
        const raw = m[0]?.trim() ?? ''
        if (!raw) continue

        const value = parseRupeeAmount(raw)
        if (value === null) continue

        // Suppress results on known non-amount lines
        const lineIdx = lines.findIndex(l => l.includes(m[0]?.trim() ?? ''))
        const lineText = lines[lineIdx] ?? ''
        if (AMOUNT_SUPPRESS_RE.test(lineText)) continue

        const key = `${value}-${Math.floor((m.index ?? 0) / 8)}`
        if (seen.has(key)) continue
        seen.add(key)

        // Score the candidate
        let score = 0
        const ctx = buildContext(normalized, m.index ?? 0)
        for (const cue of POSITIVE_CUES) if (ctx.includes(cue)) score += cue.includes(' ') ? 4 : 2
        for (const cue of NEGATIVE_CUES) if (ctx.includes(cue)) score -= cue.includes(' ') ? 5 : 2
        if (/₹|rs|inr/i.test(raw)) score += 12
        if (/^\s*(?:₹|rs)?\s*[\d,]+(?:\.\d{1,2})?\s*$/i.test(raw)) score += 14

        candidates.push({ value, raw, index: m.index ?? 0, score })
    }

    // Explicit pass: standalone currency lines in top-10 get big boost
    for (const [i, line] of lines.slice(0, 10).entries()) {
        if (/^(?:₹|rs\.?|inr)\s*\d[\d,]*(?:\.\d{1,2})?$/i.test(line)) {
            const m = line.match(/(?:₹|rs\.?|inr)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/i)
            if (m?.[1]) {
                const value = parseRupeeAmount(m[1])
                if (value !== null) {
                    candidates.push({ value, raw: m[1], index: normalized.indexOf(line), score: 40 - i })
                }
            }
        } else {
            const m = line.match(/(?:₹|rs\.?|inr)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/i)
            if (m?.[1]) {
                const value = parseRupeeAmount(m[1])
                if (value !== null)
                    candidates.push({ value, raw: m[1], index: normalized.indexOf(line), score: 28 - i })
            }
        }
    }

    return candidates.sort((a, b) => b.score - a.score)[0]?.value ?? null
}

// ─── Receiver / sender extraction ─────────────────────────────────────────

function extractReceiver(text: string): string | null {
    const lines = getLines(text)

    // Standalone label → next line value
    const sIdx = lines.findIndex(l => /^(paid to|sent to|to:|to|transfer to)$/i.test(l))
    if (sIdx !== -1) {
        const next = lines[sIdx + 1]
        if (next) return cleanEntity(next) || null
    }

    // Inline "paid to XYZ"
    const direct = lines.find(l => /^(paid to|sent to|to:|to )/i.test(l))
    if (direct) return cleanEntity(direct.replace(/^(paid to|sent to|to:|to )\s*/i, '')) || null

    // Capitalized proper name in first 10 lines
    const nameRe = /^([A-Z][A-Za-z\s]{2,50})$/
    for (const line of lines.slice(0, 10)) {
        if (nameRe.test(line) && !/phonepe|paytm|google pay|transaction|payment|debited|upi|rupees/i.test(line))
            return cleanEntity(line) || null
    }

    const m = text.match(/(?:paid to|sent to|to)\s+([A-Za-z0-9\s&.'\-]{2,60})/i)
    return m?.[1] ? cleanEntity(m[1]) : null
}

function extractSender(text: string): string | null {
    const lines = getLines(text)

    const sIdx = lines.findIndex(l => /^(from:|from|received from)$/i.test(l))
    if (sIdx !== -1) {
        const next = lines[sIdx + 1]
        if (next) return cleanEntity(next) || null
    }

    const direct = lines.find(l => /^(from:|from |received from )/i.test(l))
    if (direct) return cleanEntity(direct.replace(/^(from:|from |received from )\s*/i, '')) || null

    const nameRe = /^([A-Z][A-Za-z\s]{2,50})$/
    for (const line of lines.slice(0, 10)) {
        if (nameRe.test(line) && !/phonepe|paytm|google pay|transaction|payment|credited|upi|rupees/i.test(line))
            return cleanEntity(line) || null
    }

    const m = text.match(/from\s+([A-Za-z0-9\s&.'\-]{2,60})/i)
    return m?.[1] ? cleanEntity(m[1]) : null
}

// ─── Transaction ID extraction ─────────────────────────────────────────────

function extractTransactionId(text: string): string | null {
    const patterns = [
        /(?:upi\s*ref(?:erence)?\s*(?:no|number)?|utr|rrn|txn\s*id|transaction\s*id|ref(?:erence)?\s*no|google transaction id)\s*:?\s*([A-Za-z0-9_\-]{8,30})/i,
        /(?:upi\s*transaction\s*id)\s*:?\s*([A-Za-z0-9]{10,30})/i,
        /\b(R\d{12,20})\b/,
        /\b(T\d{23})\b/,
        /\b(\d{12,20})\b/,
    ]
    for (const re of patterns) {
        const m = text.match(re)
        if (m?.[1]) return m[1]
    }
    return null
}

// ─── Date extraction ───────────────────────────────────────────────────────

function extractDate(text: string): string | null {
    // Strategy 1: "08:07 am on 28 Feb 2026"
    const m1 = text.match(/([\d]{1,2}:[\d]{2}\s*(?:am|pm))\s+on\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i)
    if (m1?.[2]) return normalizeDateString(m1[2])

    // Strategy 2: "12:48 AM, 13 Feb 2026"
    const m2 = text.match(/([\d]{1,2}:[\d]{2}(?::[\d]{2})?\s*(?:am|pm)?)[,\s]+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,\s]+\d{2,4})/i)
    if (m2?.[2]) return normalizeDateString(m2[2])

    // Strategy 3: Date only "13 Feb 2026"
    const m3 = text.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i)
    if (m3?.[0]) return normalizeDateString(m3[0])

    // Strategy 4: Top-20 lines then full text
    const lines = getLines(text)
    const top = lines.slice(0, 20).join('\n')
    for (const re of [
        /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,\s]+\d{2,4})/i,
        /(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/,
        /(\d{4}[\/\-]\d{2}[\/\-]\d{2})/,
    ]) {
        const m = top.match(re) ?? text.match(re)
        if (m?.[1]) return normalizeDateString(m[1])
    }

    return null
}

// ─── Presence detectors ────────────────────────────────────────────────────

function detectStatus(text: string, kind?: DocumentKind): 'completed' | 'failed' | 'pending' | null {
    const lower = text.toLowerCase()
    if (kind === 'upi_receipt_failed' || /failed|declined|unsuccessful/.test(lower)) return 'failed'
    if (kind === 'upi_receipt_pending' || /pending|processing|awaiting/.test(lower)) return 'pending'
    if (/completed|successful|success|paid successfully/.test(lower)) return 'completed'
    return null
}

function detectDirection(text: string, kind?: DocumentKind): 'sent' | 'received' | 'unknown' | null {
    const lower = text.toLowerCase()
    if (kind === 'upi_receipt_failed' || kind === 'upi_receipt_pending') return 'unknown'

    const sent = ['paid to', 'sent to', 'debited from', 'you paid', 'paid successfully', 'transaction successful', 'transfer to']
    const recv = ['received from', 'money received', 'credited to', 'credited in', 'you received', 'collected from']

    let s = sent.filter(p => lower.includes(p)).length
    let r = recv.filter(p => lower.includes(p)).length

    if (/(^|\n)\s*to\s*:/.test(lower) && /(^|\n)\s*from\s*:/.test(lower)) s += 3
    if (/(^|\n)\s*paid to\b/.test(lower)) s += 4
    if (/(^|\n)\s*received from\b/.test(lower)) r += 4
    if (/(^|\n)\s*money received\b/.test(lower)) r += 5

    if (s > r) return 'sent'
    if (r > s) return 'received'
    return s || r ? 'unknown' : null
}

function detectCurrency(text: string): string | null {
    return /₹|rs|inr/i.test(text) ? 'INR' : null
}

function detectProvider(text: string, provider?: ProviderKind): ProviderKind | null {
    if (provider && provider !== 'unknown_provider') return provider
    const lower = text.toLowerCase()
    if (lower.includes('google pay') || lower.includes('g pay')) return 'gpay'
    if (lower.includes('phonepe')) return 'phonepe'
    if (lower.includes('paytm')) return 'paytm'
    if (lower.includes('upi')) return 'generic_upi'
    return null
}

// ─── Public composable ─────────────────────────────────────────────────────

export function useSemanticExtractor() {
    function buildPrompt(ocrText: string): string {
        return `You are a highly reliable information extraction system specialized in financial transaction data from UPI payment receipts.\n\nYou will be given OCR-extracted text from a receipt image. The text may be noisy, partially incorrect, or unstructured.\n\nYour task is to interpret the text semantically (like a human reader) and extract the correct transaction details.\n\nINPUT\n${ocrText}`
    }

    async function extract(
        ocrText: string,
        options?: { provider?: ProviderKind; documentKind?: DocumentKind }
    ): Promise<SemanticExtractionResult> {
        const normalized = normalizeOcrText(ocrText)

        // ── 1. Structural KV parse (instant, high accuracy)
        const kv = extractFromKeyValuePairs(getLines(normalized))

        // ── 2. Rule-based NLP  
        let aiAmount:    number | null  = kv.amount ? parseRupeeAmount(kv.amount) : extractAmount(normalized)
        
        let aiReceiver: string | null = kv.merchantName ? cleanEntity(kv.merchantName) : null
        if (!aiReceiver) aiReceiver = extractReceiver(normalized)

        let aiSender: string | null = kv.note ? cleanEntity(kv.note) : null
        if (!aiSender) aiSender = extractSender(normalized)

        let aiTxnId:     string | null  = kv.transactionId ?? kv.utr ?? kv.rrn ?? extractTransactionId(normalized)
        let aiDate:      string | null  = kv.date ? normalizeDateString(kv.date) : extractDate(normalized)

        // ── 3. Xenova QA pipeline for any field still missing
        try {
            const needsAI = !aiAmount || !aiReceiver
            if (needsAI && !qaPipeline && typeof window !== 'undefined' && !qaPipelineFailed) {
                const t = await import('@xenova/transformers')
                t.env.allowLocalModels = false
                t.env.useBrowserCache = true
                t.env.backends.onnx.wasm.numThreads = 1
                t.env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/'
                qaPipeline = await t.pipeline('question-answering', 'Xenova/distilbert-base-uncased-distilled-squad')
            }

            if (qaPipeline) {
                if (!aiAmount) {
                    const ans = await qaPipeline('What is the main transaction amount paid or received?', normalized)
                    if (ans?.score > 0.25) {
                        const v = parseRupeeAmount(ans.answer)
                        if (v) aiAmount = v
                    }
                }
                if (!aiReceiver) {
                    const ans = await qaPipeline('Who received the payment or who was paid?', normalized)
                    if (ans?.score > 0.25) {
                        const cleaned = cleanEntity(ans.answer)
                        if (cleaned && cleaned.length > 2) aiReceiver = cleaned
                    }
                }
                if (!aiDate) {
                    const ans = await qaPipeline('What is the date of the transaction?', normalized)
                    if (ans?.score > 0.3) {
                        const d = normalizeDateString(ans.answer)
                        if (d) aiDate = d
                    }
                }
            }
        } catch (e: any) {
            qaPipelineFailed = true
            console.warn(`[SemanticExtractor] Transformer QA unavailable: ${e.message}`)
        }

        return {
            amount:         aiAmount,
            currency:       detectCurrency(normalized),
            receiver:       aiReceiver,
            sender:         aiSender,
            transaction_id: aiTxnId,
            date:           aiDate,
            status:         detectStatus(normalized, options?.documentKind),
            provider:       detectProvider(normalized, options?.provider),
            direction:      detectDirection(normalized, options?.documentKind),
        }
    }

    return { buildPrompt, extract }
}
