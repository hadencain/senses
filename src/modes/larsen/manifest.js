export const manifest = {
  id: 'Larsen',
  label: 'Larsen',
  sub: 'stillness → feedback',
  accent: '#e0556a',
  category: 'live / camera',
  type: 'live',
  params: [
    { key: 'sensitivity', label: 'sensitivity', min: 0, max: 1,   default: 0.5,  step: 0.01 },
    { key: 'build',       label: 'build',       min: 0, max: 1,   default: 0.4,  step: 0.01 },
    { key: 'ceiling',     label: 'ceiling',     min: 0, max: 0.6, default: 0.35, step: 0.01 },
    { key: 'bloom',       label: 'bloom',       min: 0, max: 1,   default: 0.6,  step: 0.01 },
  ],
  overlay: ['feedback', 'motion'],
}
