# Senses — Effects Guide

How to add an effect to Senses. An effect is one folder in `src/modes/` plus one
registry line. The host (`src/components/EffectScreen.jsx`) owns the camera,
chrome, settings, overlay rail, and recording — you never touch those.

---

## Quick implementation steps

1. Create `src/modes/<your-effect>/` with the five files below
2. Register it in `src/modes/index.js`
3. Rebuild and verify on device (see Build & Dev below)

That's it. Menu row, navigation, settings sliders, overlay rail, and recording
all derive from the manifest automatically.

---

## The four-file contract

### 1. `manifest.js` — identity + parameters

```js
export const manifest = {
  id: 'YourEffect',          // unique PascalCase — used as nav key
  label: 'Your Effect',      // menu display name
  sub: 'what → what',        // one-line description
  accent: '#c8a96e',         // hex color: menu pip, overlay values, sliders
  category: 'live / camera', // menu section header
  type: 'live',              // 'live' (camera) or 'editor' (phase 2 stub)
  params: [
    { key: 'level', label: 'level', min: 0, max: 1, default: 0.7, step: 0.01 },
    // optional: { ..., unit: 'hz' }
  ],
  overlay: ['speed', 'brightness'],  // keys shown on the left-edge rail (≤ 4)
}
```

Validated at app launch in dev — a malformed manifest throws with exact errors.

---

### 2. `processor.js` — camera frames → features (worklet)

```js
export function extractFeatures(frame) {
  'worklet'
  try {
    const buf = frame.toArrayBuffer()   // see KNOWN ISSUES below
    const data = new Uint8Array(buf)
    // Y-plane pixel at (x, y): data[y * frame.bytesPerRow + x]
    // NOT data[y * frame.width + x] — bytesPerRow != width in YUV
    return { brightness: computeBrightness(data, frame) }
  } catch {
    return { brightness: 0.5 }          // always return fallback on error
  }
}

function computeBrightness(data, frame) {
  'worklet'
  // sample 16×16 grid for speed
  const GRID = 16
  let sum = 0
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const px = Math.floor((gx / GRID) * frame.width)
      const py = Math.floor((gy / GRID) * frame.height)
      sum += data[py * frame.bytesPerRow + px]
    }
  }
  return sum / (GRID * GRID * 255)
}
```

**WORKLET RULES** — violating these causes a red screen or silent failure:
- `'worklet'` directive must be the first statement in every exported function
  and every helper it calls.
- No React, no closures over component state, no imports touching the JS thread.
  Pure math on the frame only.
- Budget: ≤ 5 ms. Sample a coarse grid; never iterate every pixel.
- Every returned feature value must be a plain number (not undefined, not NaN).

**KNOWN ISSUE — `frame.toArrayBuffer()` requires minSdkVersion ≥ 26:**
VisionCamera v4 throws at runtime if the app's declared `minSdkVersion < 26`.
The S24 Ultra runs API 34 but the build config controls this check, not the
device. Fix:
1. Add `android.minSdkVersion=26` to `android/gradle.properties`
2. Add `"minSdkVersion": 26` inside the `expo-build-properties` android block
   in `app.json`
3. Run a full rebuild (not hot-reload — this is a native config change)
Always wrap `toArrayBuffer()` in try/catch regardless so the effect still
renders if the check fails.

---

### 3. `synth.js` — features + motion + params → sound

```js
export function createSynth(audioCtx) {
  const master = audioCtx.createGain()
  master.gain.value = 0.25
  master.connect(audioCtx.destination)

  function update(features, motion, params) {
    // called ~30×/sec from JS thread
    // features = your extractFeatures output
    // motion = { speed, tilt }  (both 0..1)
    // params = current slider values keyed by manifest param keys
    master.gain.setTargetAtTime(params.level ?? 0.7, audioCtx.currentTime, 0.1)
  }

  function dispose() {
    try { master.disconnect() } catch {}
  }

  return { update, dispose }
}
```

**react-native-audio-api — implemented nodes (confirmed working):**
- `AudioContext`, `AudioContext.currentTime`, `AudioContext.destination`
- `createGain()` → `GainNode` (gain.value, setValueAtTime, linearRampToValueAtTime,
  exponentialRampToValueAtTime, setTargetAtTime)
- `createOscillator()` → `OscillatorNode` (type, frequency, start, stop)

**react-native-audio-api — NOT implemented (throws "not a function"):**
- `createDelay()` — DelayNode is missing. Remove delay/reverb from your graph.
- Assume any node not in the confirmed list above may be missing. Test before
  building a graph that depends on it.

The host creates and closes the AudioContext — never call `ctx.close()` yourself.
`dispose()` is called when the user leaves the effect; disconnect everything
you created.

---

### 4. `render.js` — features + motion + params → visuals (worklet)

```js
import { Skia } from '@shopify/react-native-skia'

export function makePicture({ features, motion, params, dims }) {
  'worklet'
  const recorder = Skia.PictureRecorder()
  const canvas = recorder.beginRecording(
    Skia.XYWHRect(0, 0, dims.width, dims.height)
  )

  const paint = Skia.Paint()
  paint.setColor(Skia.Color('#c8a96e'))
  paint.setAlphaf(features.brightness ?? 0.5)
  canvas.drawCircle(dims.width / 2, dims.height / 2, 40 * (motion.speed + 0.1), paint)

  return recorder.finishRecordingAsPicture()
}
```

Same worklet rules as `processor.js`. Budget: ≤ 8 ms per frame.
The picture is composited over the live camera preview; the camera always shows
through underneath. Drawing nothing is valid (transparent overlay).

---

### 5. `index.js` — assemble

```js
import { manifest } from './manifest'
import { extractFeatures } from './processor'
import { createSynth } from './synth'
import { makePicture } from './render'
export const mode = { manifest, extractFeatures, createSynth, makePicture }
```

---

## Registering the effect

In `src/modes/index.js`:

```js
import { mode as YourEffect } from './your-effect'
export const MODES = [GrainField, YourEffect]   // order = menu order
```

That's the only file outside your folder you touch.

---

## Reference implementation

`src/modes/grain-field/` — motion-driven granular synth + scattered grain
rendering. Read all five files before writing a new effect; match its structure.

---

## Build & dev workflow

**First-time setup (per machine):**
- JAVA_HOME must point to Android Studio's bundled JRE:
  `C:\Program Files\Android\Android Studio\jbr`
- Set per-session in PowerShell: `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"`
- `android/local.properties` must exist with `sdk.dir=C\:\\Users\\haden\\AppData\\Local\\Android\\Sdk`
  This file is gitignored and deleted by `--clean` prebuild — recreate it manually.

**Building and running:**
```powershell
# From the project root (src/Senses), not a parent directory
cd C:\Users\haden\Documents\Ship\src\Senses
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
npx expo run:android
```
This builds the APK via Gradle, installs it via ADB, and starts Metro.
Subsequent runs use Gradle's build cache — only changed modules recompile.

**Hot-reload for JS-only changes:**
After the APK is installed, start Metro separately and keep it running:
```powershell
npx expo start
```
JS changes (processor.js, render.js, synth.js, manifest.js) hot-reload
without a rebuild. Native changes (Kotlin, build.gradle, app.json plugins,
minSdkVersion) require a full `npx expo run:android`.

**If Metro loses the device connection:**
```powershell
adb reverse tcp:8081 tcp:8081
```
Then shake the device and tap Reload, or press `r` in the Metro terminal.

**Opening the app:**
The dev build installs as "Senses" in the app drawer — not Expo Go.
On cold launch it shows the Expo Dev Client launcher; scan the QR code from
within that screen (not the phone's camera app — the URL scheme is `exp+senses://`
which only the installed dev build handles).

---

## How the data flows (for context)

```
Camera frame
  → extractFeatures(frame)        [worklet, frame processor thread]
  → featuresSV.value = features   [shared value]
  → onFeaturesJS(features)        [bridge to JS thread]
      → synth.update(features, motion, params)
      → setOverlay(...)
  → makePicture(...)              [worklet, UI thread, via useDerivedValue]
  → <Picture picture={...} />     [rendered over camera]
```

`motion` comes from `useMotion()` (expo-sensors accelerometer/gyro).
`params` come from the settings sliders, persisted via AsyncStorage.

---

## Recording

MediaProjection screen capture: whatever is visible — your rendered picture,
the overlay rail, the rec indicator — is baked into the MP4 file.

**Audio in recordings:**
- Mic audio (MediaRecorder.AudioSource.MIC) is captured and mixed in.
- In-app synth audio via AudioPlaybackCapture: may be silent if
  react-native-audio-api does not declare `ALLOW_CAPTURE_BY_ALL` on its
  AudioTrack. This is a library limitation — you cannot fix it from effect code.
- The recording works correctly regardless; mic audio is reliable.

**You don't do anything for recording.** It works for every effect automatically
once the effect is rendering to the screen.

---

## Checklist for a new effect

- [ ] `src/modes/<effect>/` folder with manifest / processor / synth / render / index
- [ ] `'worklet'` directive on `extractFeatures`, `makePicture`, and every helper
- [ ] `frame.toArrayBuffer()` wrapped in try/catch with numeric fallback values
- [ ] Pixel indexing uses `frame.bytesPerRow`, not `frame.width`
- [ ] No `createDelay()` or other unimplemented Audio API nodes
- [ ] `dispose()` disconnects all audio nodes
- [ ] Every feature value is a plain finite number
- [ ] params have sane min/max/default (validator enforces shape, not taste)
- [ ] overlay lists ≤ 4 keys
- [ ] Registered in `src/modes/index.js`
- [ ] Dev build launches without validator errors in Metro console
- [ ] On-device: camera shows through, visuals respond to motion, audio responds,
      sliders change behavior, recording plays back correctly
