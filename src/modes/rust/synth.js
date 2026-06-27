// Rust — Web Audio saw-pair drone over react-native-audio-api. This is the
// first mode on the oscillator path (grain-field/larsen use the native Oboe
// engine); createOscillator + createGain are the confirmed-working nodes per
// EFFECTS_GUIDE. The drone sags DOWNWARD as the global rust sum climbs over a
// take — the longer you record, the more it sinks.
import { sagFreq } from './dsp'
import { paramState } from './state'

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const BASE_HZ = 110            // base pitch of the pair
const DETUNE = 1.006           // second saw a touch sharp -> slow beating

export function createSynth(audioCtx) {
  const master = audioCtx.createGain()
  master.gain.value = 0
  master.connect(audioCtx.destination)

  let oscA = null
  let oscB = null
  let disposed = false
  try {
    oscA = audioCtx.createOscillator()
    oscB = audioCtx.createOscillator()
    oscA.type = 'sawtooth'
    oscB.type = 'sawtooth'
    oscA.frequency.value = BASE_HZ
    oscB.frequency.value = BASE_HZ * DETUNE
    oscA.connect(master)
    oscB.connect(master)
    oscA.start()
    oscB.start()
  } catch (e) {
    console.warn('[rust] oscillator setup failed — silent:', e?.message)
  }

  function update(features, motion, params) {
    // mirror the params the processor needs into its shared value (cheap)
    paramState.value = { heal: params.heal ?? 0.3, bite: params.bite ?? 0.5 }

    if (!oscA || !oscB) return

    const rustSum = clamp(features.rustSum ?? 0, 0, 1)
    const sag = params.sag ?? 0.6
    const level = params.level ?? 0.4
    const t = audioCtx.currentTime

    const f = sagFreq(BASE_HZ, rustSum, sag)
    oscA.frequency.setTargetAtTime(f, t, 0.3)
    oscB.frequency.setTargetAtTime(f * DETUNE, t, 0.3)

    // drone swells slightly as the room corrodes, then holds
    const g = level * (0.35 + 0.65 * rustSum)
    master.gain.setTargetAtTime(clamp(g, 0, 1), t, 0.3)
  }

  function dispose() {
    disposed = true
    try { oscA && oscA.stop() } catch {}
    try { oscB && oscB.stop() } catch {}
    try { oscA && oscA.disconnect() } catch {}
    try { oscB && oscB.disconnect() } catch {}
    try { master.disconnect() } catch {}
  }

  return { update, dispose }
}
