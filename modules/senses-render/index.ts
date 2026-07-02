import { requireNativeModule } from 'expo-modules-core'

export type ProbeResult = {
  width: number
  height: number
  rotation: number
  durationUs: number
  videoPtsUs: number[]
  hasAudio: boolean
}

type SensesRenderModule = {
  probe(rawPath: string): Promise<ProbeResult>
  begin(outPath: string, width: number, height: number, fps: number, bitrate: number, audioSourcePath: string | null): Promise<void>
  pushFrame(rgba: Uint8Array, ptsUs: number): Promise<void>
  finish(): Promise<void>
  abort(): Promise<void>
  noopFrame(rgba: Uint8Array): Promise<void>
  exportToGallery(path: string, displayName: string, replaceUri: string | null): Promise<string>
  setKeepScreenOn(on: boolean): void
}

export default requireNativeModule<SensesRenderModule>('SensesRender')
