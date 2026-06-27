import { Worklets } from 'react-native-worklets-core'

const GRID = 8

// Cross-frame memory for the processor worklet (the never-resetting accumulator).
// Lives in the worklets-core runtime, persists across frame-processor calls.
// Same memory-tier pattern as larsen/state.js. `acc` is the flat GRID*GRID
// accumulator; `prev` is last frame's luma grid for the motion term.
export const rustState = Worklets.createSharedValue({
  prev: null,
  acc: new Array(GRID * GRID).fill(0),
})

// JS->worklet param bridge: synth.update (JS thread) writes the params the
// processor needs each frame; the processor worklet reads them. Avoids a host
// change to pass params into extractFeatures.
export const paramState = Worklets.createSharedValue({ heal: 0.3, bite: 0.5 })

export const RUST_GRID = GRID
