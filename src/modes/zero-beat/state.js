import { Worklets } from 'react-native-worklets-core'

// Beat-phase accumulator for the near-lock breath. The processor has
// frame.timestamp (the only clock available to an effect), so it integrates the
// visible breath here; render just reads features.breath. Same memory pattern
// as larsen/state.js — but the only state Zero Beat needs.
export const phaseState = Worklets.createSharedValue({ phase: 0, t: 0 })

// JS->worklet param bridge: synth.update writes the detune `range` the processor
// needs to derive beatHz for the phase. Avoids a host change.
export const paramState = Worklets.createSharedValue({ range: 12 })
