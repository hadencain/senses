// Pure, worklet-safe control law for Striate. No RN / worklet-runtime deps.
// 'worklet' on each but plain math — unit-tested in Node via dsp.test.cjs.
//
// Striate reads the grain of the scene: a magnitude-weighted histogram of edge
// orientations. A single sharp peak = "the world has a grain" (low entropy);
// a flat histogram = noise (high entropy). Order and noise are one axis.

export const NB = 8           // orientation buckets over [0, π)
export const PI = Math.PI

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

export function emaStep(prev, cur, alpha) {
  'worklet'
  return prev + (cur - prev) * alpha
}

// grain orientation (radians, [0,π)) -> bucket index [0, nb)
export function binOf(theta, nb) {
  'worklet'
  let t = theta % PI
  if (t < 0) t += PI
  let b = Math.floor((t / PI) * nb)
  if (b < 0) b = 0
  if (b >= nb) b = nb - 1
  return b
}

// bucket center angle (radians)
export function bucketCenter(b, nb) {
  'worklet'
  return (b + 0.5) * (PI / nb)
}

// Normalized Shannon entropy of a histogram: flat -> 1, single spike -> 0.
export function histEntropyNorm(hist) {
  'worklet'
  const n = hist.length
  let sum = 0
  for (let i = 0; i < n; i++) sum += hist[i] > 0 ? hist[i] : 0
  if (sum <= 0) return 1            // nothing -> maximal disorder (noise)
  let h = 0
  for (let i = 0; i < n; i++) {
    const p = (hist[i] > 0 ? hist[i] : 0) / sum
    if (p > 0) h -= p * Math.log(p)
  }
  const hmax = Math.log(n)
  return hmax > 0 ? clamp01(h / hmax) : 0
}

// floor 0..1 -> gradient magnitude threshold
export function floorToThresh(f) {
  'worklet'
  return lerp(0.02, 0.2, clamp01(f))
}

// smooth 0..1 -> EMA alpha (higher smooth = more smoothing = lower alpha)
export function smoothToAlpha(s) {
  'worklet'
  return lerp(0.5, 0.05, clamp01(s))
}

// grain orientation [0,π) -> base pitch 110..220 Hz
export function angleToPitch(theta) {
  'worklet'
  let t = theta % PI
  if (t < 0) t += PI
  return lerp(110, 220, t / PI)
}

// detune offset for oscillator i (0..4) given spread Hz and entropy 0..1.
// i=2 is the center; entropy 0 -> all unison.
export function detuneAt(i, spread, ent) {
  'worklet'
  return (i - 2) * 0.5 * spread * clamp01(ent)
}

// Parabolic sub-bucket peak offset in (-0.5, 0.5) from three samples around the
// peak. Centered samples -> 0; skew -> signed offset toward the higher side.
export function parabolicDelta(hm1, h0, hp1) {
  'worklet'
  const denom = hm1 - 2 * h0 + hp1
  if (denom === 0) return 0
  let d = 0.5 * (hm1 - hp1) / denom
  if (d < -0.5) d = -0.5
  if (d > 0.5) d = 0.5
  return d
}

// Circular local maxima of a histogram, value >= frac*max, up to k, strongest
// first. Returns bucket indices.
export function topPeaks(hist, k, frac) {
  'worklet'
  const n = hist.length
  let max = 0
  for (let i = 0; i < n; i++) if (hist[i] > max) max = hist[i]
  if (max <= 0) return []
  const thr = frac * max
  const peaks = []
  for (let i = 0; i < n; i++) {
    const v = hist[i]
    if (v < thr) continue
    const l = hist[(i - 1 + n) % n]
    const r = hist[(i + 1) % n]
    if (v >= l && v >= r) peaks.push(i)
  }
  // sort by value desc, take k
  peaks.sort((a, b) => hist[b] - hist[a])
  return peaks.slice(0, k)
}
