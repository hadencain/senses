// Pure, worklet-safe control law for Zero Beat. No RN / worklet-runtime deps.
// 'worklet' on each (processor + synth call in) but plain math — unit-tested in
// Node via dsp.test.cjs.
//
// The instrument: balance the frame's left/right luma to null two summed sines
// to unison. The beat you hear IS the luma difference — beatHz = |diff*range|.

export const TWO_PI = Math.PI * 2

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

// Mean luma of the left vs right half of a flat size*size grid (0..1 samples).
// Columns gx < size/2 are left, the rest right. Returns [L, R].
export function splitLR(grid, size) {
  'worklet'
  const mid = size / 2
  let lSum = 0, rSum = 0, lN = 0, rN = 0
  for (let gy = 0; gy < size; gy++) {
    for (let gx = 0; gx < size; gx++) {
      const v = grid[gy * size + gx]
      if (gx < mid) { lSum += v; lN++ } else { rSum += v; rN++ }
    }
  }
  return [lN ? lSum / lN : 0, rN ? rSum / rN : 0]
}

// Beat frequency in Hz: how fast the two summed sines throb. Zero at balance.
export function beatHz(diff, range) {
  'worklet'
  const b = diff * range
  return b < 0 ? -b : b
}

// Frequency of the second oscillator. The pair beats at |diff*range|.
export function detuneFreq(pitch, diff, range) {
  'worklet'
  return pitch + diff * range
}

// Advance the beat-phase accumulator. dt seconds. Wraps to [0, 2π) so the
// phase never grows unbounded. At beatHz 0 the phase is frozen — the breath
// stops on its own at true unison.
export function advancePhase(phase, hz, dt) {
  'worklet'
  let p = phase + TWO_PI * hz * dt
  if (p >= TWO_PI) p = p - TWO_PI * Math.floor(p / TWO_PI)
  if (p < 0) p = 0
  return p
}

// lock slider 0..1 -> null-zone half-width on |diff|. Higher lock = wider zone
// (easier to trip the visual lock-glow).
export function lockThreshFromParam(lock) {
  'worklet'
  return lerp(0.01, 0.08, clamp01(lock))
}
