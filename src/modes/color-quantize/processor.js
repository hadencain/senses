// Sample RGB at a coarse grid, find 4 dominant hue clusters.
// Returns dominantColors: array of { r, g, b, weight } sorted by weight desc.

const GRID = 20
const BUCKETS = 8 // hue buckets (360 / BUCKETS degrees each)

function rgbToHue(r, g, b) {
  'worklet'
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 0
  let h
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return ((h * 60) + 360) % 360
}

export function quantizeColors(frame) {
  'worklet'
  const buf = frame.toArrayBuffer()
  const data = new Uint8Array(buf)
  const W = frame.width
  const H = frame.height
  const stride = frame.bytesPerRow

  // rgba frame: pixelFormat="rgb" on Camera gives RGBA packed
  const bpp = Math.floor(stride / W) // bytes per pixel (3 or 4)

  const hueBuckets = new Array(BUCKETS).fill(0)
  const bucketR = new Array(BUCKETS).fill(0)
  const bucketG = new Array(BUCKETS).fill(0)
  const bucketB = new Array(BUCKETS).fill(0)

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const px = Math.floor((gx / GRID) * W)
      const py = Math.floor((gy / GRID) * H)
      const idx = py * stride + px * bpp
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]

      const hue = rgbToHue(r / 255, g / 255, b / 255)
      const bucket = Math.floor((hue / 360) * BUCKETS) % BUCKETS
      hueBuckets[bucket]++
      bucketR[bucket] += r
      bucketG[bucket] += g
      bucketB[bucket] += b
    }
  }

  const total = GRID * GRID
  const colors = []
  for (let i = 0; i < BUCKETS; i++) {
    if (hueBuckets[i] === 0) continue
    const n = hueBuckets[i]
    colors.push({
      r: Math.floor(bucketR[i] / n),
      g: Math.floor(bucketG[i] / n),
      b: Math.floor(bucketB[i] / n),
      weight: n / total,
      hue: (i / BUCKETS) * 360,
    })
  }

  colors.sort((a, b) => b.weight - a.weight)
  return colors.slice(0, 4)
}
