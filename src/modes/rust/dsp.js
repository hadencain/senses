// Pure, worklet-safe control law for Rust. No RN / worklet-runtime deps.
// 'worklet' on each (processor + synth call into these) but plain math —
// unit-tested in Node via dsp.test.cjs.
//
// The mechanic: a per-cell accumulator that adds local activity every frame and
// NEVER resets — it only leaks, very slowly. Busy regions climb toward a high
// equilibrium (activity / leak); regions that go still decay back over minutes.
// The contrast between them is the rust.

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

// One leaky-accumulator step. Adds this frame's activity, bleeds a tiny
// fraction. leak ~0.0002 => ~minutes to heal. Never goes negative.
export function accumStep(acc, activity, leak) {
  'worklet'
  const next = acc * (1 - leak) + activity
  return next < 0 ? 0 : next
}

// Map an unbounded accumulator value to an oxidation amount in [0,1).
// Saturating exponential: clean at 0, asymptotes to full rust. k sets how fast
// accumulated activity tips into rust (contrast).
export function oxidize(acc, k) {
  'worklet'
  if (acc <= 0) return 0
  const o = 1 - Math.exp(-k * acc)
  return o < 0 ? 0 : o > 1 ? 1 : o
}

// heal slider 0..1 -> leak alpha. Higher heal = faster bleed = rust fades sooner.
export function healToLeak(heal) {
  'worklet'
  return lerp(0.00005, 0.001, clamp01(heal))
}

// bite slider 0..1 -> oxidation rate k. Higher bite = corrodes on less activity.
export function biteToK(bite) {
  'worklet'
  return lerp(0.006, 0.02, clamp01(bite))
}

// Gradient magnitude at grid cell (gx,gy) from a flat size*size luma grid (0..1).
// Forward-difference against right/down neighbours; clamps at edges. Cheap Sobel
// stand-in over the coarse grid — enough to make textured/edge-heavy regions
// register activity even when nothing is moving.
export function edgeMagAt(grid, gx, gy, size) {
  'worklet'
  const i = gy * size + gx
  const rx = gx + 1 < size ? grid[i + 1] : grid[i]
  const dy = gy + 1 < size ? grid[i + size] : grid[i]
  const dxv = rx - grid[i]
  const dyv = dy - grid[i]
  const m = Math.sqrt(dxv * dxv + dyv * dyv)
  return m < 0 ? 0 : m
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

// Global rust sum -> drone frequency. The pair sags DOWNWARD over a take: the
// more the room has corroded, the more the pitch sinks. sag 0..1 = how far it
// drops (at full rust + full sag, down to half the base = one octave).
export function sagFreq(base, rustSum, sag) {
  'worklet'
  const drop = clamp01(rustSum) * clamp01(sag) * 0.5
  return base * (1 - drop)
}
