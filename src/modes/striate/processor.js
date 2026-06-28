import {
  binOf, bucketCenter, histEntropyNorm, floorToThresh, smoothToAlpha,
  emaStep, parabolicDelta, topPeaks, lerp, clamp01, NB, PI,
} from './dsp'
import { striateState, paramState } from './state'

const GRID = 16              // 16x16 luma; Sobel over the 14x14 interior
const INTERIOR = 14 * 14
const COV_FULL = 0.3        // coverage at which the grain reads as fully present

export function extractFeatures(frame) {
  'worklet'
  try {
    const buf = frame.toArrayBuffer()
    const data = new Uint8Array(buf)

    const g = new Array(GRID * GRID)
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const px = Math.floor((c / GRID) * frame.width)
        const py = Math.floor((r / GRID) * frame.height)
        g[r * GRID + c] = data[py * frame.bytesPerRow + px] / 255
      }
    }

    const p = paramState.value
    const thresh = floorToThresh(p.floor ?? 0.3)
    const alpha = smoothToAlpha(p.smooth ?? 0.5)

    // magnitude-weighted histogram of grain orientation over the interior
    const hist = new Array(NB).fill(0)
    let count = 0
    let total = 0
    for (let r = 1; r < GRID - 1; r++) {
      for (let c = 1; c < GRID - 1; c++) {
        const tl = g[(r - 1) * GRID + (c - 1)], tc = g[(r - 1) * GRID + c], tr = g[(r - 1) * GRID + (c + 1)]
        const ml = g[r * GRID + (c - 1)], mr = g[r * GRID + (c + 1)]
        const bl = g[(r + 1) * GRID + (c - 1)], bc = g[(r + 1) * GRID + c], br = g[(r + 1) * GRID + (c + 1)]
        const gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl)
        const gy = (bl + 2 * bc + br) - (tl + 2 * tc + tr)
        const mag = Math.sqrt(gx * gx + gy * gy)
        if (mag > thresh) {
          const grain = Math.atan2(gy, gx) + PI / 2   // edge runs perpendicular to gradient
          hist[binOf(grain, NB)] += mag
          count++
          total += mag
        }
      }
    }

    // normalize this frame's histogram to sum 1 (stable across brightness)
    if (total > 0) for (let i = 0; i < NB; i++) hist[i] /= total
    const cov = count / INTERIOR

    // EMA the histogram + coverage (seed on first frame)
    const s = striateState.value
    const prevHist = s.hist && s.hist.length === NB ? s.hist : new Array(NB).fill(0)
    let smHist
    let smCov
    if (!s.seeded) {
      smHist = hist.slice()
      smCov = cov
    } else {
      smHist = new Array(NB)
      for (let i = 0; i < NB; i++) smHist[i] = emaStep(prevHist[i], hist[i], alpha)
      smCov = emaStep(s.cov ?? 0, cov, alpha)
    }
    striateState.value = { hist: smHist, cov: smCov, seeded: true }

    // coverage factor: 0 (no grain) -> 1 (solid grain)
    const covFactor = clamp01(smCov / COV_FULL)

    // entropy from the smoothed histogram, pushed toward noise as coverage falls
    const entropyRaw = histEntropyNorm(smHist)
    const entropy = clamp01(lerp(1, entropyRaw, covFactor))

    // top grain orientations (continuous, parabola-refined)
    const peaks = topPeaks(smHist, 3, 0.5)
    const angles = []
    const weights = []
    const bw = PI / NB
    for (let j = 0; j < peaks.length; j++) {
      const b = peaks[j]
      const d = parabolicDelta(smHist[(b - 1 + NB) % NB], smHist[b], smHist[(b + 1) % NB])
      let a = bucketCenter(b, NB) + d * bw
      if (a < 0) a += PI
      if (a >= PI) a -= PI
      angles.push(a)
      weights.push(smHist[b])
    }

    return { angles, weights, entropy, density: covFactor }
  } catch (e) {
    return { angles: [], weights: [], entropy: 1, density: 0 }
  }
}
