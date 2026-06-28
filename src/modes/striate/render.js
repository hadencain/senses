import { Skia, PaintStyle } from '@shopify/react-native-skia'

// A comb per prominent grain orientation. Spacing tightens with density; line
// opacity is weight·coherence (1−entropy). As entropy rises each line gains
// angle scatter and a wavering midpoint, so an ordered grain reads as crisp
// parallel ranks and noise reads as a faded, scattered tangle. Primitive Path
// strokes (proven); SkSL photographic version is a v2 follow-up.

const MAX_LINES = 60   // per comb, budget cap

function hash(i) {
  'worklet'
  const x = Math.sin(i * 12.9898 + 7.13) * 43758.5453
  return x - Math.floor(x)
}

export function makePicture({ features, params, dims }) {
  'worklet'
  const { width, height } = dims
  const recorder = Skia.PictureRecorder()
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height))

  const angles = features.angles
  const weights = features.weights
  if (!angles || !angles.length) return recorder.finishRecordingAsPicture()

  const entropy = features.entropy ?? 1
  const density = features.density ?? 0
  const coherence = 1 - entropy
  const cx = width / 2
  const cy = height / 2
  const minDim = width < height ? width : height
  const diag = Math.sqrt(width * width + height * height)
  const linesScale = params.lines ?? 1

  // tighter spacing as density rises
  const spacing = Math.max(
    minDim * 0.02,
    (minDim * 0.12) / (0.3 + density * 1.7) / linesScale,
  )
  let nLines = Math.floor(diag / spacing)
  if (nLines > MAX_LINES) nLines = MAX_LINES
  const half = Math.floor(nLines / 2)

  const paint = Skia.Paint()
  paint.setStyle(PaintStyle.Stroke)
  paint.setStrokeWidth(Math.max(1, minDim * 0.004))
  const path = Skia.Path.Make()

  for (let k = 0; k < angles.length; k++) {
    const w = weights[k] ?? 0
    const alpha = Math.max(0, Math.min(1, w * 2)) * coherence * 0.9
    if (alpha < 0.02) continue
    paint.setColor(Skia.Color(`rgba(159,180,192,${alpha.toFixed(3)})`))

    for (let n = -half; n <= half; n++) {
      const seed = (k + 1) * 131 + (n + half)
      // per-line angle scatter grows with entropy
      const a = angles[k] + (hash(seed) - 0.5) * entropy * 0.6
      const dx = Math.cos(a), dy = Math.sin(a)
      const nx = -Math.sin(a), ny = Math.cos(a)
      const off = n * spacing
      const ox = cx + nx * off, oy = cy + ny * off
      // wavering midpoint offset along the normal, grows with entropy
      const wav = (hash(seed + 53) - 0.5) * entropy * spacing * 1.5
      const mx = ox + nx * wav, my = oy + ny * wav

      path.reset()
      path.moveTo(ox - dx * diag, oy - dy * diag)
      path.lineTo(mx, my)
      path.lineTo(ox + dx * diag, oy + dy * diag)
      canvas.drawPath(path, paint)
    }
  }

  return recorder.finishRecordingAsPicture()
}
