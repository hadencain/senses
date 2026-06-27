import { Skia, PaintStyle } from '@shopify/react-native-skia'

// Accreting opaque-black shards. The 64-cell `features.pressure` field reaches
// here via featuresSV (set in the frame processor) — no JS bridge. Each
// pressured cell stamps a few opaque fragments whose count/size/alpha scale with
// pressure; positions are hashed-stable so coverage holds and visibly heals as
// pressure decays, rather than sizzling. Fresh (high-pressure) cells get a thin
// oxblood edge. Clean cells draw nothing — the camera shows through.

const GRID = 8
const N = GRID * GRID
const ACCENT = [138, 32, 48]   // #8a2030

function hash(i) {
  'worklet'
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function makePicture({ features, dims }) {
  'worklet'
  const { width, height } = dims
  const recorder = Skia.PictureRecorder()
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height))

  const pressure = features.pressure
  if (!pressure || pressure.length !== N) return recorder.finishRecordingAsPicture()

  const cellW = width / GRID
  const cellH = height / GRID
  const black = Skia.Paint()
  const edge = Skia.Paint()
  edge.setStyle(PaintStyle.Stroke)
  edge.setStrokeWidth(Math.max(1, cellW * 0.03))

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const i = gy * GRID + gx
      const p = pressure[i]
      if (p < 0.03) continue

      const x0 = gx * cellW
      const y0 = gy * cellH
      const shards = 1 + Math.floor(p * 4)   // 1..5
      const alpha = (0.25 + p * 0.75).toFixed(3)
      black.setColor(Skia.Color(`rgba(0,0,0,${alpha})`))

      for (let j = 0; j < shards; j++) {
        const h1 = hash(i * 7 + j)
        const h2 = hash(i * 13 + j + 1)
        const h3 = hash(i * 17 + j + 2)
        // aspect varies between thin bar and block; size grows with pressure
        const wide = 0.4 + h3 * 0.6
        const sw = cellW * wide * (0.4 + p * 0.6)
        const sh = cellH * (1 - wide * 0.7) * (0.4 + p * 0.6)
        const sx = x0 + h1 * (cellW - sw)
        const sy = y0 + h2 * (cellH - sh)
        canvas.drawRect(Skia.XYWHRect(sx, sy, sw, sh), black)
      }

      // fresh censorship gets an oxblood edge
      if (p > 0.7) {
        const ea = ((p - 0.7) * 2).toFixed(3)
        edge.setColor(Skia.Color(`rgba(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]},${ea})`))
        canvas.drawRect(Skia.XYWHRect(x0, y0, cellW, cellH), edge)
      }
    }
  }

  return recorder.finishRecordingAsPicture()
}
