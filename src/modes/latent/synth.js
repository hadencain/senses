// Latent — native granular over the senses-audio Oboe engine (grain-field path).
// The room's recent sound is captured into the circular buffer; developing
// deviations scrub it by their vertical position — top of frame = recent
// history, bottom = older. The sound history gets indexed by where in the frame
// things changed. No audio-api oscillators — single engine.
import { yToBufferFrac } from './dsp'

let SensesAudio = null
try {
  SensesAudio = require('../../../modules/senses-audio').default
} catch (e) {
  console.warn('[latent] senses-audio native module unavailable — silent:', e?.message)
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

export function createSynth(audioCtx) {
  // Native engine owns its Oboe streams; accept audioCtx per the contract but
  // never use or close it.
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
      .catch(err => console.warn('[latent] startCapture failed:', err?.message))
  }

  function update(features, motion, params) {
    if (!SensesAudio || !started) return

    const level = params.level ?? 0.5
    const density = params.density ?? 1
    SensesAudio.setMasterGain(clamp(level, 0, 1))

    const rawFill = SensesAudio.getBufferFill()
    const fill = Number.isFinite(rawFill) ? clamp(rawFill, 0, 1) : 0
    if (fill < 0.02) return   // buffer not primed yet

    const devMag = clamp(features.devMag ?? 0, 0, 1)
    const devY = clamp(features.devY ?? 0.5, 0, 1)
    if (devMag < 0.05) return   // nothing developing -> silence

    // grains scrub the buffer at the position the deviation indexes
    const now = Date.now()
    const minGap = (90 - devMag * 60) / density   // ms; busier as it develops
    if (now - lastFire < minGap) return
    lastFire = now

    const center = fill * yToBufferFrac(devY)
    const count = 1 + Math.floor(devMag * 4)
    for (let i = 0; i < count; i++) {
      const jitter = (Math.random() - 0.5) * 0.08 * fill
      const position = clamp(center + jitter, 0, fill)
      SensesAudio.triggerGrain({
        position,
        durationSec: 0.08 + Math.random() * 0.18,
        pitchRatio: 1,                         // history playback, not transposed
        amplitude: 0.15 + devMag * 0.5,
      })
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
