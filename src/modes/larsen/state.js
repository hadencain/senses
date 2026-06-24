import { Worklets } from 'react-native-worklets-core'

// Cross-frame memory for the processor worklet. Lives in the worklets-core
// runtime, persists across frame-processor invocations, and never crosses to
// the JS thread (only the resulting feedbackGain scalar is emitted in features).
// This is the reusable pattern for the memory-tier effects (Latent/Rust/Bloom).
export const fbState = Worklets.createSharedValue({ prev: null, mEMA: 0, gain: 0, t: 0 })

// JS→worklet param bridge. synth.update (JS thread) writes the params the
// processor needs; the processor worklet reads them. Avoids a host change to
// pass params into extractFeatures.
export const paramState = Worklets.createSharedValue({ sensitivity: 0.5, build: 0.4 })
