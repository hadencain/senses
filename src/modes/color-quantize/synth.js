// Drone synth: one oscillator per dominant color zone.
// Hue → pitch (full spectrum = one octave). Weight → amplitude. Saturation-like spread → detune.

const BASE_HZ = 55 // A1
const OCTAVE_RATIO = 2

function hueToPitch(hue) {
  // Map 0–360° to one octave starting at BASE_HZ
  return BASE_HZ * Math.pow(OCTAVE_RATIO, hue / 360)
}

export function createQuantizeSynth(audioCtx) {
  const master = audioCtx.createGain()
  master.gain.value = 0.3
  master.connect(audioCtx.destination)

  const filter = audioCtx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 800
  filter.Q.value = 0.7
  filter.connect(master)

  // Up to 4 drone voices
  const voices = Array.from({ length: 4 }, () => {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'triangle'
    gain.gain.value = 0
    osc.connect(gain)
    gain.connect(filter)
    osc.start()
    return { osc, gain }
  })

  function update(colors) {
    // colors: [{ r, g, b, weight, hue }, ...]
    const now = audioCtx.currentTime
    for (let i = 0; i < voices.length; i++) {
      const { osc, gain } = voices[i]
      const color = colors[i]
      if (!color || color.weight < 0.04) {
        gain.gain.setTargetAtTime(0, now, 0.4)
        continue
      }
      const targetHz = hueToPitch(color.hue)
      osc.frequency.setTargetAtTime(targetHz, now, 0.3)
      gain.gain.setTargetAtTime(color.weight * 0.7, now, 0.5)
    }
  }

  function close() {
    voices.forEach(({ osc }) => osc.stop())
  }

  return { update, close }
}
