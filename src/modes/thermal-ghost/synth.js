// Ambient decay synth: reverb-heavy pad that sustains on motion and fades to silence.
// Motion → pad amplitude. Ghost persistence → reverb tail length.

export function createGhostSynth(audioCtx) {
  const master = audioCtx.createGain()
  master.gain.value = 0
  master.connect(audioCtx.destination)

  // Long feedback delay as reverb substitute
  const delay = audioCtx.createDelay(2.0)
  delay.delayTime.value = 0.38
  const feedback = audioCtx.createGain()
  feedback.gain.value = 0.55
  const delayMix = audioCtx.createGain()
  delayMix.gain.value = 0.6

  master.connect(delay)
  delay.connect(feedback)
  feedback.connect(delay)
  delay.connect(delayMix)
  delayMix.connect(audioCtx.destination)

  // Two detuned pads
  const oscs = [130.8, 131.2, 196, 196.5].map(freq => {
    const osc = audioCtx.createOscillator()
    const env = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    env.gain.value = 0
    osc.connect(env)
    env.connect(master)
    osc.start()
    return { osc, env }
  })

  let prevMotion = 0

  function update(totalMotion, ghostIntensity) {
    const now = audioCtx.currentTime
    const target = Math.min(0.8, totalMotion * 6 + ghostIntensity * 0.3)

    // Slow attack on motion onset, fast decay when motion stops
    const tau = totalMotion > prevMotion ? 0.6 : 1.2
    master.gain.setTargetAtTime(target * 0.4, now, tau)

    // Slightly animate pitch with ghost intensity for a haunted quality
    oscs.forEach(({ osc }, i) => {
      const baseFreq = [130.8, 131.2, 196, 196.5][i]
      osc.frequency.setTargetAtTime(baseFreq * (1 + ghostIntensity * 0.008), now, 0.5)
    })

    prevMotion = totalMotion
  }

  function close() {
    oscs.forEach(({ osc }) => osc.stop())
  }

  return { update, close }
}
