package expo.modules.sensesrecorder

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.projection.MediaProjectionManager
import android.os.Handler
import android.os.IBinder
import android.os.Looper

class ScreenRecordService : Service() {
  companion object {
    const val ACTION_START = "expo.modules.sensesrecorder.START"
    const val EXTRA_RESULT_CODE = "resultCode"
    const val EXTRA_RESULT_DATA = "resultData"
    const val EXTRA_WITH_MIC = "withMic"
    private const val CHANNEL_ID = "senses_recording"
    private const val NOTIF_ID = 491

    private var instance: ScreenRecordService? = null

    fun stopAndFinalize(onDone: (String?) -> Unit) {
      val svc = instance
      if (svc == null) {
        onDone(null)
        return
      }
      svc.stopRecording(onDone)
    }
  }

  private var engine: RecordingEngine? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_START) {
      instance = this
      startForeground(NOTIF_ID, buildNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
      val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
      @Suppress("DEPRECATION")
      val data = intent.getParcelableExtra<Intent>(EXTRA_RESULT_DATA)
      val withMic = intent.getBooleanExtra(EXTRA_WITH_MIC, false)
      if (data != null) {
        val mpm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val projection = mpm.getMediaProjection(resultCode, data)
        engine = RecordingEngine(this, projection, withMic).also { it.start() }
      }
    }
    return START_NOT_STICKY
  }

  private fun stopRecording(onDone: (String?) -> Unit) {
    Thread {
      val uri = try {
        engine?.stopAndSave()
      } catch (e: Exception) {
        null
      }
      engine = null
      instance = null
      Handler(Looper.getMainLooper()).post {
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        onDone(uri)
      }
    }.start()
  }

  private fun buildNotification(): Notification {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    nm.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Recording", NotificationManager.IMPORTANCE_LOW)
    )
    return Notification.Builder(this, CHANNEL_ID)
      .setContentTitle("Senses is recording")
      .setSmallIcon(android.R.drawable.presence_video_online)
      .setOngoing(true)
      .build()
  }

  override fun onDestroy() {
    engine?.let { try { it.stopAndSave() } catch (_: Exception) {} }
    engine = null
    instance = null
    super.onDestroy()
  }
}
