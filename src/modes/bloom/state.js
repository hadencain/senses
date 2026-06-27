import { Worklets } from 'react-native-worklets-core'

const GRID = 8

// Cross-frame memory for the processor worklet. `prev` is last frame's luma grid
// (for the local-motion delta); `light` is the flat GRID*GRID glow buffer that
// decays each frame. Same memory-tier pattern as larsen/rust/redaction.
export const bloomState = Worklets.createSharedValue({
  prev: null,
  light: new Array(GRID * GRID).fill(0),
})

// JS->worklet param bridge: synth.update writes the fade/bright params the
// processor needs each frame.
export const paramState = Worklets.createSharedValue({ fade: 0.5, bright: 0.5 })

export const BLOOM_GRID = GRID
