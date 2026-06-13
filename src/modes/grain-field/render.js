import { Skia } from '@shopify/react-native-skia'

const GRAIN_N = 60

export function makePicture({ features, motion, params, dims }) {
  'worklet'
  const { width, height } = dims
  const recorder = Skia.PictureRecorder()
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height))
  const paint = Skia.Paint()

  const spd = motion.speed
  const b = features.brightness ?? 0.5
  const vari = features.variance ?? 0
  const reach = 0.3 + (params.scatter ?? 0.6) * 0.7

  for (let i = 0; i < GRAIN_N; i++) {
    const t = i / GRAIN_N
    const cx = width * 0.5 + Math.cos(t * 37.4 + spd * 3) * (width * 0.45) * (reach * (0.4 + spd * 0.6))
    const cy = height * 0.5 + Math.sin(t * 29.1 + spd * 2) * (height * 0.45) * (reach * (0.4 + spd * 0.6))
    const sz = 2 + (1 - t) * 18 * (0.2 + vari * 2)
    const alpha = Math.max(0, Math.min(1, (0.05 + spd * 0.4) * (1 - t * 0.6)))

    const r = Math.floor(200 - spd * 100)
    const g = Math.floor(160 + b * 60)
    paint.setColor(Skia.Color(`rgba(${r},${g},180,${alpha.toFixed(2)})`))
    canvas.drawRect(Skia.XYWHRect(cx - sz / 2, cy - sz / 2, sz, sz * 0.4), paint)
  }

  return recorder.finishRecordingAsPicture()
}
