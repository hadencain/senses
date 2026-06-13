# Senses — Effects Guide

How to add an effect to Senses. An effect is one folder + one registry line.
The host (`src/components/EffectScreen.jsx`) owns the camera, chrome, settings,
overlay rail, and recording — you never touch those.

## The contract

Create `src/modes/<your-effect>/` with exactly these files:

### 1. `manifest.js` — identity + parameters

    export const manifest = {
      id: 'YourEffect',          // unique, PascalCase — used as nav key
      label: 'Your Effect',      // menu display name
      sub: 'what → what',        // one-line description, input → output
      accent: '#c8a96e',         // hex color: menu pip, overlay values, sliders
      category: 'live / camera', // menu section header
      type: 'live',              // 'live' (camera) or 'editor' (phase 2)
      params: [                  // each becomes a slider in the settings sheet
        { key: 'level', label: 'level', min: 0, max: 1, default: 0.7, step: 0.01 },
        // unit is optional: { ..., unit: 'hz' }
      ],
      overlay: ['speed', 'brightness'],  // feature/motion keys shown on the rail
    }

Validated at app launch in dev — a malformed manifest throws with the exact errors.

### 2. `processor.js` — camera frames → features (worklet)

    export function extractFeatures(frame) {
      'worklet'
      // frame: vision-camera Frame, YUV. frame.toArrayBuffer() = Y plane first.
      // Y-plane luminance of pixel (x, y): data[y * frame.bytesPerRow + x]
      return { brightness: 0.5 }   // EVERY value must be a plain number
    }

WORKLET RULES (violating these = red screen or silent failure):
- `'worklet'` directive must be the first line of the function body.
- No React, no closures over component state, no imports of anything that
  touches the UI/JS thread. Pure math on the frame only.
- Helpers in the same file are fine if they also carry `'worklet'`.
- Budget: ≤ 5 ms. Sample a coarse grid (16×16), never the full frame.

### 3. `synth.js` — features + motion + params → sound

    export function createSynth(audioCtx) {
      // build your node graph once, connect to audioCtx.destination
      function update(features, motion, params) {
        // called ~30×/sec from JS. features = your extractFeatures output.
        // motion = { speed, tilt } (0..1). params = current slider values.
      }
      function dispose() { /* disconnect everything */ }
      return { update, dispose }
    }

react-native-audio-api implements the Web Audio API surface
(OscillatorNode, GainNode, DelayNode, ...). The host creates and closes
the AudioContext — never close it yourself.

### 4. `render.js` — features + motion + params → visuals (worklet)

    import { Skia } from '@shopify/react-native-skia'

    export function makePicture({ features, motion, params, dims }) {
      'worklet'
      const recorder = Skia.PictureRecorder()
      const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, dims.width, dims.height))
      // draw with Skia.Paint() / canvas.drawRect / drawCircle / drawPath...
      return recorder.finishRecordingAsPicture()
    }

Runs on the UI thread every frame. Same worklet rules as processor.js.
Budget: ≤ 8 ms. The picture is composited over the live camera preview.

### 5. `index.js` — assemble

    import { manifest } from './manifest'
    import { extractFeatures } from './processor'
    import { createSynth } from './synth'
    import { makePicture } from './render'
    export const mode = { manifest, extractFeatures, createSynth, makePicture }

## Register it

In `src/modes/index.js`:

    import { mode as YourEffect } from './your-effect'
    export const MODES = [GrainField, YourEffect]

That's everything. Menu row, navigation, settings sliders, overlay rail,
and recording all derive from the manifest.

## Reference implementation

`src/modes/grain-field/` — motion-driven granular synth + scattered grain
rendering. Read all five files before writing a new effect; match its
structure exactly.

## Recording (how your effect ends up in a video)

Recording is MediaProjection screen capture: whatever is on screen — your
rendered picture, the overlay rail, the rec indicator — is baked into the
file, with the app's synth output and mic mixed into one audio track.
You don't do anything; it works for every effect automatically.

## Checklist for a new effect

- [ ] Folder with manifest / processor / synth / render / index
- [ ] Every feature value is a plain number
- [ ] `'worklet'` on extractFeatures, makePicture, and their helpers
- [ ] params have sane min/max/default (validator enforces shape, not taste)
- [ ] overlay lists ≤ 4 keys (rail stays secondary to footage)
- [ ] Registered in `src/modes/index.js`
- [ ] Dev build launches without validator errors
- [ ] On-device: visuals respond, audio responds, sliders work, recording plays back
