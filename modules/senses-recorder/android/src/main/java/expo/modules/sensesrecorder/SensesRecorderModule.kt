package expo.modules.sensesrecorder

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val CAPTURE_REQUEST_CODE = 4910

class SensesRecorderModule : Module() {
  private var pendingPromise: Promise? = null
  private var captureResultCode = 0
  private var captureData: Intent? = null

  override fun definition() = ModuleDefinition {
    Name("SensesRecorder")

    AsyncFunction("requestCapture") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      val mpm = activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      pendingPromise = promise
      activity.startActivityForResult(mpm.createScreenCaptureIntent(), CAPTURE_REQUEST_CODE)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode == CAPTURE_REQUEST_CODE) {
        if (payload.resultCode == Activity.RESULT_OK && payload.data != null) {
          captureResultCode = payload.resultCode
          captureData = payload.data
          pendingPromise?.resolve(true)
        } else {
          pendingPromise?.resolve(false)
        }
        pendingPromise = null
      }
    }

    AsyncFunction("start") { options: Map<String, Any?>, promise: Promise ->
      val context = appContext.reactContext
      val data = captureData
      if (context == null || data == null) {
        promise.reject("E_NO_CAPTURE", "requestCapture must succeed before start", null)
        return@AsyncFunction
      }
      val intent = Intent(context, ScreenRecordService::class.java).apply {
        action = ScreenRecordService.ACTION_START
        putExtra(ScreenRecordService.EXTRA_RESULT_CODE, captureResultCode)
        putExtra(ScreenRecordService.EXTRA_RESULT_DATA, data)
        putExtra(ScreenRecordService.EXTRA_WITH_MIC, (options["withMic"] as? Boolean) ?: false)
      }
      context.startForegroundService(intent)
      // Consent intents are single-use on Android 14 — force a fresh requestCapture next time.
      captureData = null
      promise.resolve(null)
    }

    AsyncFunction("stop") { promise: Promise ->
      ScreenRecordService.stopAndFinalize { uri -> promise.resolve(uri) }
    }
  }
}
