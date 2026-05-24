@echo off
git checkout -b feature/world-class-ocr
git add composables/useOcrNormalizer.ts composables/useOcr.ts composables/useFieldExtractor.ts composables/useSemanticExtractor.ts composables/useNlpValidator.ts composables/useDocumentClassifier.ts composables/useProviderClassifier.ts pages/scan.vue
git commit -m "feat: world-class OCR and NLP pipeline for UPI receipts"
