export type TransactionStatus =
    | 'pending'
    | 'verified'
    | 'verified_manual'
    | 'failed'
    | 'flagged'

export type DocumentKind =
    | 'upi_receipt_success'
    | 'upi_receipt_failed'
    | 'upi_receipt_pending'
    | 'bank_statement'
    | 'voucher'
    | 'unknown'

export type ProviderKind =
    | 'gpay'
    | 'phonepe'
    | 'paytm'
    | 'generic_upi'
    | 'unknown_provider'

export interface UpiTransaction {
    id?: string
    userId: string
    createdAt: number

    transactionId: string
    upiId: string
    amount: number
    merchantName: string
    transactionDate: string
    direction: 'sent' | 'received'

    status: TransactionStatus
    ocrRawText: string
    ocrConfidence: number
    nlpLabel: string
    nlpScore: number
    imageUrl?: string

    ownerVerifiedMode?: 'auto' | 'manual'
    statementUrl?: string
}

export interface OcrResult {
    text: string
    confidence: number
}

export interface ExtractedFields {
    transactionId: string
    upiId: string
    amount: number
    merchantName: string
    transactionDate: string
}

export interface SemanticExtractionResult {
    amount: number | null
    currency: string | null
    receiver: string | null
    sender: string | null
    transaction_id: string | null
    date: string | null
    status: string | null
    provider: string | null
    direction: 'sent' | 'received' | 'unknown' | null
}
