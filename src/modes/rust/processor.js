import { accumStep, oxidize, edgeMagAt, healToLeak, biteToK, meanArr, maxArr } from './dsp'
import { rustState, paramState, RUST_GRID } from './state'

const GRID = RUST_GRID            // 8x8 = 64 luma samples; well under the 5 ms budget
const N = GRID * GRID
const W_MOTION = 1.0              // weight of frame-to-frame local change
const W_EDGE = 0.5               // weight of static edge/texture

export function extractFeatures(frame) {
  'worklet'
  try {
    const buf = frame.toArrayBuffer()
    const data = new Uint8Array(buf)

    // coarse luma grid
    const grid = new Array(N)
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const px = Math.floor((gx / GRID) * frame.width)
        const py = Math.floor((gy / GRID) * frame.height)
        grid[gy * GRID + gx] = data[py * frame.bytesPerRow + px] / 255
      }
    }

    const s = rustState.value
    const prev = s.prev
    const acc = s.acc && s.acc.length === N ? s.acc : new Array(N).fill(0)

    const p = paramState.value
    const leak = healToLeak(p.heal ?? 0.3)
    const k = biteToK(p.bite ?? 0.5)

    // per-cell activity = local motion + edge; accumulate, leak, oxidize
    const ox = new Array(N)
    const nextAcc = new Array(N)
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const i = gy * GRID + gx
        let motion = 0
        if (prev && prev.length === N) {
          const d = grid[i] - prev[i]
          motion = d < 0 ? -d : d
        }
        const edge = edgeMagAt(grid, gx, gy, GRID)
        const activity = W_MOTION * motion + W_EDGE * edge
        const a = accumStep(acc[i], activity, leak)
        nextAcc[i] = a
        ox[i] = oxidize(a, k)
      }
    }

    rustState.value = { prev: grid, acc: nextAcc }

    return {
      rust: ox,                       // flat 64-cell oxidation field (0..1) -> render
      rustSum: meanArr(ox),           // global corrosion (0..1) -> drone + overlay
      peak: maxArr(ox),               // most-corroded cell -> overlay
    }
  } catch (e) {
    return { rust: null, rustSum: 0, peak: 0 }
  }
}
