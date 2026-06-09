// Percussion synth: filtered noise bursts tuned by edge density.
// Strong edges → harder hit. Dense edges → layered hits.

export function createEdgeSynth(audioCtx) {
  const master = audioCtx.createGain()
  master.gain.value = 0.5
  master.connect(audioCtx.destination)

  function hit(strength, tone) {
    const now = audioCtx.currentTime

    // Noise-like body: short detuned oscillator burst
    const body = audioCtx.createOscillator()
    const bodyEnv = audioCtx.createGain()
    const filter = audioCtx.createBiquadFilter()

    filter.type = 'bandpass'
    filter.frequency.value = 200 + tone * 2200
    filter.Q.value = 0.8

    body.type = 'square'
    body.frequency.value = 80 + tone * 400

    bodyEnv.gain.setValueAtTime(strength * 0.7, now)
    bodyEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.08 + strength * 0.05)

    body.connect(filter)
    filter.connect(bodyEnv)
    bodyEnv.connect(master)

    body.start(now)
    body.stop(now + 0.15)

    // Transient click
    const click = audioCtx.createOscillator()
    const clickEnv = audioCtx.createGain()
    click.frequency.value = 3000 + tone * 5000
    click.type = 'sine'
    clickEnv.gain.setValueAtTime(strength * 0.4, now)
    clickEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.012)
    click.connect(clickEnv)
    clickEnv.connect(master)
    click.start(now)
    click.stop(now + 0.02)
  }

  let lastHit = 0
  let prevDensity = 0

  function update(edgeStrength, edgeDensity) {
    const now = Date.now()
    const delta = edgeDensity - prevDensity
    prevDensity = edgeDensity

    // Only fire on density increase (new edges appearing)
    if (delta < 0.04 || edgeStrength < 0.05) return

    const minGap = 40 + (1 - edgeDensity) * 160
    if (now - lastHit < minGap) return
    lastHit = now

    const layers = 1 + Math.floor(edgeDensity * 3)
    for (let i = 0; i < layers; i++) {
      const tone = Math.random() * edgeDensity
      setTimeout(() => hit(edgeStrength * (0.5 + Math.random() * 0.5), tone), i * 15)
    }
  }

  return { update }
}
