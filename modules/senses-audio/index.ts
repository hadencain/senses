import { requireNativeModule } from 'expo-modules-core'

export type GrainOptions = {
  position: number      // 0..1 — where in the 8s circular buffer to read from
  durationSec: number   // grain length in seconds (recommend 0.02..0.3)
  pitchRatio?: number   // 1.0 = original pitch, 0.5 = octave down, 2.0 = octave up
  amplitude?: number    // 0..1, default 0.5
}

export type PlaybackOptions = {
  active: boolean
  loopStart?: number    // 0..1, default 0
  loopEnd?: number      // 0..1, default 1
  rate?: number         // playback speed (also shifts pitch), default 1.0
}

type SensesAudioModule = {
  startCapture(): Promise<void>
  stopCapture(): void
  triggerGrain(opts: GrainOptions): void
  setPlayback(opts: PlaybackOptions): void
  setMasterGain(gain: number): void
  getBufferFill(): number   // 0..1 — how full the 8s buffer is
}

export default requireNativeModule<SensesAudioModule>('SensesAudio')
