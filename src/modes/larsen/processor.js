import { computeMotion, emaStep, updateGain } from './dsp'
import { fbState, paramState } from './state'

const GRID = 8   // 8x8 = 64 luma samples; well under the 5 ms budget

export function extractFeatures(frame) {
  'worklet'
  try {
    const buf = frame.toArrayBuffer()
    const data = new Uint8Array(buf)

    const grid = new Array(GRID * GRID)
    let bsum = 0
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const px = Math.floor((gx / GRID) * frame.width)
        const py = Math.floor((gy / GRID) * frame.height)
        const v = data[py * frame.bytesPerRow + px] / 255
        grid[gy * GRID + gx] = v
        bsum += v
      }
    }

    const s = fbState.value
    const motion = computeMotion(grid, s.prev)
    const mEMA = emaStep(s.mEMA, motion, 0.3)

    // vision-camera frame.timestamp is in nanoseconds; clamp defensively so a
    // unit mismatch or first-frame just falls back to ~30fps dt.
    const now = frame.timestamp ?? 0
    let dt = s.t ? (now - s.t) / 1e9 : 0.033
    if (!(dt > 0) || dt > 0.5) dt = 0.033

    const p = paramState.value
    const gain = updateGain(s.gain, mEMA, dt, p.sensitivity, p.build)

    fbState.value = { prev: grid, mEMA, gain, t: now }

    // feedback is an overlay-display alias of feedbackGain (synth.js, render.js read feedbackGain)
    return { feedbackGain: gain, feedback: gain, motion: mEMA, brightness: bsum / (GRID * GRID) }
  } catch (e) {
    return { feedbackGain: 0, feedback: 0, motion: 0, brightness: 0.5 }
  }
}
