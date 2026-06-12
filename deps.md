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

Native (local Expo module): `modules/senses-recorder` — MediaProjection screen recording. No npm dep.

Version changes from the 2026-06-02 scaffold: react 18.3.2 → 18.3.1 (18.3.2 does not exist in the npm registry; 18.3.1 is the latest React 18.x and satisfies RN 0.76.5's peer range `^18.2.0`)
