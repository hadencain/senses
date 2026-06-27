// Redaction — 3 detuned square waves gated by total coverage, over
// react-native-audio-api. Silent when the frame is clean; a harsh beating buzz
// swells as you censor yourself and decays as the bars heal. Oscillator path
// proven by rust/zero-beat.
import { detuneTriple, gateGain } from './dsp'
import { paramState } from './state'

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const BASE_HZ = 90    // low, harsh

export function createSynth(audioCtx) {
  const master = audioCtx.createGain()
  master.gain.value = 0
  master.connect(audioCtx.destination)

  const oscs = []
  try {
    for (let i = 0; i < 3; i++) {
      const o = audioCtx.createOscillator()
      o.type = 'square'
      o.frequency.value = BASE_HZ
      o.connect(master)   // all three sum into master -> beating roughness
      o.start()
      oscs.push(o)
    }
  } catch (e) {
    console.warn('[redaction] oscillator setup failed — silent:', e?.message)
  }

  function update(features, motion, params) {
    // feed attack/heal to the processor
    paramState.value = { sensitivity: params.sensitivity ?? 0.5, heal: params.heal ?? 0.3 }

    if (oscs.length !== 3) return

    const grind = params.grind ?? 15
    const level = params.level ?? 0.4
    const coverage = clamp(features.coverage ?? 0, 0, 1)
    const t = audioCtx.currentTime

    const freqs = detuneTriple(BASE_HZ, grind)
    for (let i = 0; i < 3; i++) oscs[i].frequency.setTargetAtTime(freqs[i], t, 0.05)

    // three unit squares are hot; scale down before the coverage gate
    master.gain.setTargetAtTime(gateGain(level, coverage) * 0.33, t, 0.08)
  }

  function dispose() {
    for (const o of oscs) {
      try { o.stop() } catch {}
      try { o.disconnect() } catch {}
    }
    try { master.disconnect() } catch {}
  }

  return { update, dispose }
}
