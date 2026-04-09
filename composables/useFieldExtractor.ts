import type { ExtractedFields } from '~/types/transaction'

const TXN_ID_REGEX = /\b(\d{12,15})\b/
const UPI_ID_REGEX = /([a-zA-Z0-9._-]+@[a-zA-Z]{2,})/i
const AMOUNT_REGEX = /(?:â‚¹|Rs\.?|INR|[Z2])?\s*([\d]{1,3}(?:,[\d]{3})*(?:\.\d{1,2})?)/i
const DATE_REGEX = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i
const MERCHANT_REGEX = /(?:paid\s+to|to|merchant)[:\s]+([A-Za-z0-9\s&.'-]{2,40}?)(?:\n|$|UPI|\d)/i

export function useFieldExtractor() {

    function extract(rawText: string): Partial<ExtractedFields> {
        const text = rawText.replace(/\r\n/g, '\n').trim()

        const txnMatch = TXN_ID_REGEX.exec(text)
        const upiMatch = UPI_ID_REGEX.exec(text)
        const amountMatch = AMOUNT_REGEX.exec(text)
        const dateMatch = DATE_REGEX.exec(text)
        const merchantMatch = MERCHANT_REGEX.exec(text)

        const rawAmount = amountMatch?.[1]?.replace(/,/g, '')
        const amount = rawAmount ? parseFloat(rawAmount) : 0

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
