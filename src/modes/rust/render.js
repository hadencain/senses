import { Skia } from '@shopify/react-native-skia'

// Render the spatial oxidation field. The 64-cell `features.rust` grid reaches
// here via featuresSV (set in the frame processor, read by makePicture) — no JS
// bridge. Each corroded cell is drawn as a soft blotch (concentric falloff
// circles, no maskfilter dep) whose colour ramps clean -> patina -> rust ->
// flaking. Clean cells draw nothing, so the live camera shows through.
//
// Deliberately primitive (not SkSL): feeding a per-cell spatial field into a
// runtime shader needs dynamic-indexed uniform arrays or a data texture, both
// unproven in this build. The oxidation ramp below is the swap point for a
// future SkSL version once the accumulator is proven on-device.

const GRID = 8
const N = GRID * GRID

// oxidation 0..1 -> rgb along clean->patina->ochre->rust->flaking
function ramp(o) {
  'worklet'
  // stops: [pos, r, g, b]
  const s0 = [0.0, 110, 140, 106]   // patina green
  const s1 = [0.4, 201, 138, 58]    // ochre
  const s2 = [0.7, 181, 101, 29]    // rust
  const s3 = [1.0, 90, 52, 22]      // flaking dark
  let a = s0, b = s1
  if (o >= s2[0]) { a = s2; b = s3 }
  else if (o >= s1[0]) { a = s1; b = s2 }
  else if (o >= s0[0]) { a = s0; b = s1 }
  const span = b[0] - a[0]
  const t = span > 0 ? (o - a[0]) / span : 0
  const tc = t < 0 ? 0 : t > 1 ? 1 : t
  return [
    Math.round(a[1] + (b[1] - a[1]) * tc),
    Math.round(a[2] + (b[2] - a[2]) * tc),
    Math.round(a[3] + (b[3] - a[3]) * tc),
  ]
}

// deterministic per-cell pseudo-noise (breaks the grid alignment)
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

  const rust = features.rust
  if (!rust || rust.length !== N) return recorder.finishRecordingAsPicture()

  const paint = Skia.Paint()
  const cellW = width / GRID
  const cellH = height / GRID
  const baseR = Math.max(cellW, cellH) * 0.75

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const i = gy * GRID + gx
      const o = rust[i]
      if (o < 0.03) continue

      const h1 = hash(i)
      const h2 = hash(i + 97)
      // jitter the blotch centre within its cell so corrosion edges read organic
      const cx = (gx + 0.2 + h1 * 0.6) * cellW
      const cy = (gy + 0.2 + h2 * 0.6) * cellH
      const [r, g, b] = ramp(o)
      const radius = baseR * (0.7 + o * 0.6) * (0.8 + h1 * 0.4)

      // two-ring falloff = soft blotch without a maskfilter dependency
      const aOuter = (o * 0.45).toFixed(3)
      paint.setColor(Skia.Color(`rgba(${r},${g},${b},${aOuter})`))
      canvas.drawCircle(cx, cy, radius, paint)

      const aInner = (o * 0.7).toFixed(3)
      paint.setColor(Skia.Color(`rgba(${r},${g},${b},${aInner})`))
      canvas.drawCircle(cx, cy, radius * 0.5, paint)

      // a dark flake core only once a cell is well corroded
      if (o > 0.7) {
        const fa = ((o - 0.7) * 1.5).toFixed(3)
        paint.setColor(Skia.Color(`rgba(60,35,18,${fa})`))
        canvas.drawCircle(cx, cy, radius * 0.22, paint)
      }
    }
  }

  return recorder.finishRecordingAsPicture()
}
