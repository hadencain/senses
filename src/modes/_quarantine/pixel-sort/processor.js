// Sample N vertical columns, compute per-column brightness profile.
// Returns columns: array of { brightness, variance, peak } for each sampled column.

const COLS = 32
const ROWS = 48

export function analyzeColumns(frame) {
  'worklet'
  const buf = frame.toArrayBuffer()
  const data = new Uint8Array(buf)
  const W = frame.width
  const H = frame.height
  const stride = frame.bytesPerRow

  const columns = new Array(COLS)

  for (let c = 0; c < COLS; c++) {
    const px = Math.floor((c / COLS) * W)
    let sum = 0
    let peak = 0
    let peakRow = 0

    const samples = new Array(ROWS)
    for (let r = 0; r < ROWS; r++) {
      const py = Math.floor((r / ROWS) * H)
      const y = data[py * stride + px] / 255
      samples[r] = y
      sum += y
      if (y > peak) { peak = y; peakRow = r }
    }

    const mean = sum / ROWS
    let variance = 0
    for (let r = 0; r < ROWS; r++) variance += (samples[r] - mean) ** 2
    variance /= ROWS

    columns[c] = { brightness: mean, variance, peak, peakRow: peakRow / ROWS }
  }

  return columns
}
