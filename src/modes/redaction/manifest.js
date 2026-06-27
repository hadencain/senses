export const manifest = {
  id: 'Redaction',
  label: 'Redaction',
  sub: 'move → erased',
  accent: '#8a2030',
  category: 'live / camera',
  type: 'live',
  params: [
    // attack: how readily local motion censors the frame
    { key: 'sensitivity', label: 'sensitivity', min: 0, max: 1,  default: 0.5, step: 0.01 },
    // decay: how fast pressure bleeds back during stillness (the heal)
    { key: 'heal',        label: 'heal',        min: 0, max: 1,  default: 0.3, step: 0.01 },
    // audio master gain (gated by coverage)
    { key: 'level',       label: 'level',       min: 0, max: 1,  default: 0.4, step: 0.01 },
    // square detune spread — roughness of the gated buzz
    { key: 'grind',       label: 'grind',       min: 0, max: 30, default: 15,  step: 0.5, unit: 'hz' },
  ],
  overlay: ['coverage', 'peak'],
}
