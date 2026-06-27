import { Skia, PaintStyle } from '@shopify/react-native-skia'

// Two stroked circles, radius per half's brightness. They slide concentric as
// the frame balances (diff -> 0) and pull apart laterally when imbalanced.
// Inside the null zone a lock-glow appears and the circles breathe on
// features.breath; as unison nears the beat freezes and the breath stops.
// Primitive draws only (proven pattern) — lockThresh inlined to keep render
// free of cross-module worklet imports, matching larsen/rust render.

const ACCENT = [110, 168, 200]   // #6ea8c8

export function makePicture({ features, params, dims }) {
  'worklet'
  const { width, height } = dims
  const recorder = Skia.PictureRecorder()
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height))

  const L = features.L ?? 0.5
  const R = features.R ?? 0.5
  const diff = features.diff ?? 0
  const breath = features.breath ?? 0
  const absDiff = diff < 0 ? -diff : diff

  // lock param 0..1 -> null-zone half-width 0.01..0.08 (inlined lerp)
  const lock = params.lock ?? 0.5
  const thresh = 0.01 + (0.08 - 0.01) * (lock < 0 ? 0 : lock > 1 ? 1 : lock)
  const locked = absDiff < thresh
  const closeness = locked ? 1 - absDiff / thresh : 0   // 1 at perfect null

  const cx = width / 2
  const cy = height / 2
  const minDim = width < height ? width : height
  const sep = absDiff * width * 0.4
  const breathScale = 1 + breath * 0.06 * closeness

  const rA = minDim * (0.1 + L * 0.35) * breathScale
  const rB = minDim * (0.1 + R * 0.35) * breathScale

  // lock glow — a soft fill swelling at the null
  if (closeness > 0) {
    const glow = Skia.Paint()
    const ga = (closeness * 0.18).toFixed(3)
    glow.setColor(Skia.Color(`rgba(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]},${ga})`))
    canvas.drawCircle(cx, cy, (rA + rB) * 0.5, glow)
  }

  // strokes brighten toward white as the null is approached
  const r = Math.round(ACCENT[0] + (255 - ACCENT[0]) * closeness)
  const g = Math.round(ACCENT[1] + (255 - ACCENT[1]) * closeness)
  const b = Math.round(ACCENT[2] + (255 - ACCENT[2]) * closeness)
  const stroke = Skia.Paint()
  stroke.setStyle(PaintStyle.Stroke)
  stroke.setStrokeWidth(minDim * 0.006)
  stroke.setColor(Skia.Color(`rgba(${r},${g},${b},0.9)`))

  canvas.drawCircle(cx - sep, cy, rA, stroke)
  canvas.drawCircle(cx + sep, cy, rB, stroke)

  return recorder.finishRecordingAsPicture()
}
