export function createSynth(audioCtx) {
  const master = audioCtx.createGain()
  master.gain.value = 0.25
  master.connect(audioCtx.destination)

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

    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(amplitude, now + 0.004)
    env.gain.exponentialRampToValueAtTime(0.0001, now + durationSec)

    osc.connect(env)
    env.connect(master)

    osc.start(now)
    osc.stop(now + durationSec + 0.01)
  }

  let lastFire = 0

  function update(features, motion, params) {
    master.gain.setTargetAtTime((params.level ?? 0.7) * 0.35, audioCtx.currentTime, 0.1)

    const speed = motion.speed
    const now = Date.now()
    const density = Math.floor((1 + speed * 12) * (params.density ?? 1))
    const minGap = 30 - speed * 25
    if (now - lastFire < minGap) return
    lastFire = now

    const baseHz = (params.pitch ?? 80) + (features.brightness ?? 0.5) * 400
    const spread = 1 + (features.variance ?? 0) * 800

    for (let i = 0; i < density; i++) {
      const pitchHz = baseHz + (Math.random() - 0.5) * spread
      const dur = 0.015 + Math.random() * 0.18 * (1 - speed * 0.6)
      const amp = 0.1 + Math.random() * 0.25
      setTimeout(() => fire(pitchHz, dur, amp), i * (8 + Math.random() * 12))
    }
  }

  function dispose() {
    try {
      master.disconnect()
      delay.disconnect()
      delayGain.disconnect()
    } catch {}
  }

  return { update, dispose }
}
