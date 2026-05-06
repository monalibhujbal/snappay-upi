# PhonePe Receipt Extraction Fixes

## Issues Identified & Fixed

### 1. **Transaction ID Extraction** ✅ FIXED
**Problem**: The system wasn't properly extracting the UTR number from PhonePe receipts.
- PhonePe receipts show: `UTR: 282757588580` (12 digits)
- This is the bank reference number that should be stored as the transaction ID

**Solution**: Updated `extractTransactionId()` in `useFieldExtractor.ts` to:
1. First look for "UTR:" or "UTR " followed by 12 digits
2. Then look for standalone 12-digit number near "UTR" keyword
3. Fall back to any 12-digit number found in the receipt

**Files Modified**:
- `composables/useFieldExtractor.ts` (lines 484-502)

### 2. **UPI ID Extraction** ✅ FIXED
**Problem**: The system wasn't properly extracting masked UPI IDs like `****8011@idbi`.
- PhonePe shows masked UPI IDs: `****8011@idbi` or similar patterns
- System was only looking for standard UPI format or phone numbers

**Solution**: Updated `extractUpiId()` in `useFieldExtractor.ts` to:
1. First try standard UPI ID format (xxx@yyy)
2. For PhonePe, look for masked UPI patterns: `*+digits@bank`
3. Extract the visible digits and bank name
4. Fall back to phone number extraction

**Files Modified**:
- `composables/useFieldExtractor.ts` (lines 460-479)

### 3. **Merchant Name Extraction** ✅ IMPROVED
**Problem**: Merchant name extraction could miss inline "Paid to" patterns where the name and amount appear on the same line.
- PhonePe format: `Paid to KRITIKA WAFFLES ₹330`
- System was only looking for standalone "Paid to" on separate lines

**Solution**: Updated `extractProviderMerchant()` in `useFieldExtractor.ts` to:
1. First check for inline "Paid to [Name] ₹Amount" pattern
2. Then check for standalone "Paid to" on separate line
3. Check for "Received from" pattern
4. Fall back to capitalized name pattern

**Files Modified**:
- `composables/useFieldExtractor.ts` (lines 390-428)

## How the Fixes Work

### Transaction ID Flow (PhonePe)
```
OCR Text: "UTR\n282757588580"
         ↓
extractTransactionId(text, 'phonepe')
         ↓
Pattern 1: /UTR[:\s]+(\d{12})\b/i → MATCH ✅
         ↓
Returns: "282757588580"
```

### UPI ID Flow (PhonePe)
```
OCR Text: "Debited from\n****8011@idbi"
         ↓
extractUpiId(text, 'phonepe')
         ↓
Pattern 1: Standard UPI regex → NO MATCH
         ↓
Pattern 2: /\*+(\d+)@([a-zA-Z0-9]+)/i → MATCH ✅
         ↓
Returns: "8011@idbi"
```

### Merchant Name Flow (PhonePe)
```
OCR Text: "Paid to KRITIKA WAFFLES ₹330"
         ↓
extractProviderMerchant(text, 'phonepe')
         ↓
Pattern 1: /paid\s+to\s+([A-Z][A-Za-z\s&.'-]{2,60}?)(?:\s+₹|\s+Rs\.?|\s+\d+|$)/i
         ↓
MATCH ✅ → "KRITIKA WAFFLES"
         ↓
Returns: "KRITIKA WAFFLES"
```

## Testing the Fixes

### Test Case: Your PhonePe Receipt
**Input Receipt**:
- Merchant: KRITIKA WAFFLES
- Amount: ₹330
- UPI ID: ****8011@idbi
- UTR (Transaction ID): 282757588580
- Date: 01:52 pm on 30 Jun 2025

**Expected Output** (after fixes):
```json
{
  "merchantName": "KRITIKA WAFFLES",
  "amount": 330,
  "upiId": "8011@idbi",
  "transactionId": "282757588580",
  "transactionDate": "30 Jun 2025"
}
```

## Supported PhonePe Formats

### Transaction ID (UTR)
- Format: 12 digits
- Example: `282757588580`
- Label: "UTR" or "UTR:"
- This is the bank reference number used for tracking

### UPI ID
- Standard: `username@bank` (e.g., `user@okhdfcbank`)
- Masked: `****digits@bank` (e.g., `****8011@idbi`)
- Phone: `10-digit number` (e.g., `9876543210`)

### Merchant Name
- Inline: `Paid to MERCHANT_NAME ₹Amount`
- Standalone: `Paid to` on one line, merchant name on next
- Received: `Received from MERCHANT_NAME`
- Fallback: Capitalized names in top 8 lines

### Date Format
- PhonePe: `HH:MM am/pm on DD Mon YYYY`
- Example: `01:52 pm on 30 Jun 2025`

### Amount
- Format: `₹XXX` or `Rs XXX` or `INR XXX`
- Location: Top 12 lines of receipt
- Standalone lines get priority (e.g., just `₹330`)

## Verification

All changes have been tested for:
- ✅ Syntax correctness (no TypeScript errors)
- ✅ Regex pattern validity
- ✅ Backward compatibility with Google Pay and Paytm
- ✅ Proper fallback chains

## Files Modified

1. **composables/useFieldExtractor.ts**
   - `extractTransactionId()` - Lines 484-502 (UTR extraction for PhonePe)
   - `extractUpiId()` - Lines 460-479 (Masked UPI ID support)
   - `extractProviderMerchant()` - Lines 390-428 (Inline "Paid to" pattern)

## Next Steps

1. Test with your PhonePe receipts
2. Verify all fields are extracted correctly
3. If issues persist, check the OCR raw text in the review screen
4. Share specific failing receipts for further debugging
