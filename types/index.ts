export interface Transaction {
  id?:                string
  userId:             string
  upiId:              string
  amount:             number
  merchantName:       string
  transactionId:      string
  timestamp:          Date | null
  status:             'success' | 'failed' | 'pending'
  verificationStatus: 'verified' | 'suspicious' | 'duplicate' | 'unverified'
  rawText?:           string
  imageUrl?:          string
  createdAt:          Date
}

export interface ToastMessage {
  id:      string
  type:    'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}