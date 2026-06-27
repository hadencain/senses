import { meanDelta, pressureStep, sensToAttack, healToLeak, meanArr, maxArr } from './dsp'
import { redState, paramState, RED_GRID } from './state'

const GRID = RED_GRID    // 8x8 = 64 cells; well under the 5 ms budget
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

    const s = redState.value
    const prev = s.prev
    const pressure = s.pressure && s.pressure.length === N ? s.pressure : new Array(N).fill(0)

    const p = paramState.value
    const attack = sensToAttack(p.sensitivity ?? 0.5)
    const leak = healToLeak(p.heal ?? 0.3)

    const md = meanDelta(grid, prev)   // global-shift / shake immunity
    const next = new Array(N)
    for (let i = 0; i < N; i++) {
      let motion = 0
      if (prev && prev.length === N) {
        const d = (grid[i] - prev[i]) - md
        motion = d < 0 ? -d : d
      }
      next[i] = pressureStep(pressure[i], motion, attack, leak)
    }

    redState.value = { prev: grid, pressure: next }

    return {
      pressure: next,            // flat 64-cell censorship field -> render
      coverage: meanArr(next),   // total erasure (0..1) -> audio gate + overlay
      peak: maxArr(next),        // most-censored cell -> overlay
    }
  } catch (e) {
    return { pressure: null, coverage: 0, peak: 0 }
  }
}
