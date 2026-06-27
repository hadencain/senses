# Senses Modules — Inventory

Catalog of all effect modules in `Senses modules brainstorming.md`
(`Synced_Vault/main/AIOS/Prompts/`). Eight modules, all camera-input effects
for the live-camera + motion-synth + recording app. Indexed below by several
axes (temporal model, processor signal, sound engine, render layer) so each
can be picked apart for migration via EFFECTS_GUIDE.md.

> Note: **Larsen** is already in active development on `senses-scaffold`
> (recent commits: hybrid feedback synth, SkSL parametric bloom, modes
> registry). The rest are unbuilt concepts.

---

## Master table

| Module | Senses (processor extract) | Render | Sound engine | Temporal model | Scalar-safe? | Tags |
|--------|----------------------------|--------|--------------|----------------|--------------|------|
| **Rust** | Per-cell activity accumulator (edge+motion), never resets, decay α≈0.0002; outputs flat grid + global sum | SkSL oxidation lookup (clean→patina→flaking rust) + self-noise | Web Audio saw-pair drone, detunes down over minutes | Duration / cumulative | No (grid) | duration-as-artifact |
| **Larsen** ⚙️ | `totalMotion` EMA only; below stillness threshold emit rising `feedbackGain`, motion → 0 | SkSL bloom, self-doubling as gain climbs; movement snaps dark | Native buffer loop + rising `setMasterGain` → controlled Larsen feedback tone | Reactive (inverse) | Yes (scalar) | productive sabotage, risky (cap gain) |
| **Bloom** | Motion map (per-cell diff) fed into render-side decay buffer; + peak-motion cell location | Starts black (alpha overlay); motion injects light into persistent decaying buffer (~2s), cool→warm with age | Web Audio sine pings (pitch = vertical pos) + native granular shimmer | Reactive + short decay | No (map) | bioluminescence, restraint |
| **Latent** | Very-slow EMA of coarse luma grid (α≈0.005, ~30s settle) as background plate; per-cell signed deviation `current − slowAvg` + peak cell idx/mag | SkSL paints deviation only: +bright silver, −bromide brown, 0 transparent | Native granular; grains indexed by spatial location of peak deviation (top→recent buffer, bottom→older), amp = deviation mag | Developing (~30s lag) | No (grid) | film-develops, chemistry-not-detection |
| **Zero Beat** | Mean luma left half vs right half; outputs `L`, `R`, `diff = L−R` | Two circle outlines (radius ∝ each half brightness); converge concentrically as diff→0 | Two sines near 220 Hz; detune Hz = `diff*12`; beating rate = the difference | Reactive | **Yes** | tuning-instrument, sound-is-feature |
| **Redaction** | Per-quadrant frame-diff → `pressure[q]`, accumulates w/ motion, decays toward 0 on stillness | Opaque `drawRect` bars censor high-pressure quadrants; stillness bleeds alpha back | 3 detuned square waves ±15 Hz, gated by total pressure | Reactive + memory decay | **Yes** | productive sabotage, hostile-to-input, risky |
| **Striate** | Per-cell Sobel angle → 8 orientation buckets; outputs 8 counts + entropy scalar | Comb of parallel `Path` lines, angle = dominant bucket; spacing tightens w/ edge density | Dominant angle → pitch 110–220 Hz; entropy → detune spread of 5 oscillators (unison↔±30 Hz cluster) | Reactive | ~Yes (8 nums) | signal-to-noise instrument |

⚙️ = in active development.

---

## Grouped by axis

### By temporal model (the app's core differentiator)
- **Instant-reactive** (the app's default model): Zero Beat, Striate
- **Reactive w/ memory decay**: Larsen, Bloom, Redaction
- **Developing / lagged** (artifact emerges after you stop): Latent (~30s)
- **Cumulative / duration-bound** (no good short clip; the take *is* the work): Rust

### By processor signal extracted
- **Motion / frame-diff**: Larsen (`totalMotion` EMA), Bloom (per-cell diff map), Redaction (per-quadrant diff pressure), Rust (edge+motion accumulator)
- **Luma**: Zero Beat (L/R half means), Latent (slow-EMA luma plate + deviation)
- **Edge / orientation**: Striate (Sobel angle histogram + entropy), Rust (edge component)

### By render layer
- **SkSL shader**: Rust, Larsen, Latent (and Bloom's light injection is render-state EMA)
- **Canvas/skia draw primitives**: Zero Beat (`circle`), Redaction (`drawRect`), Striate (`Path`)
- **Persistent decay buffer in render state**: Bloom, (Larsen's self-doubling bloom)

### By sound engine (dependency-relevant)
- **Web Audio only**: Rust (saw drone), Zero Beat (two sines), Striate (5 oscillators), Redaction (3 square waves)
- **Native buffer / granular**: Larsen (buffer loop + master gain feedback), Latent (granular, spatially indexed)
- **Hybrid (Web Audio + native granular)**: Bloom (sine pings + granular shimmer)

### Scalar-safe (cheap bridge payload — single numbers, no grids)
- **Fully scalar-safe**: Zero Beat (L/R/diff), Redaction (4 quadrant pressures)
- **Small fixed vector**: Striate (8 buckets + entropy)
- **Requires grid/array transport**: Rust, Bloom, Latent

### "Productive sabotage" cluster (effect argues with the user)
- **Larsen** — presence damps, absence sings; cap gain or it howls (risky)
- **Redaction** — move and you vanish; only stillness lets you be seen (the riskiest, hostile-to-input)
- *(Rust is adjacent — it corrodes the busy regions, punishing activity over time)*

---

## Implementation / dependency notes called out in source

- **Rust**: decay alpha ≈ 0.0002; accumulator never resets — needs persistent
  per-cell state across the whole recording. Artifact only legible across a
  full take; breaks the app's "instant reactive effect" assumption.
- **Larsen**: hard cap on gain ceiling required — keep it low so howl stays a
  texture, not a fire alarm. Relies on native buffer capturing synth output
  (playback-capture) to close the feedback loop.
- **Bloom**: explicitly distinct from "Thermal Ghost" — decay lives in
  render-side buffer (EMA in render state), not drawn as instantaneous trails.
  Camera dimmed by alpha overlay to start black.
- **Latent**: ~30s settle time on the background plate (α≈0.005). Grains
  indexed by frame position → buffer position (spatial→temporal mapping).
- **Zero Beat**: scalar-safe. Sound *is* the feature physically (beat rate =
  luma difference), not a sonification layered on top.
- **Redaction**: scalar-safe, uses decaying per-quadrant memory.
- **Striate**: scalar-safe-ish (8 orientation counts + 1 entropy scalar).
  Order/noise are the same control (entropy → detune spread).
