package expo.modules.sensesrender

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.File
import java.nio.ByteBuffer

// Offline H.264 encode session: RGBA frames in (with explicit PTS), MP4 out,
// audio track copied sample-for-sample from audioSourcePath (no re-encode).
// MediaMuxer needs every track added before start(), so the audio format is
// read up front and both tracks are added when the encoder's output format
// arrives.
class EncodeSession(
  private val outPath: String,
  private val width: Int,
  private val height: Int,
  fps: Int,
  bitrate: Int,
  private val audioSourcePath: String?,
) {
  private val encoder: MediaCodec
  private val muxer: MediaMuxer
  private var videoTrack = -1
  private var audioTrack = -1
  private var audioFormat: MediaFormat? = null
  private var muxerStarted = false
  private val info = MediaCodec.BufferInfo()
  private val yuv = ByteArray(width * height * 3 / 2)

  init {
    require(width > 0 && height > 0 && width % 2 == 0 && height % 2 == 0) {
      "dimensions must be positive and even: ${width}x${height}"
    }
    if (audioSourcePath != null) {
      val ex = MediaExtractor()
      try {
        ex.setDataSource(audioSourcePath)
        for (i in 0 until ex.trackCount) {
          val f = ex.getTrackFormat(i)
          if (f.getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) { audioFormat = f; break }
        }
      } finally { ex.release() }
    }
    val fmt = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
      setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible)
      setInteger(MediaFormat.KEY_BIT_RATE, bitrate)
      setInteger(MediaFormat.KEY_FRAME_RATE, fps)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
    }
    encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
    encoder.configure(fmt, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    encoder.start()
    muxer = try {
      MediaMuxer(outPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    } catch (e: Exception) {
      runCatching { encoder.stop() }
      runCatching { encoder.release() }
      throw e
    }
  }

  fun pushFrame(rgba: ByteArray, ptsUs: Long) {
    require(rgba.size >= width * height * 4) { "frame byte size ${rgba.size} < ${width * height * 4}" }
    val idx = encoder.dequeueInputBuffer(1_000_000)
    if (idx < 0) throw IllegalStateException("encoder input timeout")
    rgbaToI420(rgba)
    val image = encoder.getInputImage(idx) ?: throw IllegalStateException("no input image")
    writeI420ToImage(image)
    encoder.queueInputBuffer(idx, 0, width * height * 3 / 2, ptsUs, 0)
    drain(endOfStream = false)
  }

  fun finish() {
    val idx = encoder.dequeueInputBuffer(1_000_000)
    if (idx < 0) throw IllegalStateException("encoder EOS input timeout")
    encoder.queueInputBuffer(idx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
    drain(endOfStream = true)
    copyAudio()
    release(deleteFile = false)
  }

  fun abort() {
    release(deleteFile = true)
  }

  private fun drain(endOfStream: Boolean) {
    var eosTryAgainCount = 0
    while (true) {
      val out = encoder.dequeueOutputBuffer(info, if (endOfStream) 10_000L else 0L)
      when {
        out == MediaCodec.INFO_TRY_AGAIN_LATER -> {
          if (!endOfStream) return
          eosTryAgainCount++
          if (eosTryAgainCount > 500) throw IllegalStateException("encoder EOS drain timeout")
          continue
        }
        out == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
          eosTryAgainCount = 0
          videoTrack = muxer.addTrack(encoder.outputFormat)
          audioFormat?.let { audioTrack = muxer.addTrack(it) }
          muxer.start()
          muxerStarted = true
        }
        out >= 0 -> {
          eosTryAgainCount = 0
          val buf = encoder.getOutputBuffer(out) ?: continue
          if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) info.size = 0
          if (info.size > 0 && muxerStarted) muxer.writeSampleData(videoTrack, buf, info)
          encoder.releaseOutputBuffer(out, false)
          if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) return
        }
      }
    }
  }

  private fun copyAudio() {
    val src = audioSourcePath ?: return
    if (audioTrack < 0 || !muxerStarted) return
    val ex = MediaExtractor()
    try {
      ex.setDataSource(src)
      var at = -1
      for (i in 0 until ex.trackCount) {
        if (ex.getTrackFormat(i).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) { at = i; break }
      }
      if (at < 0) return
      ex.selectTrack(at)
      val buf = ByteBuffer.allocate(1 shl 20)
      val ai = MediaCodec.BufferInfo()
      while (true) {
        ai.size = ex.readSampleData(buf, 0)
        if (ai.size < 0) break
        ai.presentationTimeUs = ex.sampleTime
        ai.offset = 0
        ai.flags = if (ex.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC != 0) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0
        muxer.writeSampleData(audioTrack, buf, ai)
        ex.advance()
      }
    } finally { ex.release() }
  }

  private fun release(deleteFile: Boolean) {
    runCatching { encoder.stop() }
    runCatching { encoder.release() }
    runCatching { if (muxerStarted) muxer.stop() }
    runCatching { muxer.release() }
    if (deleteFile) runCatching { File(outPath).delete() }
  }

  // BT.601 video-range RGBA→I420, chroma from top-left of each 2x2 block.
  private fun rgbaToI420(rgba: ByteArray) {
    val uBase = width * height
    val vBase = uBase + uBase / 4
    var yi = 0
    var ci = 0
    for (row in 0 until height) {
      for (col in 0 until width) {
        val p = (row * width + col) * 4
        val r = rgba[p].toInt() and 0xFF
        val g = rgba[p + 1].toInt() and 0xFF
        val b = rgba[p + 2].toInt() and 0xFF
        yuv[yi++] = (((66 * r + 129 * g + 25 * b + 128) shr 8) + 16).coerceIn(16, 235).toByte()
        if (row % 2 == 0 && col % 2 == 0) {
          yuv[uBase + ci] = ((((-38 * r - 74 * g + 112 * b) + 128) shr 8) + 128).coerceIn(16, 240).toByte()
          yuv[vBase + ci] = ((((112 * r - 94 * g - 18 * b) + 128) shr 8) + 128).coerceIn(16, 240).toByte()
          ci++
        }
      }
    }
  }

  // Copy I420 planes into the codec's flexible Image respecting row/pixel strides.
  private fun writeI420ToImage(image: android.media.Image) {
    val uBase = width * height
    val vBase = uBase + uBase / 4
    val planes = image.planes
    // Y
    run {
      val dst = planes[0].buffer
      val rs = planes[0].rowStride
      for (row in 0 until height) {
        dst.position(row * rs)
        dst.put(yuv, row * width, width)
      }
    }
    // U, V (source planar; dest may be planar or semi-planar — honor strides)
    for (pi in 1..2) {
      val src = if (pi == 1) uBase else vBase
      val dst = planes[pi].buffer
      val rs = planes[pi].rowStride
      val ps = planes[pi].pixelStride
      val cw = width / 2
      val ch = height / 2
      for (row in 0 until ch) {
        for (col in 0 until cw) {
          dst.position(row * rs + col * ps)
          dst.put(yuv[src + row * cw + col])
        }
      }
    }
  }
}
