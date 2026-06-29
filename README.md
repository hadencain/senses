# Senses

A camera-driven **audiovisual instrument** for Android. Point the phone at the
world and it plays: each effect turns the live camera, light, and motion into
synchronized visuals *and* real-time sound, derived from one shared feature
stream — then records the result to video.

These aren't filters. They're things you *play* — with movement, light, and
stillness.

## Effects

Each effect is a self-contained module. Current set:

| Effect | What it does |
|--------|--------------|
| Grain Field | motion → granular synthesis |
| Larsen | stillness → feedback (presence silences it, absence lets it sing) |
| Rust | duration → corrosion (the frame ages where things happen) |
| Zero Beat | balance the frame's light to null two oscillators to silence |
| Redaction | move and you're erased; hold still and the image heals |
| Bloom | stir the dark and it glows where you touched, fading cool→warm |
| Latent | the room develops like film — change surfaces, then sinks over ~30s |
| Striate | reads the dominant grain direction; tunes order against noise |

## Architecture

The host (`src/components/EffectScreen.jsx`) owns the camera, chrome, overlay,
settings, and recording. An effect is one folder in `src/modes/` implementing a
four-file contract — `manifest` (identity + params), `processor` (camera frame →
features, a worklet), `synth` (features + motion → audio), `render` (features →
Skia visuals, a worklet) — plus one registry line. See `EFFECTS_GUIDE.md`.

Pure control logic lives in `dsp.js` per effect and is unit-tested in Node.

Recording captures a **take** (raw video + a timestamped sidecar of
features/motion/params) for deterministic offline re-render at full resolution —
see the Takes library (`src/capture/`, `src/screens/TakesLibrary.jsx`).

## Stack

React Native 0.76 / Expo SDK 52 · react-native-vision-camera (frame processors)
· @shopify/react-native-skia (rendering) · react-native-worklets-core ·
react-native-audio-api + a native Oboe granular module (`modules/senses-audio`)
· MediaProjection screen/native recording (`modules/senses-recorder`).
Android only; developed against a Samsung S24 Ultra.

## Build

```bash
npx expo prebuild --platform android   # regenerate android/ (gitignored)
npx expo run:android                   # build + install on a USB device
```

JS-only changes (effects, capture) hot-reload via `npx expo start`. Native
changes (Kotlin, app.json, minSdkVersion) need a full rebuild.

Run the pure-logic tests directly with Node, e.g.:

```bash
node src/modes/rust/dsp.test.cjs
node src/capture/sidecar.test.cjs
```

## Status

Experimental / active. All eight effects and the take-capture pipeline are
built and unit-tested; on-device tuning and the offline re-render compositor
(Phase 2) are in progress.
