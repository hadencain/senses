// Striate — 5 Web Audio sines voicing the scene's grain. The top orientations
// are spread across the oscillators (1 grain -> unison+detune, 2 -> a dyad,
// 3 -> a triad); entropy widens the detune toward a rough noise cluster. Order
// and noise are one knob. Oscillator path proven by rust/zero-beat/redaction.
import { angleToPitch, detuneAt } from './dsp'
import { paramState } from './state'

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const NOSC = 5
const DEFAULT_PITCH = 165   // mid of 110..220 when there's no grain

export function createSynth(audioCtx) {
  const master = audioCtx.createGain()
  master.gain.value = 0
  master.connect(audioCtx.destination)

  const oscs = []
  try {
    for (let i = 0; i < NOSC; i++) {
      const o = audioCtx.createOscillator()
      o.type = 'sine'
      o.frequency.value = DEFAULT_PITCH
      o.connect(master)        // all sum into master
      o.start()
      oscs.push(o)
    }
  } catch (e) {
    console.warn('[striate] oscillator setup failed — silent:', e?.message)
  }

  function update(features, motion, params) {
    paramState.value = { smooth: params.smooth ?? 0.5, floor: params.floor ?? 0.3 }
    if (oscs.length !== NOSC) return

    const spread = params.spread ?? 30
    const level = params.level ?? 0.5
    const entropy = clamp(features.entropy ?? 1, 0, 1)
    const angles = features.angles && features.angles.length ? features.angles : null
    const t = audioCtx.currentTime

    // base pitch per oscillator: cycle through the prominent grains (dominant,
    // listed first, naturally gets more oscillators); none -> default center.
    const nActive = angles ? angles.length : 0
    for (let i = 0; i < NOSC; i++) {
      const base = nActive ? angleToPitch(angles[i % nActive]) : DEFAULT_PITCH
      const f = clamp(base + detuneAt(i, spread, entropy), 40, 4000)
      oscs[i].frequency.setTargetAtTime(f, t, 0.08)
    }

    // five summed sines peak hot; scale before the master level
    master.gain.setTargetAtTime(clamp(level, 0, 1) * 0.2, t, 0.1)
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
