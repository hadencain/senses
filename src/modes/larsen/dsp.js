// Pure, worklet-safe control law for Larsen. No RN / worklet-runtime deps.
// Every fn carries 'worklet' (called from the frame processor) but is plain
// math — unit-tested in Node via dsp.test.cjs.

export function lerp(a, b, t) {
  'worklet'
  if (t === 0) return a
  if (t === 1) return b
  return a + (b - a) * t
}

export function emaStep(prev, next, alpha) {
  'worklet'
  return prev + (next - prev) * alpha
}

// Mean absolute LOCAL delta between two equal-length coarse luma grids (0..1
// samples). Subtracting the mean delta makes a global luma shift (auto-exposure
// / lighting flicker) read ~0 — only spatially local change counts.
export function computeMotion(grid, prev) {
  'worklet'
  if (!prev || prev.length !== grid.length || grid.length === 0) return 0
  let sumD = 0
  for (let i = 0; i < grid.length; i++) sumD += grid[i] - prev[i]
  const meanD = sumD / grid.length
  let acc = 0
  for (let i = 0; i < grid.length; i++) {
    const d = (grid[i] - prev[i]) - meanD
    acc += d < 0 ? -d : d
  }
  return acc / grid.length
}

export function mapSensitivity(sensitivity) {
  'worklet'
  return lerp(0.04, 0.005, sensitivity)
}

export function mapBuildSeconds(build) {
  'worklet'
  return lerp(12, 1.5, build)
}

export function updateGain(gain, motionEMA, dt, sensitivity, build) {
  'worklet'
  const thresh = mapSensitivity(sensitivity)
  let g = gain
  if (motionEMA < thresh) {
    g += dt / mapBuildSeconds(build)   // build toward 1
  } else {
    g -= dt * 8                        // slam toward 0 (~125 ms full)
  }
  return g < 0 ? 0 : g > 1 ? 1 : g
}

export function gainToMaster(gain, ceiling) {
  'worklet'
  const cap = ceiling > 0.6 ? 0.6 : ceiling
  const m = cap * gain
  return m < 0 ? 0 : m > cap ? cap : m
}
