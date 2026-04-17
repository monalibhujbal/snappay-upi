import { ref } from 'vue'
import type { OcrResult, ProviderKind } from '~/types/transaction'

let workerInstance: any = null
let initPromise: Promise<any> | null = null

const ocrProgress = ref(0)

const DEFAULT_PARAMS = {
    tessedit_pageseg_mode: '6' as any,
    preserve_interword_spaces: '1' as any,
    tessedit_char_whitelist: '' as any,
}

const AMOUNT_PARAMS = {
    tessedit_pageseg_mode: '7' as any,
    tessedit_char_whitelist: '0123456789.,RrSs₹' as any,
    preserve_interword_spaces: '1' as any,
}

interface OcrVariant {
    label: string
    imageData: string
}

interface OcrVariantResult {
    label: string
    text: string
    confidence: number
    score: number
}

interface ProviderCrop {
    x: number
    y: number
    width: number
    height: number
    scale?: number
}

interface ParsedAmountCandidate {
    amount: number
    text: string
    label: string
    confidence: number
    score: number
}

async function getWorker(): Promise<any> {
    if (workerInstance) return workerInstance
    if (initPromise) return initPromise

    initPromise = (async () => {
        const { createWorker } = await import('tesseract.js')

        const w = await createWorker('eng', 1, {
            logger: (m: any) => {
                if (m.status === 'recognizing text') {
                    ocrProgress.value = Math.floor(m.progress * 100)
                }
            }
        })

        await w.setParameters(DEFAULT_PARAMS)

        workerInstance = w
        return w
    })()

    return initPromise
}

function createCanvas(width: number, height: number) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
}

function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('Could not load image for OCR'))
        image.src = src
    })
}

function drawUpscaledRegion(image: HTMLImageElement, crop: ProviderCrop) {
    const sx = Math.max(0, Math.floor(image.width * crop.x))
    const sy = Math.max(0, Math.floor(image.height * crop.y))
    const sWidth = Math.max(1, Math.floor(image.width * crop.width))
    const sHeight = Math.max(1, Math.floor(image.height * crop.height))
    const scale = crop.scale ?? 2

    const canvas = createCanvas(
        Math.max(1, Math.floor(sWidth * scale)),
        Math.max(1, Math.floor(sHeight * scale))
    )
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not available')

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height)
    return canvas
}

function estimateAverageLuminance(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) return 255

    const sampleWidth = Math.min(80, canvas.width)
    const sampleHeight = Math.min(80, canvas.height)
    const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data

    let total = 0
    let count = 0

    for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i] ?? 0
        const g = imageData[i + 1] ?? 0
        const b = imageData[i + 2] ?? 0
        total += r * 0.299 + g * 0.587 + b * 0.114
        count += 1
    }

    return count ? total / count : 255
}

function enhanceCanvas(canvas: HTMLCanvasElement, options?: { invert?: boolean; threshold?: number }) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not available')

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    const threshold = options?.threshold ?? 158

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i] ?? 0
        const g = data[i + 1] ?? 0
        const b = data[i + 2] ?? 0

        let gray = r * 0.299 + g * 0.587 + b * 0.114
        gray = gray < threshold ? 0 : 255

        if (options?.invert) {
            gray = 255 - gray
        }

        data[i] = gray
        data[i + 1] = gray
        data[i + 2] = gray
    }

    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL('image/png')
}

function grayscaleCanvas(
    canvas: HTMLCanvasElement,
    options?: { invert?: boolean; contrast?: number }
) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not available')

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    const contrast = options?.contrast ?? 1.45

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i] ?? 0
        const g = data[i + 1] ?? 0
        const b = data[i + 2] ?? 0

        let gray = r * 0.299 + g * 0.587 + b * 0.114
        gray = ((gray - 128) * contrast) + 128
        gray = Math.min(255, Math.max(0, gray))

        if (options?.invert) {
            gray = 255 - gray
        }

        data[i] = gray
        data[i + 1] = gray
        data[i + 2] = gray
    }

    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL('image/png')
}

function normalizeOcrText(text: string) {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{2,}/g, '\n')
        .trim()
}

function mergeTexts(texts: string[]) {
    const seen = new Set<string>()
    const merged: string[] = []

    for (const text of texts) {
        for (const line of normalizeOcrText(text).split('\n')) {
            const cleaned = line.trim()
            if (!cleaned) continue

            const key = cleaned.toLowerCase()
            if (seen.has(key)) continue

            seen.add(key)
            merged.push(cleaned)
        }
    }

    return merged.join('\n')
}

function scoreText(text: string, confidence: number) {
    let score = confidence

    if (/\u20B9|\br(?=\d)|rs|inr/i.test(text)) score += 18
    if (/\b\d+(?:\.\d{1,2})\b/.test(text)) score += 8
    if (/paid|received|debited|credited|completed|successful|transaction successful/i.test(text)) score += 8
    if (/transaction id|upi|utr|rrn/i.test(text)) score += 5

    return score
}

function scoreAmountBandText(text: string, confidence: number) {
    let score = confidence

    if (/\u20B9|\br(?=\d)|rs|inr/i.test(text)) score += 24
    if (/\b\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?\b/.test(text)) score += 18
    if (/^\s*(?:\u20B9|r|rs)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d{1,6}(?:\.\d{1,2})?)\s*$/i.test(text)) score += 28
    if (/completed|paid|received/.test(text.toLowerCase())) score += 4
    if (text.length <= 32) score += 6

    return score
}

function normalizeAmountText(text: string) {
    return normalizeOcrText(text)
        .replace(/â‚¹|Ã¢â€šÂ¹/g, '₹')
        .replace(/\bRS(?=\s*\d)/gi, 'Rs')
        .replace(/\bR(?=\s*\d)/g, '₹')
}

function extractLikelyAmount(text: string) {
    const normalized = normalizeAmountText(text)

    const exactMoneyLine = normalized
        .split('\n')
        .map(line => line.trim())
        .find(line => /^(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d{1,6}(?:\.\d{1,2})?)$/i.test(line))

    if (exactMoneyLine) {
        const exactMatch = exactMoneyLine.match(/^(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d{1,6}(?:\.\d{1,2})?)$/i)
        const exactAmount = Number.parseFloat((exactMatch?.[1] ?? '').replace(/,/g, ''))
        if (Number.isFinite(exactAmount) && exactAmount > 0 && exactAmount <= 200000) return exactAmount
    }

    const directMatch = normalized.match(/(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d{1,6}(?:\.\d{1,2})?)/i)
    if (!directMatch) return null

    const amountStr = directMatch[1] ?? ''
    const amount = Number.parseFloat(amountStr.replace(/,/g, ''))
    if (!Number.isFinite(amount) || amount <= 0 || amount > 200000) return null

    return amount
}

function getAmountBandIndex(label: string) {
    const match = label.match(/amount-band-(\d+)/i)
    return match ? Number.parseInt(match[1] ?? '', 10) : null
}

function getAmountBandPositionBonus(label: string, provider: ProviderKind) {
    const index = getAmountBandIndex(label)
    if (!index) return 0

    if (provider === 'gpay') {
        return Math.max(0, 20 - Math.abs(index - 8) * 4)
    }

    return 0
}

function scoreParsedAmountCandidate(result: OcrVariantResult, provider: ProviderKind): ParsedAmountCandidate | null {
    const normalized = normalizeAmountText(result.text)
    const lines = normalized.split('\n').map(line => line.trim()).filter(Boolean)
    const exactLine = lines.find(line => /^(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d{1,6}(?:\.\d{1,2})?)$/i.test(line)) ?? ''
    const amount = extractLikelyAmount(normalized)

    if (amount === null) return null

    let score = result.score + getAmountBandPositionBonus(result.label, provider)

    if (exactLine) score += 34
    if (/^(?:₹|rs\.?|inr)/i.test(exactLine)) score += 26
    if (lines.length === 1) score += 12
    if (lines.length > 2) score -= 14
    if (/^\d{1,2}$/.test(exactLine || normalized)) score -= 18
    if (amount < 100 && !/^(?:₹|rs\.?|inr)/i.test(exactLine)) score -= 8
    if (/\b\d{7,}\b/.test(normalized)) score -= 20
    if (/[A-Za-z]{2,}/.test(normalized.replace(/\b(?:rs|inr)\b/gi, '').replace(/[₹\d\s.,]/g, ''))) score -= 20
    if ((exactLine || normalized).length <= 8) score += 10

    return {
        amount,
        text: normalized,
        label: result.label,
        confidence: result.confidence,
        score,
    }
}

function collectParsedAmountCandidates(results: OcrVariantResult[], provider: ProviderKind) {
    return results
        .map(result => scoreParsedAmountCandidate(result, provider))
        .filter((candidate): candidate is ParsedAmountCandidate => candidate !== null)
        .sort((a, b) => b.score - a.score)
}

async function runVariants(
    worker: any,
    variants: OcrVariant[],
    mode: 'default' | 'amount' = 'default',
    earlyExitPredicate?: (text: string, score: number) => boolean
) {
    const results: OcrVariantResult[] = []

    await worker.setParameters(mode === 'amount' ? AMOUNT_PARAMS : DEFAULT_PARAMS)

    for (const variant of variants) {
        const { data } = await worker.recognize(variant.imageData)
        const text = normalizeOcrText(data.text)
        const score = mode === 'amount'
            ? scoreAmountBandText(text, data.confidence)
            : scoreText(text, data.confidence)

        console.log(`Tesseract ${variant.label} result:`, data)
        results.push({
            label: variant.label,
            text,
            confidence: data.confidence,
            score,
        })

        if (earlyExitPredicate && earlyExitPredicate(text, score)) {
            console.log(`Early exit condition met for ${variant.label}, skipping remaining variants to save CPU.`)
            break
        }
    }

    await worker.setParameters(DEFAULT_PARAMS)
    return results
}

async function prepareBaseVariants(imageData: string): Promise<OcrVariant[]> {
    const image = await loadImage(imageData)
    const fullCanvas = drawUpscaledRegion(image, { x: 0, y: 0, width: 1, height: 1, scale: 2 })

    const variants: OcrVariant[] = [
        { label: 'full-original', imageData: fullCanvas.toDataURL('image/png') },
        {
            label: 'full-enhanced',
            imageData: enhanceCanvas(drawUpscaledRegion(image, { x: 0, y: 0, width: 1, height: 1, scale: 2 }), {
                invert: false,
                threshold: 165,
            })
        },
        {
            label: 'full-inverted',
            imageData: enhanceCanvas(drawUpscaledRegion(image, { x: 0, y: 0, width: 1, height: 1, scale: 2 }), {
                invert: true,
                threshold: 120,
            })
        },
        {
            label: 'top-enhanced',
            imageData: enhanceCanvas(drawUpscaledRegion(image, { x: 0, y: 0, width: 1, height: 0.55, scale: 2.6 }), {
                invert: false,
                threshold: 168,
            })
        },
        {
            label: 'top-inverted',
            imageData: enhanceCanvas(drawUpscaledRegion(image, { x: 0, y: 0, width: 1, height: 0.55, scale: 2.6 }), {
                invert: true,
                threshold: 120,
            })
        },
    ]

    return variants
}

function getProviderCrops(provider: ProviderKind): ProviderCrop[] {
    switch (provider) {
        case 'gpay':
            return [
                { x: 0.18, y: 0.08, width: 0.64, height: 0.26, scale: 3 },
                { x: 0.12, y: 0.12, width: 0.76, height: 0.32, scale: 2.8 },
            ]
        case 'phonepe':
            return [
                { x: 0.0, y: 0.05, width: 1.0, height: 0.40, scale: 2.5 },
                { x: 0.1, y: 0.1, width: 0.8, height: 0.50, scale: 2.5 },
            ]
        case 'paytm':
            return [
                { x: 0.0, y: 0.05, width: 1.0, height: 0.40, scale: 2.5 },
                { x: 0.1, y: 0.1, width: 0.8, height: 0.50, scale: 2.5 },
            ]
        case 'generic_upi':
            return [
                { x: 0.14, y: 0.08, width: 0.72, height: 0.28, scale: 2.8 },
            ]
        default:
            return []
    }
}

function getProviderAmountBands(provider: ProviderKind): ProviderCrop[] {
    switch (provider) {
        case 'gpay':
            return [
                { x: 0.24, y: 0.10, width: 0.52, height: 0.08, scale: 4.8 },
                { x: 0.22, y: 0.12, width: 0.56, height: 0.09, scale: 4.8 },
                { x: 0.20, y: 0.14, width: 0.60, height: 0.10, scale: 5 },
                { x: 0.18, y: 0.16, width: 0.64, height: 0.10, scale: 5 },
                { x: 0.28, y: 0.18, width: 0.44, height: 0.09, scale: 6.5 },
                { x: 0.25, y: 0.19, width: 0.50, height: 0.10, scale: 7 },
                { x: 0.22, y: 0.20, width: 0.56, height: 0.11, scale: 7 },
                { x: 0.20, y: 0.22, width: 0.60, height: 0.12, scale: 7 },
                { x: 0.18, y: 0.24, width: 0.64, height: 0.12, scale: 7 },
                { x: 0.16, y: 0.26, width: 0.68, height: 0.12, scale: 7 },
            ]
        default:
            return []
    }
}

async function prepareProviderVariants(imageData: string, provider: ProviderKind): Promise<OcrVariant[]> {
    const crops = getProviderCrops(provider)
    if (!crops.length) return []

    const image = await loadImage(imageData)
    const variants: OcrVariant[] = []

    for (const [index, crop] of crops.entries()) {
        const canvas = drawUpscaledRegion(image, crop)
        const luminance = estimateAverageLuminance(canvas)

        variants.push({
            label: `${provider}-crop-${index + 1}`,
            imageData: enhanceCanvas(drawUpscaledRegion(image, crop), {
                invert: luminance < 150,
                threshold: luminance < 150 ? 120 : 170,
            })
        })

        if (luminance < 150) {
            variants.push({
                label: `${provider}-crop-${index + 1}-inverted`,
                imageData: enhanceCanvas(drawUpscaledRegion(image, crop), {
                    invert: true,
                    threshold: 126,
                })
            })
        }
    }

    return variants
}

async function prepareAmountBandVariants(imageData: string, provider: ProviderKind): Promise<OcrVariant[]> {
    const bands = getProviderAmountBands(provider)
    if (!bands.length) return []

    const image = await loadImage(imageData)
    const variants: OcrVariant[] = []

    for (const [index, band] of bands.entries()) {
        const canvas = drawUpscaledRegion(image, band)
        const luminance = estimateAverageLuminance(canvas)

        variants.push({
            label: `${provider}-amount-band-${index + 1}-grayscale`,
            imageData: grayscaleCanvas(drawUpscaledRegion(image, band), {
                invert: luminance < 160,
                contrast: 1.7,
            })
        })

        variants.push({
            label: `${provider}-amount-band-${index + 1}`,
            imageData: enhanceCanvas(drawUpscaledRegion(image, band), {
                invert: luminance < 160,
                threshold: luminance < 160 ? 132 : 176,
            })
        })

        variants.push({
            label: `${provider}-amount-band-${index + 1}-inverted`,
            imageData: enhanceCanvas(drawUpscaledRegion(image, band), {
                invert: true,
                threshold: 132,
            })
        })
    }

    return variants
}

export function useOcr() {
    const isProcessing = ref(false)
    const error = ref<string | null>(null)

    async function recognize(imageData: string): Promise<OcrResult | null> {
        isProcessing.value = true
        ocrProgress.value = 0
        error.value = null

        try {
            const worker = await getWorker()
            const variants = await prepareBaseVariants(imageData)

            console.log('Tesseract worker ready, recognizing...')

            const results = await runVariants(worker, variants)
            const mergedText = mergeTexts(
                [...results]
                    .sort((a, b) => b.score - a.score)
                    .map(result => result.text)
            )

            return {
                text: mergedText,
                confidence: Math.max(...results.map(result => result.confidence)),
            }
        } catch (e) {
            console.error('Tesseract error:', e)
            error.value = e instanceof Error ? e.message : 'OCR failed'
            return null
        } finally {
            isProcessing.value = false
        }
    }

    async function recognizeProviderAmountRegion(imageData: string, provider: ProviderKind): Promise<OcrResult | null> {
        if (provider === 'unknown_provider') return null

        try {
            const worker = await getWorker()
            const providerVariants = await prepareProviderVariants(imageData, provider)
            const amountBandVariants = await prepareAmountBandVariants(imageData, provider)

            const providerResults = providerVariants.length
                ? await runVariants(worker, providerVariants)
                : []

            const amountResults = amountBandVariants.length
                ? await runVariants(worker, amountBandVariants, 'amount', (text, score) => {
                    const normalized = normalizeAmountText(text)
                    const parsedAmount = extractLikelyAmount(normalized)
                    const exactMoneyLine = normalized
                        .split('\n')
                        .map(line => line.trim())
                        .find(line => /^(?:₹|rs\.?|inr)\s*\d[\d,]*(?:\.\d{1,2})?$/i.test(line))

                    return score >= 120 && parsedAmount !== null && !!exactMoneyLine
                })
                : []

            const parsedAmountCandidates = collectParsedAmountCandidates(amountResults, provider)
            const bestAmountCandidate = parsedAmountCandidates[0]
            const cleanAmount = bestAmountCandidate?.amount ?? null

            const curatedAmountTexts = cleanAmount
                ? parsedAmountCandidates
                    .filter(candidate => candidate.score >= Math.max(bestAmountCandidate.score - 18, 110))
                    .slice(0, 2)
                    .map(candidate => candidate.text)
                : []

            const mergedText = mergeTexts(
                [...curatedAmountTexts, ...providerResults.map(result => result.text)]
            )

            const stitchedText = cleanAmount
                ? mergeTexts([`Amount ₹${cleanAmount}`, mergedText])
                : mergedText

            if (!stitchedText) return null

            return {
                text: stitchedText,
                confidence: Math.max(...[...providerResults, ...amountResults].map(result => result.confidence)),
            }
        } catch (e) {
            console.error('Provider OCR error:', e)
            return null
        }
    }

    async function terminate() {
        if (workerInstance) {
            await workerInstance.terminate()
            workerInstance = null
            initPromise = null
        }
    }

    return { isProcessing, ocrProgress, error, recognize, recognizeProviderAmountRegion, terminate }
}
