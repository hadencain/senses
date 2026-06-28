import { Worklets } from 'react-native-worklets-core'

const NB = 8

// Smoothing state for the processor worklet. NOT activity-memory like the other
// modes — just an EMA of the orientation histogram + coverage, so the grain
// reading (and thus the comb and pitch) doesn't strobe on per-frame sensor
// noise. Peaks are re-extracted from the smoothed histogram each frame, which
// keeps multi-orientation stable.
export const striateState = Worklets.createSharedValue({
  hist: new Array(NB).fill(0),
  cov: 0,
  seeded: false,
})

// JS->worklet param bridge: synth.update writes smooth/floor each frame.
export const paramState = Worklets.createSharedValue({ smooth: 0.5, floor: 0.3 })

export const STRIATE_NB = NB
