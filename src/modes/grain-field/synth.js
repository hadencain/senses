// Granular synth: fires clouds of short detuned oscillators.
// grain density and pitch range driven by motion speed + scene brightness.

export function createGrainSynth(audioCtx) {
  const master = audioCtx.createGain()
  master.gain.value = 0.25
  master.connect(audioCtx.destination)

  // Subtle reverb via feedback delay
  const delay = audioCtx.createDelay(0.5)
  delay.delayTime.value = 0.18
  const delayGain = audioCtx.createGain()
  delayGain.gain.value = 0.3
  master.connect(delay)
  delay.connect(delayGain)
  delayGain.connect(delay)
  delayGain.connect(audioCtx.destination)

  function fire(pitchHz, durationSec, amplitude = 0.3) {
    const now = audioCtx.currentTime
    const env = audioCtx.createGain()
    const osc = audioCtx.createOscillator()

    osc.type = 'sawtooth'
    osc.frequency.value = pitchHz

    // tiny attack, exponential decay
    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(amplitude, now + 0.004)
    env.gain.exponentialRampToValueAtTime(0.0001, now + durationSec)

    osc.connect(env)
    env.connect(master)

    osc.start(now)
    osc.stop(now + durationSec + 0.01)
  }

  let lastFire = 0

  function burst(speed, brightness, variance) {
    const now = Date.now()
    // density: faster motion → more grains, shorter
    const density = Math.floor(1 + speed * 12)
    const minGap = 30 - speed * 25 // ms between bursts
    if (now - lastFire < minGap) return
    lastFire = now

    // pitch range scales with scene complexity
    const baseHz = 80 + brightness * 400
    const spread = 1 + variance * 800

    for (let i = 0; i < density; i++) {
      const pitchHz = baseHz + (Math.random() - 0.5) * spread
      const dur = 0.015 + Math.random() * 0.18 * (1 - speed * 0.6)
      const amp = 0.1 + Math.random() * 0.25
      setTimeout(() => fire(pitchHz, dur, amp), i * (8 + Math.random() * 12))
    }
  }

  function setMasterGain(v) {
    master.gain.setTargetAtTime(v * 0.35, audioCtx.currentTime, 0.1)
  }

  return { burst, setMasterGain }
}
