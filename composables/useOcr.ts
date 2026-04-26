import { ref } from 'vue'
import type { OcrResult, ProviderKind } from '~/types/transaction'
import {
    normalizeOcrText,
    normalizeOcrTextForAmount,
    receiptQualityScore,
    RUPEE,
} from '~/composables/useOcrNormalizer'

// ─── Singleton Tesseract worker ────────────────────────────────────────────
let workerInstance: any = null
let initPromise: Promise<any> | null = null

const ocrProgress = ref(0)

// Tesseract parameter presets
const DEFAULT_PARAMS = {
    tessedit_pageseg_mode: '3' as any,   // PSM 3 = fully automatic page segmentation
    tessedit_ocr_engine_mode: '1' as any, // OEM 1 = LSTM neural net (best accuracy)
    preserve_interword_spaces: '1' as any,
    tessedit_char_whitelist: '' as any,
}

const BLOCK_PARAMS = {
    tessedit_pageseg_mode: '6' as any,   // PSM 6 = uniform block of text
    tessedit_ocr_engine_mode: '1' as any,
    preserve_interword_spaces: '1' as any,
    tessedit_char_whitelist: '' as any,
}

const AMOUNT_PARAMS = {
    tessedit_pageseg_mode: '7' as any,   // PSM 7 = single text line
    tessedit_ocr_engine_mode: '1' as any,
    tessedit_char_whitelist: `0123456789.,RrSsIiNn${RUPEE}` as any,
    preserve_interword_spaces: '1' as any,
}

// ─── Interfaces ────────────────────────────────────────────────────────────
interface OcrVariant {
    label: string
    imageData: string
    psm?: 'default' | 'block' | 'amount'
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

// ─── Worker management ─────────────────────────────────────────────────────
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
            },
        })
        await w.setParameters(DEFAULT_PARAMS)
        workerInstance = w
        return w
    })()

    return initPromise
}

// ─── Canvas helpers ─────────────────────────────────────────────────────────
function createCanvas(width: number, height: number): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = Math.max(1, width)
    c.height = Math.max(1, height)
    return c
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Could not load image for OCR'))
        img.src = src
    })
}

function drawUpscaledRegion(image: HTMLImageElement, crop: ProviderCrop): HTMLCanvasElement {
    const sx = Math.max(0, Math.floor(image.width * crop.x))
    const sy = Math.max(0, Math.floor(image.height * crop.y))
    const sw = Math.max(1, Math.floor(image.width * crop.width))
    const sh = Math.max(1, Math.floor(image.height * crop.height))
    const scale = crop.scale ?? 2

    const canvas = createCanvas(Math.floor(sw * scale), Math.floor(sh * scale))
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    return canvas
}

// ─── Image quality analysis ─────────────────────────────────────────────────

/** Compute average luminance over a sample region */
function estimateAverageLuminance(canvas: HTMLCanvasElement): number {
    const ctx = canvas.getContext('2d')
    if (!ctx) return 128
    const sw = Math.min(80, canvas.width)
    const sh = Math.min(80, canvas.height)
    const data = ctx.getImageData(0, 0, sw, sh).data
    let sum = 0, n = 0
    for (let i = 0; i < data.length; i += 4) {
        sum += (data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114)
        n++
    }
    return n ? sum / n : 128
}

/**
 * Compute Otsu's optimal binarisation threshold from a greyscale histogram.
 * This is far superior to a fixed magic number like 158 – it adapts to each
 * image's contrast distribution automatically.
 */
function computeOtsuThreshold(data: Uint8ClampedArray): number {
    const hist = new Float64Array(256)
    const total = data.length / 4

    for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114)
        hist[gray]! += 1
    }

    let sumB = 0, wB = 0, max = 0, threshold = 128
    const sum = hist.reduce((a, v, i) => a + i * v, 0)

    for (let t = 0; t < 256; t++) {
        wB += hist[t]!
        if (!wB) continue
        const wF = total - wB
        if (!wF) break
        sumB += t * hist[t]!
        const mB = sumB / wB
        const mF = (sum - sumB) / wF
        const between = wB * wF * (mB - mF) ** 2
        if (between > max) { max = between; threshold = t }
    }

    return threshold
}

/**
 * Laplacian-variance – a standard metric for image sharpness.
 * Low value = blurry image.  Exposed so scan.vue can warn the user.
 */
export function computeSharpness(canvas: HTMLCanvasElement): number {
    const ctx = canvas.getContext('2d')
    if (!ctx) return 0
    const sw = Math.min(200, canvas.width)
    const sh = Math.min(200, canvas.height)
    const data = ctx.getImageData(0, 0, sw, sh).data
    const gray: number[] = []

    for (let i = 0; i < data.length; i += 4)
        gray.push(data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114)

    // Laplacian kernel convolution
    let variance = 0
    let mean = 0
    for (let y = 1; y < sh - 1; y++) {
        for (let x = 1; x < sw - 1; x++) {
            const idx = y * sw + x
            const lap =
                gray[idx - sw]! + gray[idx + sw]! +
                gray[idx - 1]! + gray[idx + 1]! -
                4 * gray[idx]!
            variance += lap * lap
            mean += Math.abs(lap)
        }
    }
    return mean / ((sw - 2) * (sh - 2))
}

// ─── Image preprocessing pipeline ──────────────────────────────────────────

/**
 * Convert to greyscale using the Rec.709 luminance formula.
 * Applies Otsu-computed threshold for binary output + optional inversion.
 */
function binarizeCanvas(
    canvas: HTMLCanvasElement,
    options?: { invert?: boolean; threshold?: number }
): string {
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const d = imageData.data
    const threshold = options?.threshold ?? computeOtsuThreshold(d)

    for (let i = 0; i < d.length; i += 4) {
        let gray = d[i]! * 0.299 + d[i + 1]! * 0.587 + d[i + 2]! * 0.114
        gray = gray < threshold ? 0 : 255
        if (options?.invert) gray = 255 - gray
        d[i] = d[i + 1] = d[i + 2] = gray
    }

    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL('image/png')
}

/**
 * Adaptive contrast enhancement (CLAHE-inspired).
 * Applies stretching per 32×32 tile so local contrast is preserved even
 * when parts of the image are much lighter/darker than others.
 */
function adaptiveContrastCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!
    const { width: W, height: H } = canvas
    const imageData = ctx.getImageData(0, 0, W, H)
    const d = imageData.data
    const TILE = 48  // tile size

    // Build greyscale buffer
    const gray = new Float32Array(W * H)
    for (let i = 0; i < d.length; i += 4)
        gray[i >> 2] = d[i]! * 0.299 + d[i + 1]! * 0.587 + d[i + 2]! * 0.114

    // Per-tile min/max
    const tilesX = Math.ceil(W / TILE)
    const tilesY = Math.ceil(H / TILE)
    const tMin = new Float32Array(tilesX * tilesY)
    const tMax = new Float32Array(tilesX * tilesY)

    for (let ty = 0; ty < tilesY; ty++) {
        for (let tx = 0; tx < tilesX; tx++) {
            let mn = 255, mx = 0
            for (let y = ty * TILE; y < Math.min((ty + 1) * TILE, H); y++) {
                for (let x = tx * TILE; x < Math.min((tx + 1) * TILE, W); x++) {
                    const v = gray[y * W + x]!
                    if (v < mn) mn = v
                    if (v > mx) mx = v
                }
            }
            tMin[ty * tilesX + tx] = mn
            tMax[ty * tilesX + tx] = mx
        }
    }

    // Apply per-pixel stretch using bilinear tile interpolation
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const ti = Math.floor(y / TILE) * tilesX + Math.floor(x / TILE)
            const mn = tMin[ti]!
            const mx = tMax[ti]!
            const range = mx - mn || 1
            const stretched = Math.min(255, Math.max(0, ((gray[y * W + x]! - mn) / range) * 255))
            const pi = (y * W + x) * 4
            d[pi] = d[pi + 1] = d[pi + 2] = stretched
        }
    }

    ctx.putImageData(imageData, 0, 0)
    return canvas
}

/**
 * Unsharp mask — sharpens edges using a 3×3 approximation.
 * Greatly improves Tesseract's ability to distinguish similar characters.
 */
function sharpenCanvas(canvas: HTMLCanvasElement, amount = 0.8): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!
    const { width: W, height: H } = canvas
    const src = ctx.getImageData(0, 0, W, H)
    const dst = ctx.createImageData(W, H)
    const s = src.data, t = dst.data

    const kernel = [-1, -1, -1, -1, 9 + amount * 6, -1, -1, -1, -1]
    const scale = 1  // kernel sums to 1 already

    for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
            const pi = (y * W + x) * 4
            for (let c = 0; c < 3; c++) {
                let val = 0
                let ki = 0
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        val += (s[((y + ky) * W + (x + kx)) * 4 + c]!) * kernel[ki++]!
                    }
                }
                t[pi + c] = Math.min(255, Math.max(0, val / scale))
            }
            t[pi + 3] = 255
        }
    }

    ctx.putImageData(dst, 0, 0)
    return canvas
}

/**
 * Remove large uniform borders around the receipt image (e.g., white phone
 * UI chrome, black camera viewfinder borders).  Returns cropped DataURL.
 */
function removeReceiptBorder(canvas: HTMLCanvasElement, marginRatio = 0.03): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!
    const { width: W, height: H } = canvas
    const data = ctx.getImageData(0, 0, W, H).data

    function luminanceAt(x: number, y: number) {
        const i = (y * W + x) * 4
        return data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114
    }

    const bgLum = luminanceAt(0, 0)  // assume corner is background
    const tol = 28  // luminance tolerance for "same as background"

    function isBgRow(y: number) {
        for (let x = 0; x < W; x += 4)
            if (Math.abs(luminanceAt(x, y) - bgLum) > tol) return false
        return true
    }

    function isBgCol(x: number) {
        for (let y = 0; y < H; y += 4)
            if (Math.abs(luminanceAt(x, y) - bgLum) > tol) return false
        return true
    }

    let top = 0, bottom = H - 1, left = 0, right = W - 1
    const maxScan = Math.floor(H * 0.25)

    while (top < maxScan && isBgRow(top)) top++
    while (bottom > H - maxScan && isBgRow(bottom)) bottom--
    while (left < Math.floor(W * 0.25) && isBgCol(left)) left++
    while (right > Math.floor(W * 0.75) && isBgCol(right)) right--

    // Apply minimum margin
    const mX = Math.floor(W * marginRatio)
    const mY = Math.floor(H * marginRatio)
    top = Math.max(0, top - mY)
    bottom = Math.min(H - 1, bottom + mY)
    left = Math.max(0, left - mX)
    right = Math.min(W - 1, right + mX)

    const cw = right - left + 1
    const ch = bottom - top + 1
    if (cw < 50 || ch < 50) return canvas  // safety: don't over-crop

    const cropped = createCanvas(cw, ch)
    cropped.getContext('2d')!.drawImage(canvas, left, top, cw, ch, 0, 0, cw, ch)
    return cropped
}

/**
 * Fast image deskew using horizontal projection maximisation.
 * Detects the dominant text angle (−15° to +15°) and rotates the canvas.
 * This is the single highest-impact fix for phone-camera receipts.
 */
function deskewCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!
    const { width: W, height: H } = canvas
    const data = ctx.getImageData(0, 0, W, H).data

    // Build a binary (0/1) pixel map – 1 = dark pixel
    const binary: number[] = new Array(W * H)
    for (let i = 0; i < data.length; i += 4)
        binary[i >> 2] = data[i]! < 128 ? 1 : 0

    let bestAngle = 0
    let bestScore = -1
    const STEP = 0.5  // degree step

    for (let angleDeg = -12; angleDeg <= 12; angleDeg += STEP) {
        const rad = (angleDeg * Math.PI) / 180
        const cosA = Math.cos(rad)
        const sinA = Math.sin(rad)

        // Project all dark pixels onto a rotated horizontal axis
        const rowHits = new Int32Array(H + 50)

        for (let y = 0; y < H; y += 2) {
            for (let x = 0; x < W; x += 2) {
                if (!binary[y * W + x]) continue
                const cx = x - W / 2
                const cy = y - H / 2
                const ry = Math.round(cx * sinA + cy * cosA + H / 2)
                if (ry >= 0 && ry < rowHits.length) rowHits[ry]! += 1
            }
        }

        // Variance of row hit counts = how well text is horizontally aligned
        let sum = 0, sumSq = 0, cnt = 0
        for (let r = 0; r < rowHits.length; r++) {
            const v = rowHits[r]!
            sum += v; sumSq += v * v; cnt++
        }
        const mean = sum / cnt
        const variance = sumSq / cnt - mean * mean

        if (variance > bestScore) { bestScore = variance; bestAngle = angleDeg }
    }

    if (Math.abs(bestAngle) < 0.4) return canvas  // skip trivial rotation

    const rad = (-bestAngle * Math.PI) / 180
    const result = createCanvas(W, H)
    const rCtx = result.getContext('2d')!
    rCtx.fillStyle = 'white'
    rCtx.fillRect(0, 0, W, H)
    rCtx.translate(W / 2, H / 2)
    rCtx.rotate(rad)
    rCtx.drawImage(canvas, -W / 2, -H / 2)
    rCtx.setTransform(1, 0, 0, 1, 0, 0)
    return result
}

// ─── Full preprocessing pipeline ────────────────────────────────────────────

interface PrepareOptions {
    scale?: number
    deskew?: boolean
    removeBorder?: boolean
    sharpen?: boolean
    adaptiveContrast?: boolean
    invert?: boolean
    /** If undefined, Otsu's method is used automatically */
    threshold?: number
}

function prepareImageData(
    image: HTMLImageElement,
    crop: ProviderCrop,
    opts: PrepareOptions = {}
): string {
    let canvas = drawUpscaledRegion(image, crop)

    if (opts.removeBorder !== false) canvas = removeReceiptBorder(canvas)
    if (opts.deskew) canvas = deskewCanvas(canvas)
    if (opts.adaptiveContrast !== false) canvas = adaptiveContrastCanvas(canvas)
    if (opts.sharpen !== false) canvas = sharpenCanvas(canvas)

    return binarizeCanvas(canvas, {
        invert: opts.invert ?? (estimateAverageLuminance(canvas) < 128),
        threshold: opts.threshold,
    })
}

// ─── Variant preparation ────────────────────────────────────────────────────

async function prepareBaseVariants(imageData: string): Promise<OcrVariant[]> {
    const image = await loadImage(imageData)
    const fullCrop: ProviderCrop = { x: 0, y: 0, width: 1, height: 1, scale: 2 }

    // Detect overall image luminance to choose inversion
    const probe = drawUpscaledRegion(image, { ...fullCrop, scale: 1 })
    const lum = estimateAverageLuminance(probe)
    const isDark = lum < 128

    return [
        // Variant 1: Full page, deskewed + sharpened (primary)
        {
            label: 'full-deskew-sharpen',
            imageData: prepareImageData(image, fullCrop, {
                scale: 2, deskew: true, removeBorder: true, sharpen: true,
                adaptiveContrast: true, invert: isDark,
            }),
            psm: 'default',
        },
        // Variant 2: Full page, adaptive contrast only (no deskew – faster)
        {
            label: 'full-adaptive',
            imageData: prepareImageData(image, fullCrop, {
                scale: 2, deskew: false, removeBorder: true, sharpen: true,
                adaptiveContrast: true, invert: isDark,
            }),
            psm: 'default',
        },
        // Variant 3: Top 55% (dense information zone), strong upscale
        {
            label: 'top-region',
            imageData: prepareImageData(image,
                { x: 0, y: 0, width: 1, height: 0.55, scale: 2.8 },
                { deskew: true, sharpen: true, adaptiveContrast: true, invert: isDark }
            ),
            psm: 'block',
        },
        // Variant 4: Force-inverted variant (catches light-text-on-dark missed above)
        {
            label: 'full-inverted',
            imageData: prepareImageData(image, fullCrop, {
                scale: 2, sharpen: true, adaptiveContrast: true, invert: !isDark,
            }),
            psm: 'default',
        },
        // Variant 5: Bottom 60% to catch footer amounts/dates
        {
            label: 'bottom-region',
            imageData: prepareImageData(image,
                { x: 0, y: 0.35, width: 1, height: 0.65, scale: 2.4 },
                { sharpen: true, adaptiveContrast: true, invert: isDark }
            ),
            psm: 'block',
        },
    ]
}

function getProviderCrops(provider: ProviderKind): ProviderCrop[] {
    switch (provider) {
        case 'gpay':
            return [
                { x: 0.10, y: 0.06, width: 0.80, height: 0.30, scale: 3.2 },
                { x: 0.18, y: 0.08, width: 0.64, height: 0.26, scale: 3 },
            ]
        case 'phonepe':
            return [
                { x: 0.00, y: 0.06, width: 1.00, height: 0.30, scale: 4.0 },
                { x: 0.60, y: 0.08, width: 0.40, height: 0.18, scale: 5.5 },
                { x: 0.02, y: 0.10, width: 0.68, height: 0.20, scale: 3.8 },
                { x: 0.02, y: 0.28, width: 0.96, height: 0.28, scale: 4.0 },
            ]
        case 'paytm':
            return [
                { x: 0.00, y: 0.06, width: 1.00, height: 0.38, scale: 3.4 },
                { x: 0.10, y: 0.10, width: 0.80, height: 0.32, scale: 3.6 },
                { x: 0.08, y: 0.14, width: 0.84, height: 0.40, scale: 3.0 },
            ]
        case 'generic_upi':
            return [
                { x: 0.05, y: 0.05, width: 0.90, height: 0.50, scale: 3.0 },
                { x: 0.10, y: 0.10, width: 0.80, height: 0.40, scale: 2.8 },
            ]
        default:
            return []
    }
}

function getProviderAmountBands(provider: ProviderKind): ProviderCrop[] {
    switch (provider) {
        case 'gpay':
            return [
                { x: 0.24, y: 0.10, width: 0.52, height: 0.08, scale: 5.5 },
                { x: 0.22, y: 0.12, width: 0.56, height: 0.09, scale: 5.5 },
                { x: 0.20, y: 0.14, width: 0.60, height: 0.10, scale: 6.0 },
                { x: 0.18, y: 0.16, width: 0.64, height: 0.10, scale: 6.0 },
                { x: 0.28, y: 0.18, width: 0.44, height: 0.09, scale: 7.0 },
                { x: 0.25, y: 0.20, width: 0.50, height: 0.10, scale: 7.5 },
                { x: 0.22, y: 0.22, width: 0.56, height: 0.11, scale: 7.5 },
                { x: 0.20, y: 0.24, width: 0.60, height: 0.12, scale: 7.5 },
            ]
        case 'phonepe':
            return [
                { x: 0.72, y: 0.12, width: 0.26, height: 0.06, scale: 8.0 },
                { x: 0.70, y: 0.14, width: 0.28, height: 0.06, scale: 8.0 },
                { x: 0.68, y: 0.16, width: 0.30, height: 0.07, scale: 7.5 },
                { x: 0.66, y: 0.18, width: 0.32, height: 0.07, scale: 7.5 },
                { x: 0.70, y: 0.20, width: 0.28, height: 0.06, scale: 7.0 },
                { x: 0.60, y: 0.10, width: 0.38, height: 0.08, scale: 7.0 },
            ]
        case 'paytm':
            return [
                { x: 0.18, y: 0.12, width: 0.64, height: 0.09, scale: 6.0 },
                { x: 0.16, y: 0.14, width: 0.68, height: 0.10, scale: 6.0 },
                { x: 0.14, y: 0.16, width: 0.72, height: 0.10, scale: 6.5 },
                { x: 0.24, y: 0.20, width: 0.52, height: 0.09, scale: 7.0 },
                { x: 0.20, y: 0.22, width: 0.60, height: 0.10, scale: 7.0 },
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

    for (const [i, crop] of crops.entries()) {
        const probe = drawUpscaledRegion(image, { ...crop, scale: 1 })
        const lum = estimateAverageLuminance(probe)
        const isDark = lum < 140

        variants.push({
            label: `${provider}-crop-${i + 1}`,
            imageData: prepareImageData(image, crop, {
                sharpen: true, adaptiveContrast: true, invert: isDark,
            }),
            psm: 'block',
        })

        if (isDark) {
            variants.push({
                label: `${provider}-crop-${i + 1}-light`,
                imageData: prepareImageData(image, crop, {
                    sharpen: true, adaptiveContrast: true, invert: false,
                }),
                psm: 'block',
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

    for (const [i, band] of bands.entries()) {
        const probe = drawUpscaledRegion(image, { ...band, scale: 1 })
        const lum = estimateAverageLuminance(probe)
        const isDark = lum < 155

        // Three variants per band: CLAHE+sharpen, binarised, inverted
        variants.push({
            label: `${provider}-amount-band-${i + 1}-enhanced`,
            imageData: prepareImageData(image, band, {
                sharpen: true, adaptiveContrast: true, invert: isDark,
            }),
            psm: 'amount',
        })

        variants.push({
            label: `${provider}-amount-band-${i + 1}-binary`,
            imageData: (() => {
                const c = drawUpscaledRegion(image, band)
                return binarizeCanvas(c, { invert: isDark })
            })(),
            psm: 'amount',
        })

        variants.push({
            label: `${provider}-amount-band-${i + 1}-inv`,
            imageData: prepareImageData(image, band, {
                sharpen: true, adaptiveContrast: true, invert: !isDark,
            }),
            psm: 'amount',
        })
    }

    return variants
}

// ─── Scoring ────────────────────────────────────────────────────────────────

function scoreText(text: string, confidence: number): number {
    let s = confidence
    if (/₹|\brs\b|\binr\b/i.test(text)) s += 20
    if (/\d+(?:\.\d{1,2})\b/.test(text)) s += 8
    if (/paid|received|debited|credited|completed|successful/i.test(text)) s += 10
    if (/transaction id|upi|utr|rrn/i.test(text)) s += 6
    s += Math.min(20, receiptQualityScore(text))
    return s
}

function scoreAmountBandText(text: string, confidence: number): number {
    let s = confidence
    if (/₹|\brs\b|\binr\b/i.test(text)) s += 28
    if (/\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?/.test(text)) s += 20
    if (/^\s*(?:₹|rs)?[\d,]+(?:\.\d{1,2})?\s*$/i.test(text.trim())) s += 32
    if (/completed|paid|received/.test(text.toLowerCase())) s += 5
    if (text.trim().length <= 32) s += 6
    return s
}

// ─── Ensemble merge ─────────────────────────────────────────────────────────

/**
 * Instead of naïve line-dedup, rank all variants by score and build the
 * merged text by selecting lines from highest-scored variants first,
 * skipping exact duplicates.
 */
function ensembleMerge(results: OcrVariantResult[]): string {
    const sorted = [...results].sort((a, b) => b.score - a.score)
    const seen = new Set<string>()
    const out: string[] = []

    for (const r of sorted) {
        for (const line of normalizeOcrText(r.text).split('\n')) {
            const trimmed = line.trim()
            if (!trimmed) continue
            const key = trimmed.toLowerCase().replace(/\s+/g, ' ')
            if (seen.has(key)) continue
            seen.add(key)
            out.push(trimmed)
        }
    }

    return out.join('\n')
}

function extractLikelyAmount(text: string): number | null {
    const normalized = normalizeOcrTextForAmount(text)
    const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean)

    // Exact-format line (e.g. "₹41" or "Rs 1,250.00")
    const exactLine = lines.find(l =>
        /^(?:₹|rs\.?|inr)?\s*[\d,]+(?:\.\d{1,2})?$/i.test(l)
    )
    if (exactLine) {
        const m = exactLine.match(/[\d,]+(?:\.\d{1,2})?/)
        if (m) {
            const v = parseFloat(m[0].replace(/,/g, ''))
            if (isFinite(v) && v > 0 && v <= 200_000) return v
        }
    }

    const directMatch = normalized.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i)
    if (directMatch?.[1]) {
        const v = parseFloat(directMatch[1].replace(/,/g, ''))
        if (isFinite(v) && v > 0 && v <= 200_000) return v
    }

    return null
}

// ─── Variant runner ─────────────────────────────────────────────────────────

async function runVariants(
    worker: any,
    variants: OcrVariant[],
    earlyExitPredicate?: (text: string, score: number) => boolean
): Promise<OcrVariantResult[]> {
    const results: OcrVariantResult[] = []

    for (const variant of variants) {
        const isAmount = variant.psm === 'amount'
        const params = isAmount ? AMOUNT_PARAMS
            : variant.psm === 'block' ? BLOCK_PARAMS
                : DEFAULT_PARAMS

        await worker.setParameters(params)
        const { data } = await worker.recognize(variant.imageData)
        const text = normalizeOcrText(data.text ?? '')
        const score = isAmount
            ? scoreAmountBandText(text, data.confidence)
            : scoreText(text, data.confidence)

        results.push({ label: variant.label, text, confidence: data.confidence, score })

        if (earlyExitPredicate?.(text, score)) break
    }

    await worker.setParameters(DEFAULT_PARAMS)
    return results
}

// ─── Parsed amount candidate ─────────────────────────────────────────────────

function getAmountBandIndex(label: string): number | null {
    const m = label.match(/amount-band-(\d+)/i)
    return m ? parseInt(m[1]!, 10) : null
}

function getAmountBandPositionBonus(label: string, provider: ProviderKind): number {
    const idx = getAmountBandIndex(label)
    if (!idx) return 0
    const ideal: Record<ProviderKind, number> = {
        gpay: 6, phonepe: 3, paytm: 4,
        generic_upi: 3, unknown_provider: 3,
    }
    return Math.max(0, 22 - Math.abs(idx - (ideal[provider] ?? 3)) * 4)
}

function scoreParsedAmountCandidate(
    result: OcrVariantResult,
    provider: ProviderKind
): { amount: number; text: string; label: string; confidence: number; score: number } | null {
    const normalized = normalizeOcrTextForAmount(result.text)
    const amount = extractLikelyAmount(normalized)
    if (amount === null) return null

    let score = result.score + getAmountBandPositionBonus(result.label, provider)
    const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean)
    const exactLine = lines.find(l => /^(?:₹|rs\.?|inr)?\s*[\d,]+(?:\.\d{1,2})?$/i.test(l)) ?? ''

    if (exactLine) score += 40
    if (/^(?:₹|rs\.?|inr)/i.test(exactLine)) score += 28
    if (lines.length === 1) score += 14
    if (lines.length > 2) score -= 18
    if (amount < 100 && !/^(?:₹|rs\.?|inr)/i.test(exactLine)) score -= 10
    if (/\d{8,}/.test(normalized)) score -= 24
    if (/[A-Za-z]{2,}/.test(normalized.replace(/\b(?:rs|inr)\b/gi, '').replace(/[₹\d\s.,]/g, ''))) score -= 22
    if ((exactLine || normalized).length <= 10) score += 12

    return { amount, text: normalized, label: result.label, confidence: result.confidence, score }
}

// ─── Public composable ───────────────────────────────────────────────────────

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
            const results = await runVariants(worker, variants)

            return {
                text: ensembleMerge(results),
                confidence: Math.max(...results.map(r => r.confidence), 0),
            }
        } catch (e) {
            console.error('Tesseract error:', e)
            error.value = e instanceof Error ? e.message : 'OCR failed'
            return null
        } finally {
            isProcessing.value = false
        }
    }

    async function recognizeProviderAmountRegion(
        imageData: string,
        provider: ProviderKind
    ): Promise<OcrResult | null> {
        if (provider === 'unknown_provider') return null

        try {
            const worker = await getWorker()
            const [providerVariants, amountBandVariants] = await Promise.all([
                prepareProviderVariants(imageData, provider),
                prepareAmountBandVariants(imageData, provider),
            ])

            const providerResults = providerVariants.length
                ? await runVariants(worker, providerVariants)
                : []

            const amountResults = amountBandVariants.length
                ? await runVariants(worker, amountBandVariants, (text, score) => {
                    const normalized = normalizeOcrTextForAmount(text)
                    const amount = extractLikelyAmount(normalized)
                    const exactLine = normalized.split('\n').map(l => l.trim())
                        .find(l => /^(?:₹|rs\.?|inr)\s*\d[\d,]*(?:\.\d{1,2})?$/i.test(l))
                    return score >= 140 && amount !== null && !!exactLine
                })
                : []

            // Rank amount candidates
            const parsedCandidates = amountResults
                .map(r => scoreParsedAmountCandidate(r, provider))
                .filter((c): c is NonNullable<typeof c> => c !== null)
                .sort((a, b) => b.score - a.score)

            const bestAmount = parsedCandidates[0]?.amount ?? null
            const curatedTexts = bestAmount
                ? parsedCandidates
                    .filter(c => c.score >= (parsedCandidates[0]!.score - 20))
                    .slice(0, 2)
                    .map(c => c.text)
                : []

            const merged = ensembleMerge([
                ...providerResults,
                ...amountResults,
            ])

            const stitched = bestAmount
                ? `Amount ${RUPEE}${bestAmount}\n${merged}`
                : merged

            if (!stitched.trim()) return null

            return {
                text: stitched,
                confidence: Math.max(
                    ...[...providerResults, ...amountResults].map(r => r.confidence),
                    0
                ),
            }
        } catch (e) {
            console.error('Provider OCR error:', e)
            return null
        }
    }

    /**
     * Compute a sharpness score (0–100) for an image DataURL.
     * Used by scan.vue to warn the user before OCR runs.
     */
    async function getImageSharpness(imageData: string): Promise<number> {
        try {
            const image = await loadImage(imageData)
            const canvas = drawUpscaledRegion(image, { x: 0, y: 0, width: 1, height: 1, scale: 1 })
            const raw = computeSharpness(canvas)
            return Math.min(100, Math.round(raw * 2))
        } catch {
            return 50  // assume ok if we can't compute
        }
    }

    async function terminate() {
        if (workerInstance) {
            await workerInstance.terminate()
            workerInstance = null
            initPromise = null
        }
    }

    return {
        isProcessing,
        ocrProgress,
        error,
        recognize,
        recognizeProviderAmountRegion,
        getImageSharpness,
        terminate,
    }
}
