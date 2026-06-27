// Bloom — native granular shimmer over the senses-audio Oboe engine (grain-field
// path). The room's recent sound is scrubbed into a quiet oceanic bed whose
// presence tracks the live glow; stirring the dark fires sparse grain bursts
// pitched by where you touched. No audio-api oscillators — single engine.
import { yToPitch } from './dsp'

let SensesAudio = null
try {
  SensesAudio = require('../../../modules/senses-audio').default
} catch (e) {
  console.warn('[bloom] senses-audio native module unavailable — silent:', e?.message)
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

export function createSynth(audioCtx) {
  // Native engine owns its own Oboe streams; accept audioCtx per the contract
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
      .catch(err => console.warn('[bloom] startCapture failed:', err?.message))
  }

  function update(features, motion, params) {
    if (!SensesAudio || !started) return

    const level = params.level ?? 0.5
    SensesAudio.setMasterGain(clamp(level, 0, 1))

    const rawFill = SensesAudio.getBufferFill()
    const fill = Number.isFinite(rawFill) ? clamp(rawFill, 0, 1) : 0
    if (fill < 0.02) return   // buffer not primed yet

    const glow = clamp(features.glow ?? 0, 0, 1)
    const dist = clamp(features.dist ?? 0, 0, 1)
    const distY = clamp(features.distY ?? 0.5, 0, 1)

    // oceanic bed: a granular-freeze loop over the recent buffer, alive only
    // while glow lingers — black room => silence.
    const loopEnd = fill
    const loopStart = clamp(fill - 0.4, 0, fill)
    SensesAudio.setPlayback({ active: glow > 0.04, loopStart, loopEnd, rate: 1 })

    // disturbance => sparse grain burst pitched by vertical position
    if (dist > 0.04) {
      const now = Date.now()
      const minGap = 80 - dist * 60   // ms; denser the harder you stir
      if (now - lastFire >= minGap) {
        lastFire = now
        const pitchRatio = yToPitch(distY)
        const count = 1 + Math.floor(dist * 4)
        for (let i = 0; i < count; i++) {
          const position = clamp(loopStart + Math.random() * (loopEnd - loopStart), 0, fill)
          SensesAudio.triggerGrain({
            position,
            durationSec: 0.1 + Math.random() * 0.2,
            pitchRatio,
            amplitude: 0.15 + dist * 0.5,
          })
        }
      }
    }
  }

  function dispose() {
    disposed = true
    if (!SensesAudio) return
    try { SensesAudio.setPlayback({ active: false }) } catch {}
    try { SensesAudio.stopCapture() } catch {}
    try { SensesAudio.setMasterGain(0) } catch {}
    started = false
  }

  return { update, dispose }
}
