package expo.modules.sensesrender

import android.media.MediaExtractor
import android.media.MediaFormat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.typedarray.Uint8Array

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
  }
}
