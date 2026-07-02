package expo.modules.sensesrender

import android.media.MediaExtractor
import android.media.MediaFormat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SensesRenderModule : Module() {
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
  }
}
