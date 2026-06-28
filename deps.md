# Senses — Dependencies

| Package | Why | Added |
|---|---|---|
| react-native-vision-camera | camera preview + frame processors | 2026-06-02 |
| @shopify/react-native-skia | effect rendering canvas | 2026-06-02 |
| react-native-reanimated + worklets-core | shared values, worklet runtime | 2026-06-02 |
| react-native-audio-api | Web-Audio-style synthesis | 2026-06-02 |
| expo-sensors | accelerometer / gyro | 2026-06-02 |
| @react-navigation/native + stack | screen routing | 2026-06-02 |
| @react-native-async-storage/async-storage | per-effect param persistence | 2026-06-11 |
| @react-native-community/slider | settings sheet sliders | 2026-06-11 |
| expo-build-properties | force kotlinVersion=1.9.25 via config plugin (RN 0.76 BOM resolves 1.9.24 without it, breaking Compose Compiler 1.5.15) | 2026-06-13 |
| expo-file-system | take storage for re-render capture (take dirs: raw.mp4 + sidecar.json + meta.json under documentDirectory/takes/) | 2026-06-27 |

Native (local Expo modules):
- `modules/senses-recorder` — MediaProjection screen recording. No npm dep.
- `modules/senses-audio` — Oboe mic capture + grain playback engine. Android NDK required. C++ dep: `com.google.oboe:oboe:1.9.0` (via Maven prefab), version-matched to react-native-audio-api which also bundles Oboe. Both ship `liboboe.so`; the app keeps a single copy via `packagingOptions.pickFirst: ["**/liboboe.so"]` in app.json's expo-build-properties.

Version changes from the 2026-06-02 scaffold:
- react 18.3.2 → 18.3.1 (18.3.2 does not exist in npm; 18.3.1 is latest React 18.x)
- expo-dev-client: scaffolded ~4.0.0 (original plan). A prior agent bumped to ~5.0.0 (wrong SDK); reverted to ~4.0.0.
- app.json: removed `@shopify/react-native-skia` from plugins array (Skia has no config plugin; it broke prebuild)

RN 0.76 compat patches (applied via `postinstall` → `scripts/patch-rn76-compat.js`):
- expo-dev-menu-interface 1.8.4: removed JSEngineResolutionAlgorithm (removed in RN 0.76 New Arch)
- expo-dev-menu 5.0.23: same JSEngineResolutionAlgorithm removal; fixed PackagerConnectionSettings override (Java method → Kotlin property)
- expo-dev-launcher (same version): same two fixes as expo-dev-menu
