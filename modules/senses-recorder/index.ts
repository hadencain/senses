import { requireNativeModule } from 'expo-modules-core'

type StartOptions = { withMic?: boolean }

type SensesRecorderModule = {
  requestCapture(): Promise<boolean>
  start(options: StartOptions): Promise<void>
  stop(): Promise<string | null>
}

export default requireNativeModule<SensesRecorderModule>('SensesRecorder')
