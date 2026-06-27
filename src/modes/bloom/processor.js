import { meanDelta, lightStep, fadeToDecay, brightToGain, meanArr, maxArr } from './dsp'
import { bloomState, paramState, BLOOM_GRID } from './state'

const GRID = BLOOM_GRID    // 8x8 = 64 cells; well under the 5 ms budget
const N = GRID * GRID

export function extractFeatures(frame) {
  'worklet'
  try {
    const buf = frame.toArrayBuffer()
    const data = new Uint8Array(buf)

    const grid = new Array(N)
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const px = Math.floor((gx / GRID) * frame.width)
        const py = Math.floor((gy / GRID) * frame.height)
        grid[gy * GRID + gx] = data[py * frame.bytesPerRow + px] / 255
      }
    }

    const s = bloomState.value
    const prev = s.prev
    const light = s.light && s.light.length === N ? s.light : new Array(N).fill(0)

    const p = paramState.value
    const decay = fadeToDecay(p.fade ?? 0.5)
    const gain = brightToGain(p.bright ?? 0.5)

    const md = meanDelta(grid, prev)    // global-shift / shake immunity
    const next = new Array(N)
    let dist = 0
    let distIdx = 0
    for (let i = 0; i < N; i++) {
      let motion = 0
      if (prev && prev.length === N) {
        const d = (grid[i] - prev[i]) - md
        motion = d < 0 ? -d : d
      }
      if (motion > dist) { dist = motion; distIdx = i }
      next[i] = lightStep(light[i], motion, decay, gain)
    }

    bloomState.value = { prev: grid, light: next }

    const distRow = Math.floor(distIdx / GRID)
    return {
      light: next,                       // flat 64-cell glow buffer -> render
      glow: meanArr(next),               // total live glow -> ambient synth + overlay
      peak: maxArr(next),                // brightest cell -> overlay
      dist,                              // strongest stir this frame -> grain gate
      distY: (distRow + 0.5) / GRID,     // its vertical position 0..1 -> pitch
    }
  } catch (e) {
    return { light: null, glow: 0, peak: 0, dist: 0, distY: 0.5 }
  }
}
