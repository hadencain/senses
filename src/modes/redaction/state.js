import { Worklets } from 'react-native-worklets-core'

const GRID = 8

// Cross-frame memory for the processor worklet. `prev` is last frame's luma grid
// (for the local-motion delta); `pressure` is the flat GRID*GRID accumulator —
// the censorship field that attacks on motion and heals on stillness. Same
// memory-tier pattern as larsen/rust state.
export const redState = Worklets.createSharedValue({
  prev: null,
  pressure: new Array(GRID * GRID).fill(0),
})

// JS->worklet param bridge: synth.update writes the attack/heal params the
// processor needs each frame. Avoids a host change.
export const paramState = Worklets.createSharedValue({ sensitivity: 0.5, heal: 0.3 })

export const RED_GRID = GRID
