// Larsen — hybrid feedback over the native senses-audio engine.
// Deterministic spine: master gain + grain density rise with feedbackGain on a
// primed loop, so it reliably sings even in a dead room. Acoustic seasoning:
// the rising output couples speaker->room->mic->buffer = real Larsen, for free.
// Safety: master gain hard-capped at <= 0.6.
import { paramState } from './state'

let SensesAudio = null
try {
  SensesAudio = require('../../../modules/senses-audio').default
} catch (e) {
  console.warn('[larsen] senses-audio native module unavailable — silent:', e?.message)
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

export function createSynth(audioCtx) {
  // Native engine has its own Oboe streams; we accept audioCtx per the contract
  // but never use or close it.
  let started = false
  let disposed = false
  let lastFire = 0

  if (SensesAudio) {
    try { SensesAudio.setMasterGain(0) } catch {}
    try { SensesAudio.setPlayback({ active: false }) } catch {}
    SensesAudio.startCapture()
      .then(() => {
        if (disposed) { try { SensesAudio.stopCapture() } catch {}; return }
        started = true
      })
      .catch(err => console.warn('[larsen] startCapture failed:', err?.message))
  }

  function update(features, motion, params) {
    // Mirror params into the processor's shared value every frame (cheap; this
    // is how sensitivity/build reach the worklet without a host change).
    paramState.value = {
      sensitivity: params.sensitivity ?? 0.5,
      build: params.build ?? 0.4,
    }

    if (!SensesAudio || !started) return

    const ceiling = clamp(params.ceiling ?? 0.35, 0, 0.6)
    const gain = clamp(features.feedbackGain ?? 0, 0, 1)

    // Safety fuse: master gain never exceeds the ceiling (<= 0.6).
    SensesAudio.setMasterGain(clamp(ceiling * gain, 0, 0.6))

    const rawFill = SensesAudio.getBufferFill()
    const fill = Number.isFinite(rawFill) ? clamp(rawFill, 0, 1) : 0
    if (fill < 0.02) return   // buffer not primed yet

    // Primed loop on the most recent ~0.5 of the buffer.
    const loopEnd = fill
    const loopStart = clamp(fill - 0.5, 0, fill)
    SensesAudio.setPlayback({ active: gain > 0.02, loopStart, loopEnd, rate: 1 })

    // Deterministic thickening: grain density grows with the build.
    if (gain > 0.05) {
      const now = Date.now()
      const minGap = 60 - gain * 50   // ms; faster as it builds
      if (now - lastFire >= minGap) {
        lastFire = now
        const count = Math.floor(1 + gain * 5)
        for (let i = 0; i < count; i++) {
          const position = clamp(loopStart + Math.random() * (loopEnd - loopStart), 0, fill)
          SensesAudio.triggerGrain({
            position,
            durationSec: 0.08 + Math.random() * 0.18,
            pitchRatio: 1,
            amplitude: 0.2 + gain * 0.5,
          })
        }
      }
    }
  }

  function dispose() {
    disposed = true
    if (!SensesAudio) return
    try { SensesAudio.setMasterGain(0) } catch {}
    try { SensesAudio.setPlayback({ active: false }) } catch {}
    try { SensesAudio.stopCapture() } catch {}
    started = false
  }

  return { update, dispose }
}
