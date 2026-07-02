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
}

export default requireNativeModule<SensesRenderModule>('SensesRender')
