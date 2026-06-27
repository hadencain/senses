import { Skia } from '@shopify/react-native-skia'

// Latent render: paint only the signed deviation field. The 64-cell
// `features.dev` reaches here via featuresSV (no JS bridge). Positive deviation
// (something newly present / brighter than the plate) develops as silver;
// negative (something removed / darker than the plate) as bromide brown. Cells
// at/near the plate are transparent — the camera shows through. Soft 2-ring
// blotches (Rust/Bloom style); SkSL photographic version is the v2 follow-up.

const GRID = 8
const N = GRID * GRID
const SILVER = [220, 225, 230]
const BROMIDE = [120, 85, 55]

export function makePicture({ features, dims }) {
  'worklet'
  const { width, height } = dims
  const recorder = Skia.PictureRecorder()
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height))

  const dev = features.dev
  if (!dev || dev.length !== N) return recorder.finishRecordingAsPicture()

  const cellW = width / GRID
  const cellH = height / GRID
  const baseR = Math.max(cellW, cellH) * 0.85
  const paint = Skia.Paint()

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const i = gy * GRID + gx
      const d = dev[i]
      const mag = d < 0 ? -d : d
      if (mag < 0.03) continue

      const cx = (gx + 0.5) * cellW
      const cy = (gy + 0.5) * cellH
      const [r, g, b] = d > 0 ? SILVER : BROMIDE
      const radius = baseR * (0.5 + mag * 0.6)

      const aOuter = (mag * 0.4).toFixed(3)
      paint.setColor(Skia.Color(`rgba(${r},${g},${b},${aOuter})`))
      canvas.drawCircle(cx, cy, radius, paint)

      const aInner = (mag * 0.85).toFixed(3)
      paint.setColor(Skia.Color(`rgba(${r},${g},${b},${aInner})`))
      canvas.drawCircle(cx, cy, radius * 0.45, paint)
    }
  }

  return recorder.finishRecordingAsPicture()
}
