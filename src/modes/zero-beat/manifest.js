export const manifest = {
  id: 'ZeroBeat',
  label: 'Zero Beat',
  sub: 'balance light → null the beat',
  accent: '#6ea8c8',
  category: 'live / camera',
  type: 'live',
  params: [
    // center tone of the pair
    { key: 'pitch', label: 'pitch', min: 110, max: 440, default: 220, step: 1, unit: 'hz' },
    // Hz of detune at full L/R imbalance — how twitchy the beat is
    { key: 'range', label: 'range', min: 2,   max: 30,  default: 12,  step: 0.5, unit: 'hz' },
    // master gain
    { key: 'level', label: 'level', min: 0,   max: 1,   default: 0.3, step: 0.01 },
    // null-zone width: how close to balanced the visual lock-glow trips
    { key: 'lock',  label: 'lock',  min: 0,   max: 1,   default: 0.5, step: 0.01 },
  ],
  overlay: ['L', 'R', 'diff'],
}
