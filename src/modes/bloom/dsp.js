// Pure, worklet-safe control law for Bloom. No RN / worklet-runtime deps.
// 'worklet' on each but plain math — unit-tested in Node via dsp.test.cjs.
//
// The mechanic: a per-cell light buffer. A stir snaps a cell bright; it then
// decays slowly back to black. Brightness encodes recency, which the render
// reads as cool (fresh) -> warm (dying).

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

// Mean signed delta — subtracting it per cell gives global-shift / shake
// immunity, so only local motion (things moving in the scene) stirs the light.
export function meanDelta(grid, prev) {
  'worklet'
  if (!prev || prev.length !== grid.length || grid.length === 0) return 0
  let s = 0
  for (let i = 0; i < grid.length; i++) s += grid[i] - prev[i]
  return s / grid.length
}

// One light step: the brighter of (decayed previous) and (this stir). A strong
// stir snaps to full; gentle motion adds a little; stillness lets it fade.
export function lightStep(light, motion, decay, gain) {
  'worklet'
  const stir = motion * gain
  const decayed = light * decay
  const v = decayed > stir ? decayed : stir
  return v < 0 ? 0 : v > 1 ? 1 : v
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

// fade 0..1 -> per-frame decay multiplier. Higher = slower fade = longer glow.
export function fadeToDecay(f) {
  'worklet'
  return lerp(0.90, 0.99, clamp01(f))
}

// bright 0..1 -> injection gain on motion. Higher = lights on less motion.
export function brightToGain(b) {
  'worklet'
  return lerp(2, 8, clamp01(b))
}

// dark 0..1 -> alpha of the black overlay. Higher = room more hidden.
export function darkToAlpha(d) {
  'worklet'
  return lerp(0.60, 0.98, clamp01(d))
}

// disturbance vertical position 0..1 (top..bottom) -> grain pitch ratio.
// Top of frame is higher pitched.
export function yToPitch(y) {
  'worklet'
  return lerp(2.0, 0.5, clamp01(y))
}
