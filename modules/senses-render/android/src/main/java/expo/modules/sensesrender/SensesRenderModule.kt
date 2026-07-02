package expo.modules.sensesrender

import android.content.ContentValues
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import android.view.WindowManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.typedarray.Uint8Array
import java.io.File

class SensesRenderModule : Module() {
  private var session: EncodeSession? = null
  private var frameBuf: ByteArray? = null

  override fun definition() = ModuleDefinition {
    Name("SensesRender")

    AsyncFunction("probe") { rawPath: String ->
      val ex = MediaExtractor()
      try {
        ex.setDataSource(rawPath)
        var vTrack = -1
        var fmt: MediaFormat? = null
        var hasAudio = false
        for (i in 0 until ex.trackCount) {
          val f = ex.getTrackFormat(i)
          val mime = f.getString(MediaFormat.KEY_MIME) ?: continue
          if (mime.startsWith("video/") && vTrack < 0) { vTrack = i; fmt = f }
          if (mime.startsWith("audio/")) hasAudio = true
        }
        val vf = fmt ?: throw IllegalStateException("no video track in $rawPath")
        ex.selectTrack(vTrack)
        val pts = ArrayList<Double>()
        while (true) {
          val t = ex.sampleTime
          if (t < 0) break
          pts.add(t.toDouble())
          ex.advance()
        }
        // decode order can differ from presentation order; camera H.264 is
        // normally I/P-only but sorting is cheap insurance
        pts.sort()
        mapOf(
          "width" to vf.getInteger(MediaFormat.KEY_WIDTH),
          "height" to vf.getInteger(MediaFormat.KEY_HEIGHT),
          "rotation" to (if (vf.containsKey(MediaFormat.KEY_ROTATION)) vf.getInteger(MediaFormat.KEY_ROTATION) else 0),
          "durationUs" to (if (vf.containsKey(MediaFormat.KEY_DURATION)) vf.getLong(MediaFormat.KEY_DURATION).toDouble() else 0.0),
          "videoPtsUs" to pts,
          "hasAudio" to hasAudio,
        )
      } finally {
        ex.release()
      }
    }

    AsyncFunction("begin") { outPath: String, width: Int, height: Int, fps: Int, bitrate: Int, audioSourcePath: String? ->
      if (session != null) throw IllegalStateException("render session already active")
      session = EncodeSession(outPath, width, height, fps, bitrate, audioSourcePath)
      frameBuf = ByteArray(width * height * 4)
      Unit
    }

    AsyncFunction("pushFrame") { rgba: Uint8Array, ptsUs: Double ->
      val s = session ?: throw IllegalStateException("no active render session")
      val buf = frameBuf ?: throw IllegalStateException("no frame buffer")
      rgba.read(buf, 0, minOf(rgba.length, buf.size))
      s.pushFrame(buf, ptsUs.toLong())
    }

    AsyncFunction("finish") {
      val s = session ?: throw IllegalStateException("no active render session")
      try { s.finish() } finally { session = null; frameBuf = null }
    }

    AsyncFunction("abort") {
      session?.abort()
      session = null
      frameBuf = null
      Unit
    }

    // Spike-only: measures JS→native Uint8Array transfer cost, does nothing.
    AsyncFunction("noopFrame") { rgba: Uint8Array ->
      rgba.length
    }

    AsyncFunction("exportToGallery") { path: String, displayName: String, replaceUri: String? ->
      val ctx = appContext.reactContext ?: throw IllegalStateException("no react context")
      val resolver = ctx.contentResolver
      if (replaceUri != null) runCatching { resolver.delete(Uri.parse(replaceUri), null, null) }
      val values = ContentValues().apply {
        put(MediaStore.Video.Media.DISPLAY_NAME, displayName)
        put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
        put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/Senses")
        put(MediaStore.Video.Media.IS_PENDING, 1)
      }
      val uri = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
        ?: throw IllegalStateException("MediaStore insert failed")
      try {
        resolver.openOutputStream(uri).use { out ->
          requireNotNull(out) { "cannot open $uri" }
          File(path).inputStream().use { it.copyTo(out) }
        }
        values.clear()
        values.put(MediaStore.Video.Media.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
      } catch (e: Exception) {
        runCatching { resolver.delete(uri, null, null) }
        throw e
      }
      uri.toString()
    }

    Function("setKeepScreenOn") { on: Boolean ->
      val activity = appContext.currentActivity ?: return@Function
      activity.runOnUiThread {
        if (on) activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      }
    }
  }
}
