// Zero Beat — two sines summed into one gain over react-native-audio-api. The
// beating is genuine acoustic interference (both oscillators reach destination
// together), not a synthesized LFO. Balance the frame's light to slow the beat
// to a standstill. Oscillator path proven by rust/synth.js.
import { detuneFreq } from './dsp'
import { paramState } from './state'

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

export function createSynth(audioCtx) {
  const master = audioCtx.createGain()
  master.gain.value = 0
  master.connect(audioCtx.destination)

  let oscA = null
  let oscB = null
  try {
    oscA = audioCtx.createOscillator()
    oscB = audioCtx.createOscillator()
    oscA.type = 'sine'
    oscB.type = 'sine'
    oscA.frequency.value = 220
    oscB.frequency.value = 220
    oscA.connect(master)   // both into master -> they sum -> real beating
    oscB.connect(master)
    oscA.start()
    oscB.start()
  } catch (e) {
    console.warn('[zero-beat] oscillator setup failed — silent:', e?.message)
  }

  function update(features, motion, params) {
    // feed the detune range to the processor (it derives the visible beat phase)
    paramState.value = { range: params.range ?? 12 }

    if (!oscA || !oscB) return

    const pitch = params.pitch ?? 220
    const range = params.range ?? 12
    const level = params.level ?? 0.3
    const diff = features.diff ?? 0
    const t = audioCtx.currentTime

    oscA.frequency.setTargetAtTime(pitch, t, 0.05)
    oscB.frequency.setTargetAtTime(detuneFreq(pitch, diff, range), t, 0.05)
    // two unit sines sum to peak 2.0; halve so level maps 1:1 to headroom
    master.gain.setTargetAtTime(clamp(level * 0.5, 0, 0.5), t, 0.1)
  }

  function dispose() {
    try { oscA && oscA.stop() } catch {}
    try { oscB && oscB.stop() } catch {}
    try { oscA && oscA.disconnect() } catch {}
    try { oscB && oscB.disconnect() } catch {}
    try { master.disconnect() } catch {}
  }

  return { update, dispose }
}
