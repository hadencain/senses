// Pure, worklet-safe control law for Redaction. No RN / worklet-runtime deps.
// 'worklet' on each (processor + synth call in) but plain math — unit-tested in
// Node via dsp.test.cjs.
//
// The mechanic: a per-cell pressure field that attacks fast on local motion and
// bleeds slowly on stillness. High pressure censors the frame; decay heals it.

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

// Mean signed delta between two equal-length grids. Subtracting this per cell
// makes a global luma shift (auto-exposure / camera shake) read ~0 — only
// LOCAL motion (things moving within the scene) counts.
export function meanDelta(grid, prev) {
  'worklet'
  if (!prev || prev.length !== grid.length || grid.length === 0) return 0
  let s = 0
  for (let i = 0; i < grid.length; i++) s += grid[i] - prev[i]
  return s / grid.length
}

// One pressure step: bleed (slow heal), then add this frame's motion (fast
// attack). Clamped to [0,1] — 1 = fully censored cell.
export function pressureStep(p, motion, attack, leak) {
  'worklet'
  const next = p * (1 - leak) + motion * attack
  return next < 0 ? 0 : next > 1 ? 1 : next
}

export function meanArr(arr) {
  'worklet'
  const n = arr.length
  if (!n) return 0
  let s = 0
  for (let i = 0; i < n; i++) s += arr[i]
  return s / n
}

export function maxArr(arr) {
  'worklet'
  let m = 0
  for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i]
  return m
}

// sensitivity 0..1 -> attack gain. Higher = motion censors more readily.
export function sensToAttack(s) {
  'worklet'
  return lerp(2, 10, clamp01(s))
}

// heal 0..1 -> per-frame leak. Higher = the frame recovers faster.
export function healToLeak(h) {
  'worklet'
  return lerp(0.003, 0.03, clamp01(h))
}

// Three square-wave frequencies: base and ±grind Hz. The spread sets the
// roughness of the gated buzz.
export function detuneTriple(base, grind) {
  'worklet'
  return [base, base + grind, base - grind]
}

// Audio gate: silent at zero coverage, full level when fully censored.
export function gateGain(level, coverage) {
  'worklet'
  const g = level * clamp01(coverage)
  return g < 0 ? 0 : g > 1 ? 1 : g
}
