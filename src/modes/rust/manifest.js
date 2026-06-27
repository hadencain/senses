export const manifest = {
  id: 'Rust',
  label: 'Rust',
  sub: 'duration → corrosion',
  accent: '#b5651d',
  category: 'live / camera',
  type: 'live',
  params: [
    // heal: leak rate of the accumulator. Low = rust is near-permanent within a
    // take; high = the frame heals back to clean faster when activity stops.
    { key: 'heal',  label: 'heal',  min: 0, max: 1, default: 0.3, step: 0.01 },
    // bite: how readily accumulated activity tips into rust (oxidation contrast).
    { key: 'bite',  label: 'bite',  min: 0, max: 1, default: 0.5, step: 0.01 },
    // level: drone master gain.
    { key: 'level', label: 'level', min: 0, max: 1, default: 0.4, step: 0.01 },
    // sag: how far the saw pair sinks in pitch as the room corrodes.
    { key: 'sag',   label: 'sag',   min: 0, max: 1, default: 0.6, step: 0.01 },
  ],
  overlay: ['rustSum', 'peak'],
}
