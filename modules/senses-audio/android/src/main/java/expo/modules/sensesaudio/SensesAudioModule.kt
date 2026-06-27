package expo.modules.sensesaudio

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SensesAudioModule : Module() {

    companion object {
        init {
            System.loadLibrary("senses-audio")
        }
    }

    private external fun nativeStart()
    private external fun nativeStop()
    private external fun nativeTriggerGrain(
        position: Float, durationSec: Float, pitchRatio: Float, amplitude: Float)
    private external fun nativeSetPlayback(
        active: Boolean, loopStart: Float, loopEnd: Float, rate: Float)
    private external fun nativeSetMasterGain(gain: Float)
    private external fun nativeGetBufferFill(): Float

    override fun definition() = ModuleDefinition {
        Name("SensesAudio")

        AsyncFunction("startCapture") { ->
            val ctx = appContext.reactContext
                ?: throw Exception("No React context")
            if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
                throw Exception("RECORD_AUDIO permission not granted")
            }
            nativeStart()
        }

        Function("stopCapture") {
            nativeStop()
        }

        // opts: { position, durationSec, pitchRatio?, amplitude? }
        Function("triggerGrain") { opts: Map<String, Any?> ->
            nativeTriggerGrain(
                (opts["position"] as? Double ?: 0.0).toFloat(),
                (opts["durationSec"] as? Double ?: 0.06).toFloat(),
                (opts["pitchRatio"] as? Double ?: 1.0).toFloat(),
                (opts["amplitude"] as? Double ?: 0.5).toFloat(),
            )
        }

        // opts: { active, loopStart?, loopEnd?, rate? }
        Function("setPlayback") { opts: Map<String, Any?> ->
            nativeSetPlayback(
                opts["active"] as? Boolean ?: false,
                (opts["loopStart"] as? Double ?: 0.0).toFloat(),
                (opts["loopEnd"] as? Double ?: 1.0).toFloat(),
                (opts["rate"] as? Double ?: 1.0).toFloat(),
            )
        }

        Function("setMasterGain") { gain: Double ->
            nativeSetMasterGain(gain.toFloat())
        }

        Function("getBufferFill") {
            nativeGetBufferFill().toDouble()
        }
    }
}
