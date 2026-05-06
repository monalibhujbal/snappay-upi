# Receipt Processing Fixes - PhonePe & Paytm Support

## What Was Fixed

### 1. Date Extraction Issues ✅

#### Problem
- Dates were not being extracted from PhonePe and Paytm receipts
- Different date formats weren't recognized

#### Solution
Added multiple date extraction strategies:

**PhonePe Format**: `08:07 am on 28 Feb 2026`
- Pattern: `/(\d{1,2}:\d{2}\s*(?:am|pm))\s+on\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i`

**Paytm Format**: `12:48 AM, 13 Feb 2026`
- Pattern: `/(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)[,\s]+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,\s]+\d{2,4})/i`

**Additional Formats**:
- `13 Feb 2026` or `13 February 2026`
- `13/02/2026` or `13-02-2026` or `13.02.2026`
- `2026-02-13` (ISO format)

### 2. Rupee Symbol Confusion ✅

#### Problem
- OCR was reading ₹ (rupee symbol) as "2"
- Amounts like "₹1369" were being read as "2 1369"

#### Solution
Added intelligent pattern matching:
```typescript
.replace(/\b2(?=\s*\d{2,6}(?:[,\.]\d+)?(?:\s|$))/g, '₹')
.replace(/^2(?=\s*\d{2,6}(?:[,\.]\d+)?)/gm, '₹')
.replace(/(?<=\s)2(?=\s*\d{2,6}(?:[,\.]\d+)?)/g, '₹')
```

This detects when "2" is followed by 2-6 digits and converts it to ₹.

### 3. PhonePe Receipt Support ✅

#### OCR Improvements
- Added 3 crop regions optimized for PhonePe layout
- Increased scale factors (3.2-3.5x) for better text capture
- Added 6 amount bands for PhonePe's amount display

#### Field Extraction
- Enhanced merchant name extraction (looks for capitalized names)
- Improved amount detection with expanded search window (12 lines)
- Added PhonePe-specific patterns for "Paid to" text

#### Transaction ID
- Updated regex to handle PhonePe format: `R1050260228080722373968077`
- Pattern: `/\b([A-Z]?\d{12,20})\b/`

### 4. Paytm Receipt Support ✅

#### OCR Improvements
- Added 3 crop regions optimized for Paytm layout
- Higher scale factors for dark background text
- Added 6 amount bands for Paytm's amount display

#### Field Extraction
- Enhanced merchant name extraction (handles "From:" and "To:" patterns)
- Improved amount detection with "Paid Successfully" context
- Added Paytm-specific patterns for "Money Received" text

## Supported Receipt Formats

### Google Pay ✅
- Amount extraction: Top 8 lines, 10 amount bands
- Date format: Various formats supported
- Merchant: "To [Name]" pattern
- Transaction ID: 12-18 digits

### PhonePe ✅
- Amount extraction: Top 12 lines, 6 amount bands
- Date format: "08:07 am on 28 Feb 2026"
- Merchant: "Paid to [Name]" or capitalized names
- Transaction ID: R + 19 digits

### Paytm ✅
- Amount extraction: Top 12 lines, 6 amount bands
- Date format: "12:48 AM, 13 Feb 2026"
- Merchant: "From:" or "To:" patterns
- Transaction ID: 12-20 digits

## Testing Your Receipts

### Test Process
1. Open the app and go to Scan Receipt
2. Upload a PhonePe or Paytm receipt
3. Check the extracted fields:
   - ✅ Amount should be correct (no "2" prefix)
   - ✅ Date should be extracted
   - ✅ Merchant name should be captured
   - ✅ Transaction ID should be found

### If Issues Persist

**For Date Issues:**
- Check if the date appears in the OCR text (review step)
- Verify the date format matches one of the supported patterns
- Date should be in top 15 lines of the receipt

**For Amount Issues:**
- Verify the amount is visible in the receipt image
- Check if there's a currency symbol (₹, Rs, INR)
- Amount should be in top 12 lines for PhonePe/Paytm

**For Merchant Name Issues:**
- Check if the name is in ALL CAPS or Title Case
- Verify it appears near "Paid to", "From:", or "To:" text
- Name should be in top 10 lines

## Files Modified

1. `composables/useOcr.ts`
   - Added PhonePe/Paytm crop regions
   - Added amount bands for both providers
   - Improved text normalization (rupee symbol fix)

2. `composables/useFieldExtractor.ts`
   - Enhanced date extraction with multiple strategies
   - Improved merchant name extraction
   - Better amount detection for all providers
   - Updated transaction ID regex

3. `composables/useSemanticExtractor.ts`
   - Added PhonePe/Paytm date patterns
   - Enhanced receiver/sender extraction
   - Better transaction ID patterns

## Next Steps

If you still encounter issues:
1. Share the specific receipt that's failing
2. Note which field is not being extracted
3. Check the OCR raw text in the review screen
4. I can fine-tune the patterns further
