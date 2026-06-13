export const manifest = {
  id: 'GrainField',
  label: 'Grain Field',
  sub: 'motion → granular synthesis',
  accent: '#c8a96e',
  category: 'live / camera',
  type: 'live',
  params: [
    { key: 'level',   label: 'level',   min: 0,   max: 1,   default: 0.7, step: 0.01 },
    { key: 'density', label: 'density', min: 0.2, max: 2,   default: 1,   step: 0.05 },
    { key: 'pitch',   label: 'pitch',   min: 40,  max: 600, default: 80,  step: 1, unit: 'hz' },
    { key: 'scatter', label: 'scatter', min: 0,   max: 1,   default: 0.6, step: 0.01 },
  ],
  overlay: ['speed', 'brightness', 'variance'],
}
