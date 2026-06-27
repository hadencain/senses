import { emaStep, deviation, developToAlpha, contrastToGain, meanAbs } from './dsp'
import { latentState, paramState, LATENT_GRID } from './state'

const GRID = LATENT_GRID    // 8x8 = 64 cells; well under the 5 ms budget
const N = GRID * GRID
const FAST_ALPHA = 0.3      // denoise EMA

export function extractFeatures(frame) {
  'worklet'
  try {
    const buf = frame.toArrayBuffer()
    const data = new Uint8Array(buf)

    const cur = new Array(N)
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const px = Math.floor((gx / GRID) * frame.width)
        const py = Math.floor((gy / GRID) * frame.height)
        cur[gy * GRID + gx] = data[py * frame.bytesPerRow + px] / 255
      }
    }

    const s = latentState.value
    let fast = s.fast && s.fast.length === N ? s.fast : new Array(N).fill(0)
    let slow = s.slow && s.slow.length === N ? s.slow : new Array(N).fill(0)

    // seed both buffers to the first frame -> no entry transient
    if (!s.seeded) {
      latentState.value = { fast: cur.slice(), slow: cur.slice(), seeded: true }
      return { dev: new Array(N).fill(0), devMag: 0, devY: 0.5, activity: 0 }
    }

    const p = paramState.value
    const slowAlpha = developToAlpha(p.develop ?? 0.5)
    const gain = contrastToGain(p.contrast ?? 0.5)

    const nextFast = new Array(N)
    const nextSlow = new Array(N)
    const dev = new Array(N)
    let devMag = 0
    let devIdx = 0
    for (let i = 0; i < N; i++) {
      const f = emaStep(fast[i], cur[i], FAST_ALPHA)
      const sl = emaStep(slow[i], cur[i], slowAlpha)
      nextFast[i] = f
      nextSlow[i] = sl
      const d = deviation(f, sl, gain)
      dev[i] = d
      const ad = d < 0 ? -d : d
      if (ad > devMag) { devMag = ad; devIdx = i }
    }

    latentState.value = { fast: nextFast, slow: nextSlow, seeded: true }

    const devRow = Math.floor(devIdx / GRID)
    return {
      dev,                              // signed 64-cell deviation field -> render
      devMag,                           // peak |deviation| -> synth gate + overlay
      devY: (devRow + 0.5) / GRID,      // its vertical position -> buffer scrub
      activity: meanAbs(dev),           // overall development -> overlay
    }
  } catch (e) {
    return { dev: null, devMag: 0, devY: 0.5, activity: 0 }
  }
}
