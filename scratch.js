const text = `To Deepali Pawar
+91 99238 86667
₹60
Pay again
Completed
15 Apr 2026, 10:28pm
121663404691`;

const RECEIPT_MERCHANT_REGEX = /(?:paid\s+to|sent\s+to|to|merchant|receiver|beneficiary)[:\s]+([A-Za-z0-9\s&.\'-]{2,60}?)(?:\n|$|UPI|@|\d)/i;
console.log('Merchant:', RECEIPT_MERCHANT_REGEX.exec(text)?.[1]);

const DATE_REGEX = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i;
console.log('Date:', DATE_REGEX.exec(text)?.[1]);
