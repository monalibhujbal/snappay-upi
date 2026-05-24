/**
 * useBankStatementVerifier
 *
 * Parses a bank-statement PDF on the client side (using pdfjs-dist) and
 * checks whether the supplied UPI transaction details appear in the text.
 *
 * Returns:
 *   verifyStatement(file, fields) → Promise<VerificationResult>
 *   isVerifying  – reactive boolean
 */

import { ref } from 'vue'

export interface StatementVerificationFields {
  transactionId?: string
  amount?: number
  transactionDate?: string
  merchantName?: string
  upiId?: string
}

export type VerificationResult =
  | { found: true;  matchedOn: string[] }
  | { found: false; reason: string }

export function useBankStatementVerifier() {
  const isVerifying = ref(false)

  /**
   * Extract all text from every page of the PDF file.
   */
  async function extractPdfText(file: File): Promise<string> {
    // Dynamically import to keep the bundle lean and avoid SSR issues.
    const pdfjsLib = await import('pdfjs-dist')

    // Point the worker at the bundled worker file shipped with pdfjs-dist.
    // Using a CDN URL avoids Vite/Nuxt worker-bundling quirks.
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
    }

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    const pageTexts: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ')
      pageTexts.push(pageText)
    }

    return pageTexts.join('\n')
  }

  /**
   * Normalise a string for loose matching (lowercase, collapse spaces).
   */
  function normalise(s: string): string {
    return s.toLowerCase().replace(/\s+/g, ' ').trim()
  }

  /**
   * Check whether an amount string in the PDF text matches the given number.
   * Handles Indian formatting like "1,500.00", "1500", "₹1500", etc.
   */
  function amountMatch(text: string, amount: number): boolean {
    if (!amount || amount <= 0) return false

    // Build several representations of the amount
    const plain = amount.toFixed(2)          // "1500.00"
    const noDecimal = String(Math.round(amount)) // "1500"

    // Indian comma-formatted: 1,500.00 / 1,500
    const formatted = amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const formattedNoDecimal = amount.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })

    const candidates = [plain, noDecimal, formatted, formattedNoDecimal]
    return candidates.some(c => text.includes(c))
  }

  /**
   * Main entry point. Returns a structured result.
   */
  async function verifyStatement(
    file: File,
    fields: StatementVerificationFields
  ): Promise<VerificationResult> {
    isVerifying.value = true
    try {
      const raw = await extractPdfText(file)
      const text = normalise(raw)

      const matchedOn: string[] = []

      // 1. Transaction ID — strong signal
      if (fields.transactionId && fields.transactionId.length > 4) {
        if (text.includes(normalise(fields.transactionId))) {
          matchedOn.push('Transaction ID')
        }
      }

      // 2. Amount — medium signal
      if (fields.amount && amountMatch(text, fields.amount)) {
        matchedOn.push('Amount')
      }

      // 3. Date — medium signal; try a few format variants
      if (fields.transactionDate) {
        const d = normalise(fields.transactionDate)
        // Try raw string and parts of it
        const dateParts = d.split(/[\s\-/,]+/).filter(p => p.length > 1)
        const dateFound =
          text.includes(d) ||
          (dateParts.length >= 2 && dateParts.every(p => text.includes(p)))
        if (dateFound) matchedOn.push('Date')
      }

      // 4. UPI ID (partial match is fine — bank statements sometimes truncate)
      if (fields.upiId && fields.upiId.length > 4) {
        const upiNorm = normalise(fields.upiId)
        // Try the full UPI id and also just the handle part (after @)
        const parts = upiNorm.split('@')
        const upiFound =
          text.includes(upiNorm) ||
          (parts.length === 2 && parts[1] && text.includes(parts[0])) 
        if (upiFound) matchedOn.push('UPI ID')
      }

      // 5. Merchant / receiver name
      if (fields.merchantName && fields.merchantName.length > 2) {
        const mNorm = normalise(fields.merchantName)
        // Accept if at least one word (≥3 chars) of the name is present
        const words = mNorm.split(/\s+/).filter(w => w.length >= 3)
        if (words.length > 0 && words.some(w => text.includes(w))) {
          matchedOn.push('Merchant name')
        }
      }

      // ── Decision logic ────────────────────────────────────────────────────
      // We consider a transaction "found" if:
      //   • Transaction ID matched (alone is sufficient), OR
      //   • At least 2 other signals matched (amount + date, amount + name, etc.)

      const hasId = matchedOn.includes('Transaction ID')
      const nonIdMatches = matchedOn.filter(m => m !== 'Transaction ID')

      if (hasId || nonIdMatches.length >= 2) {
        return { found: true, matchedOn }
      }

      return {
        found: false,
        reason:
          matchedOn.length === 0
            ? 'No matching details were found in the statement.'
            : `Only ${matchedOn.join(' and ')} matched — not enough to confirm.`,
      }
    } catch (err: any) {
      return {
        found: false,
        reason: err?.message ?? 'Failed to read the PDF. Please try again.',
      }
    } finally {
      isVerifying.value = false
    }
  }

  return { verifyStatement, isVerifying }
}
