export const manifest = {
  id: 'Striate',
  label: 'Striate',
  sub: 'grain → order vs noise',
  accent: '#9fb4c0',
  category: 'live / camera',
  type: 'live',
  params: [
    // audio master gain
    { key: 'level',  label: 'level',  min: 0,   max: 1,  default: 0.5, step: 0.01 },
    // max detune spread at full entropy (order -> noise)
    { key: 'spread', label: 'spread', min: 0,   max: 60, default: 30,  step: 0.5, unit: 'hz' },
    // edge magnitude threshold — below it a gradient is "no grain"
    { key: 'floor',  label: 'floor',  min: 0,   max: 1,  default: 0.3, step: 0.01 },
    // histogram smoothing (steadies the grain reading)
    { key: 'smooth', label: 'smooth', min: 0,   max: 1,  default: 0.5, step: 0.01 },
    // comb line density
    { key: 'lines',  label: 'lines',  min: 0.2, max: 2,  default: 1,   step: 0.05 },
  ],
  overlay: ['entropy', 'density'],
}
