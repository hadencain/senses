import { splitLR, beatHz, advancePhase } from './dsp'
import { phaseState, paramState } from './state'

const GRID = 16   // 16x16 luma samples; well under the 5 ms budget

export function extractFeatures(frame) {
  'worklet'
  try {
    const buf = frame.toArrayBuffer()
    const data = new Uint8Array(buf)

    const grid = new Array(GRID * GRID)
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const px = Math.floor((gx / GRID) * frame.width)
        const py = Math.floor((gy / GRID) * frame.height)
        grid[gy * GRID + gx] = data[py * frame.bytesPerRow + px] / 255
      }
    }

    const [L, R] = splitLR(grid, GRID)
    const diff = L - R

    // integrate the visible beat phase (only meaningful near lock, but always
    // tracked). dt from frame.timestamp (ns), clamped like larsen.
    const range = paramState.value.range ?? 12
    const hz = beatHz(diff, range)
    const s = phaseState.value
    const now = frame.timestamp ?? 0
    let dt = s.t ? (now - s.t) / 1e9 : 0.033
    if (!(dt > 0) || dt > 0.5) dt = 0.033
    const phase = advancePhase(s.phase ?? 0, hz, dt)
    phaseState.value = { phase, t: now }

    return { L, R, diff, breath: Math.sin(phase) }
  } catch (e) {
    return { L: 0.5, R: 0.5, diff: 0, breath: 0 }
  }
}
