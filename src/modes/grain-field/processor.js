// Sample Y-plane brightness at a coarse grid. Returns [0..1].
export function sampleBrightness(frame) {
  'worklet'
  const buf = frame.toArrayBuffer()
  const data = new Uint8Array(buf)
  const W = frame.width
  const stride = frame.bytesPerRow
  const GRID = 16
  let sum = 0
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const px = Math.floor((gx / GRID) * W)
      const py = Math.floor((gy / GRID) * frame.height)
      sum += data[py * stride + px]
    }
  }
  return sum / (GRID * GRID * 255)
}

// Returns variance across the grid — high variance = complex scene.
export function sampleVariance(frame) {
  'worklet'
  const buf = frame.toArrayBuffer()
  const data = new Uint8Array(buf)
  const W = frame.width
  const stride = frame.bytesPerRow
  const GRID = 16
  const N = GRID * GRID
  let sum = 0
  const samples = new Array(N)
  let i = 0
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const px = Math.floor((gx / GRID) * W)
      const py = Math.floor((gy / GRID) * frame.height)
      const v = data[py * stride + px] / 255
      samples[i++] = v
      sum += v
    }
  }
  const mean = sum / N
  let variance = 0
  for (let j = 0; j < N; j++) variance += (samples[j] - mean) ** 2
  return variance / N
}

export function extractFeatures(frame) {
  'worklet'
  return {
    brightness: sampleBrightness(frame),
    variance: sampleVariance(frame),
  }
}
