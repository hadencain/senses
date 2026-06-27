import { Worklets } from 'react-native-worklets-core'

const GRID = 8

// Cross-frame memory for the processor worklet. `fast` is a quick denoise EMA of
// the luma grid; `slow` is the ~30 s plate. Both seeded to the first frame so
// there's no entry transient. Same memory-tier pattern as the other modes.
export const latentState = Worklets.createSharedValue({
  fast: new Array(GRID * GRID).fill(0),
  slow: new Array(GRID * GRID).fill(0),
  seeded: false,
})

// JS->worklet param bridge: synth.update writes develop/contrast each frame.
export const paramState = Worklets.createSharedValue({ develop: 0.5, contrast: 0.5 })

export const LATENT_GRID = GRID
