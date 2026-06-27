export const manifest = {
  id: 'Latent',
  label: 'Latent',
  sub: 'the room develops like film',
  accent: '#b8b0a8',
  category: 'live / camera',
  type: 'live',
  params: [
    // plate speed: higher = the plate catches up faster = ghosts fade sooner
    { key: 'develop',  label: 'develop',  min: 0,   max: 1, default: 0.5, step: 0.01 },
    // deviation gain: how strongly the developing ghost shows
    { key: 'contrast', label: 'contrast', min: 0,   max: 1, default: 0.5, step: 0.01 },
    // audio master gain
    { key: 'level',    label: 'level',    min: 0,   max: 1, default: 0.5, step: 0.01 },
    // grain rate
    { key: 'density',  label: 'density',  min: 0.2, max: 2, default: 1,   step: 0.05 },
  ],
  overlay: ['devMag', 'activity'],
}
