import { Skia } from '@shopify/react-native-skia'

// Parametric bloom — render gets no previous-frame texture, so "self-doubling /
// light eating itself" is approximated inside the shader: a core lobe plus a
// super-linear (gain^2) secondary lobe. Strength = feedbackGain * bloom.
// Uniform order (flat array passed to makeShader): resolution.xy, gain, accent.rgb
const SKSL = `
uniform float2 resolution;
uniform float gain;
uniform float3 accent;
half4 main(float2 fragCoord) {
  float2 uv = fragCoord / resolution;
  float2 c = uv - 0.5;
  c.x *= resolution.x / resolution.y;
  float d = length(c);
  float core = exp(-d * d * mix(40.0, 6.0, gain)) * gain;
  float doubling = exp(-d * d * mix(80.0, 10.0, gain)) * gain * gain;
  float b = core + doubling * 1.5;
  b = clamp(b, 0.0, 1.0);
  float3 col = mix(accent, float3(1.0, 1.0, 1.0), b);
  return half4(col * b, b);
}
`

const effect = Skia.RuntimeEffect.Make(SKSL)

// accent #e0556a -> normalized rgb
const ACCENT = [0xe0 / 255, 0x55 / 255, 0x6a / 255]

export function makePicture({ features, params, dims }) {
  'worklet'
  const { width, height } = dims
  const recorder = Skia.PictureRecorder()
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height))

  if (effect) {
    const gain = Math.max(0, Math.min(1, (features.feedbackGain ?? 0) * (params.bloom ?? 0.6)))
    if (gain > 0.001) {
      const paint = Skia.Paint()
      const shader = effect.makeShader([width, height, gain, ACCENT[0], ACCENT[1], ACCENT[2]])
      paint.setShader(shader)
      canvas.drawRect(Skia.XYWHRect(0, 0, width, height), paint)
    }
  }

  return recorder.finishRecordingAsPicture()
}
