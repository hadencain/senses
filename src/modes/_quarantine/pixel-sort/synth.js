// Pitch sweep synth: each active column triggers a frequency glide.
// Brightness → pitch target. Column position → stereo pan (not available in RNAA, use pitch offset).
// High variance columns → faster sweeps.

const MIN_HZ = 120
const MAX_HZ = 3200
const VOICE_COUNT = 8

export function createPixelSortSynth(audioCtx) {
  const master = audioCtx.createGain()
  master.gain.value = 0.25
  master.connect(audioCtx.destination)

  const voices = Array.from({ length: VOICE_COUNT }, () => {
    const osc = audioCtx.createOscillator()
    const env = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 440
    env.gain.value = 0
    osc.connect(env)
    env.connect(master)
    osc.start()
    return { osc, env, free: true }
  })

  let voiceIdx = 0

  function sweep(brightness, variance, normalizedX) {
    const voice = voices[voiceIdx % VOICE_COUNT]
    voiceIdx++

    const targetHz = MIN_HZ + brightness * (MAX_HZ - MIN_HZ)
    const startHz = targetHz * (variance > 0.02 ? 2 : 0.5)
    const duration = 0.08 + (1 - variance) * 0.4
    const now = audioCtx.currentTime

    voice.osc.frequency.cancelScheduledValues(now)
    voice.osc.frequency.setValueAtTime(startHz, now)
    voice.osc.frequency.exponentialRampToValueAtTime(targetHz, now + duration)

    const amp = 0.05 + variance * 0.3
    voice.env.gain.setValueAtTime(amp, now)
    voice.env.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.05)
  }

  let frame = 0

  function update(columns) {
    frame++
    // Fire sweeps on columns that have high variance (active pixel sorting)
    const active = columns
      .map((c, i) => ({ ...c, i }))
      .filter(c => c.variance > 0.015)
      .sort((a, b) => b.variance - a.variance)
      .slice(0, 4)

    active.forEach(c => {
      if (frame % 2 === 0 || c.variance > 0.04) {
        sweep(c.brightness, c.variance, c.i / columns.length)
      }
    })
  }

  return { update }
}
