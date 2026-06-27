export const manifest = {
  id: 'Bloom',
  label: 'Bloom',
  sub: 'stir the dark → light',
  accent: '#3fd0c0',
  category: 'live / camera',
  type: 'live',
  params: [
    // glow decay length: higher = the bloom lingers longer before going black
    { key: 'fade',   label: 'fade',   min: 0, max: 1, default: 0.5, step: 0.01 },
    // injection gain: how readily motion lights the dark
    { key: 'bright', label: 'bright', min: 0, max: 1, default: 0.5, step: 0.01 },
    // how hidden the room is behind the black overlay
    { key: 'dark',   label: 'dark',   min: 0, max: 1, default: 0.6, step: 0.01 },
    // audio master gain
    { key: 'level',  label: 'level',  min: 0, max: 1, default: 0.5, step: 0.01 },
  ],
  overlay: ['glow', 'dist'],
}
