// Pure, worklet-safe control law for Latent. No RN / worklet-runtime deps.
// 'worklet' on each but plain math — unit-tested in Node via dsp.test.cjs.
//
// The mechanic: a slow-EMA luma "plate" and a fast denoise EMA. The signed
// difference (current denoised − plate) is the developing ghost — bright where
// something changed recently, fading as the plate catches up over ~30 s.

export function lerp(a, b, t) {
  'worklet'
  if (t <= 0) return a
  if (t >= 1) return b
  return a + (b - a) * t
}

export function clamp01(v) {
  'worklet'
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function clampSigned(v) {
  'worklet'
  return v < -1 ? -1 : v > 1 ? 1 : v
}

export function emaStep(prev, cur, alpha) {
  'worklet'
  return prev + (cur - prev) * alpha
}

// Signed, contrast-scaled deviation of denoised current from the plate.
export function deviation(fast, slow, gain) {
  'worklet'
  return clampSigned((fast - slow) * gain)
}

// develop 0..1 -> plate EMA alpha. Higher = the plate catches up faster =
// ghosts fade sooner (shorter latent life).
export function developToAlpha(d) {
  'worklet'
  return lerp(0.001, 0.01, clamp01(d))
}

// contrast 0..1 -> deviation gain (visibility of the ghost).
export function contrastToGain(c) {
  'worklet'
  return lerp(2, 10, clamp01(c))
}

// peak-deviation vertical position 0..1 (top..bottom) -> fraction of the audio
// buffer to scrub. Top of frame = recent sound history (1), bottom = oldest (0).
export function yToBufferFrac(y) {
  'worklet'
  const v = 1 - clamp01(y)
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function meanAbs(arr) {
  'worklet'
  const n = arr.length
  if (!n) return 0
  let s = 0
  for (let i = 0; i < n; i++) { const v = arr[i]; s += v < 0 ? -v : v }
  return s / n
}

export function peakAbs(arr) {
  'worklet'
  let m = 0
  for (let i = 0; i < arr.length; i++) { const v = arr[i] < 0 ? -arr[i] : arr[i]; if (v > m) m = v }
  return m
}
