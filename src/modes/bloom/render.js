import { Skia } from '@shopify/react-native-skia'

// Bloom render: hide the room behind a black overlay, then paint the glow buffer
// on top. The 64-cell `features.light` reaches here via featuresSV (no JS
// bridge). Each lit cell is a soft 2-ring blotch (Rust-style) coloured by its
// light value: bright/fresh = cool cyan, dim/dying = warm amber. Normal blend
// (additive is a v2 follow-up — BlendMode.Plus is unproven here). darkToAlpha
// inlined to keep render free of cross-module worklet imports.

const GRID = 8
const N = GRID * GRID

// light 0..1 -> rgb. cyan (fresh) -> pale -> amber (dying)
function ramp(o) {
  'worklet'
  const cyan = [90, 230, 220]
  const pale = [170, 240, 180]
  const amber = [235, 150, 70]
  let a, b, t
  if (o >= 0.5) { a = pale; b = cyan; t = (o - 0.5) / 0.5 }
  else { a = amber; b = pale; t = (o - 0.15) / 0.35 }
  const tc = t < 0 ? 0 : t > 1 ? 1 : t
  return [
    Math.round(a[0] + (b[0] - a[0]) * tc),
    Math.round(a[1] + (b[1] - a[1]) * tc),
    Math.round(a[2] + (b[2] - a[2]) * tc),
  ]
}

export function makePicture({ features, params, dims }) {
  'worklet'
  const { width, height } = dims
  const recorder = Skia.PictureRecorder()
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height))

  // black overlay — camera hidden behind it (inlined darkToAlpha lerp)
  const dark = params.dark ?? 0.6
  const darkAlpha = (0.60 + (0.98 - 0.60) * (dark < 0 ? 0 : dark > 1 ? 1 : dark)).toFixed(3)
  const veil = Skia.Paint()
  veil.setColor(Skia.Color(`rgba(0,0,0,${darkAlpha})`))
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), veil)

  const light = features.light
  if (!light || light.length !== N) return recorder.finishRecordingAsPicture()

  const cellW = width / GRID
  const cellH = height / GRID
  const baseR = Math.max(cellW, cellH) * 0.9
  const paint = Skia.Paint()

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const i = gy * GRID + gx
      const o = light[i]
      if (o < 0.02) continue

      const cx = (gx + 0.5) * cellW
      const cy = (gy + 0.5) * cellH
      const [r, g, b] = ramp(o)
      const radius = baseR * (0.5 + o * 0.7)

      const aOuter = (o * 0.4).toFixed(3)
      paint.setColor(Skia.Color(`rgba(${r},${g},${b},${aOuter})`))
      canvas.drawCircle(cx, cy, radius, paint)

      const aInner = (o * 0.9).toFixed(3)
      paint.setColor(Skia.Color(`rgba(${r},${g},${b},${aInner})`))
      canvas.drawCircle(cx, cy, radius * 0.45, paint)
    }
  }

  return recorder.finishRecordingAsPicture()
}
