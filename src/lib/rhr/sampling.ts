import { fingerPresent, type PpgSample } from './protocol'

/** Aggregate one real ROI frame. Spatial percentiles ignore isolated hot/dark pixels. */
export function samplePixels(pixels: Uint8ClampedArray, t: number): PpgSample {
  const hist = new Uint32Array(256)
  let r = 0,
    g = 0,
    b = 0,
    red = 0,
    green = 0,
    blue = 0,
    clipped = 0
  const n = pixels.length / 4
  for (let i = 0; i < pixels.length; i += 4) {
    r += pixels[i]
    g += pixels[i + 1]
    b += pixels[i + 2]
    hist[pixels[i]]++
    if (pixels[i] >= 252) red++
    if (pixels[i + 1] >= 252) green++
    if (pixels[i + 2] >= 252) blue++
    if (pixels[i] >= 252 && pixels[i + 1] >= 252 && pixels[i + 2] >= 252)
      clipped++
  }
  let cumulative = 0,
    low = -1,
    high = 255
  for (let i = 0; i < 256; i++) {
    cumulative += hist[i]
    if (low < 0 && cumulative >= n * 0.05) low = i
    if (cumulative >= n * 0.95) {
      high = i
      break
    }
  }
  return {
    t,
    r: r / n,
    g: g / n,
    b: b / n,
    clipped: clipped / n,
    spread: (high - Math.max(0, low)) / 255,
    redClipped: red / n,
    greenClipped: green / n,
    blueClipped: blue / n,
  }
}
export function sampleVideo(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  t: number,
  original = false,
) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context || video.readyState < 2 || !video.videoWidth) return null
  const side = Math.min(video.videoWidth, video.videoHeight) * 0.55
  try {
    context.drawImage(
      video,
      (video.videoWidth - side) / 2,
      (video.videoHeight - side) / 2,
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    )
    return (original ? sampleOriginalPixels : samplePixels)(
      context.getImageData(0, 0, canvas.width, canvas.height).data,
      t,
    )
  } catch {
    return null
  }
}
export function contactHint(s: PpgSample) {
  if (s.r < 35) return 'Too dark · Check the light and active lens'
  if (s.clipped >= 0.65) return 'Too bright · Reposition your fingertip gently'
  if (!fingerPresent(s))
    return 'Cover the active lens completely · Use light pressure'
  return 'Contact detected · Keep your hand still'
}
/** Presentation only: display the least clipped, varying real optical channel. */
export function opticalTrace(samples: PpgSample[]) {
  if (samples.length < 2) return ''
  const candidates = (['r', 'g', 'b'] as const)
    .map((key) => {
      const clip =
        key === 'r'
          ? 'redClipped'
          : key === 'g'
            ? 'greenClipped'
            : 'blueClipped'
      const center = samples.reduce((a, s) => a + s[key], 0) / samples.length
      const amplitude = Math.max(
        0.1,
        ...samples.map((s) => Math.abs(s[key] - center)),
      )
      const usable = samples.every((s) => s[key] < 250 && (s[clip] ?? 0) < 0.1)
      return { key, center, amplitude, score: usable ? amplitude : -1 }
    })
    .sort((a, b) => b.score - a.score)
  const { key, center, amplitude } = candidates[0]
  return samples
    .map(
      (s, i) =>
        `${(i * 300) / (samples.length - 1)},${40 - ((s[key] - center) / amplitude) * 26}`,
    )
    .join(' ')
}

/** Original 332c6f7 aggregation: red+green clipping and full red spatial range. */
export function sampleOriginalPixels(
  pixels: Uint8ClampedArray,
  t: number,
): PpgSample {
  let r = 0,
    g = 0,
    b = 0,
    clipped = 0,
    min = 255,
    max = 0
  for (let i = 0; i < pixels.length; i += 4) {
    r += pixels[i]
    g += pixels[i + 1]
    b += pixels[i + 2]
    if (pixels[i] >= 252 && pixels[i + 1] >= 252) clipped++
    min = Math.min(min, pixels[i])
    max = Math.max(max, pixels[i])
  }
  const n = pixels.length / 4
  return {
    t,
    r: r / n,
    g: g / n,
    b: b / n,
    clipped: clipped / n,
    spread: (max - min) / 255,
  }
}
export const sampleOriginalVideo = (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  t: number,
) => sampleVideo(video, canvas, t, true)
