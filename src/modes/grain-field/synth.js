// grain-field — native Oboe granular engine (modules/senses-audio).
// Captures live mic into an 8s circular buffer; motion + camera features
// scrub and granulate that buffer in real time. Replaces the prior
// react-native-audio-api oscillator synth.
//
// Defensive import: requireNativeModule('SensesAudio') throws at import time
// if the native module isn't in the build. Swallowing it here keeps a missing
// native side from crashing the whole effect registry (degrades to silence).
let SensesAudio = null
try {
  SensesAudio = require('../../../modules/senses-audio').default
} catch (e) {
  console.warn('[grain-field] senses-audio native module unavailable — silent:', e?.message)
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

export function createSynth(audioCtx) {
  // audioCtx is created/closed by the host per the four-file contract. The
  // native engine has its own Oboe output stream, so we don't use it — but we
  // must accept it and never close it ourselves.

  let started = false
  let disposed = false
  if (SensesAudio) {
    SensesAudio.setPlayback({ active: false })        // clean loop state
    SensesAudio.startCapture()                        // async; needs RECORD_AUDIO
      .then(() => {
        // If the effect was left before capture resolved, stop immediately —
        // otherwise the Oboe mic stream stays open and blocks re-entry.
        if (disposed) { try { SensesAudio.stopCapture() } catch {}; return }
        started = true
      })
      .catch(err => console.warn('[grain-field] startCapture failed:', err?.message))
  }

  let lastFire = 0

  function update(features, motion, params) {
    if (!SensesAudio || !started) return     // nothing to granulate until capture runs

    const level   = params.level ?? 0.7
    const density = params.density ?? 1
    const pitch   = params.pitch ?? 80      // manifest: 40..600 hz
    const scatter = params.scatter ?? 0.6   // 0..1 position spread

    SensesAudio.setMasterGain(level)

    const speed = motion.speed ?? 0
    const rawFill = SensesAudio.getBufferFill()
    const fill  = Number.isFinite(rawFill) ? clamp(rawFill, 0, 1) : 0
    if (fill < 0.02) return                 // buffer not primed yet

    // --- continuous loop drone when held still; grains when moving ---
    // Still phone → a granular-freeze drone over a brightness-tracked region,
    // tilt scrubs its pitch. Movement disables it so grains dominate.
    // TODO(device): tune the stillness threshold and rate range by ear.
    const still   = speed < 0.08
    const bright  = clamp(features.brightness ?? 0.5, 0, 1)
    const center  = bright * fill
    const halfWin = clamp(0.12 + scatter * 0.25, 0, 0.5)
    SensesAudio.setPlayback({
      active: still,
      loopStart: clamp(center - halfWin, 0, fill),
      loopEnd:   clamp(center + halfWin, 0, fill),
      rate:      1 + ((motion.tilt ?? 0.5) - 0.5) * 0.4,
    })

    // --- grain scheduling (throttled by speed + density, as the osc synth was) ---
    const now    = Date.now()
    const minGap = 30 - speed * 25          // ms between grain bursts
    if (now - lastFire < minGap) return
    lastFire = now

    const count = Math.floor((1 + speed * 12) * density)
    const pitchRatio = clamp(pitch / 120, 0.25, 4)   // 80hz default → ~0.67×
    const spread = (features.variance ?? 0) * 1.5

    for (let i = 0; i < count; i++) {
      const jitter   = (Math.random() - 0.5) * scatter * fill
      const position = clamp(center + jitter, 0, fill)
      const durationSec = 0.03 + Math.random() * 0.2 * (1 - speed * 0.5)
      const ratio    = clamp(pitchRatio * (1 + (Math.random() - 0.5) * spread), 0.25, 4)
      const amplitude = 0.2 + Math.random() * 0.4
      SensesAudio.triggerGrain({ position, durationSec, pitchRatio: ratio, amplitude })
    }
  }

  function dispose() {
    disposed = true
    if (!SensesAudio) return
    try { SensesAudio.setPlayback({ active: false }) } catch {}
    try { SensesAudio.stopCapture() } catch {}
    started = false
  }

  return { update, dispose }
}
