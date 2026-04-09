export type TransactionStatus =
    | 'pending'
    | 'verified'
    | 'failed'
    | 'flagged'

export type DocumentKind =
    | 'upi_receipt_success'
    | 'upi_receipt_failed'
    | 'upi_receipt_pending'
    | 'bank_statement'
    | 'voucher'
    | 'unknown'

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
