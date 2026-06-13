package expo.modules.sensesrecorder

import android.content.ContentValues
import android.content.Context
import android.hardware.display.DisplayManager
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.media.projection.MediaProjection
import android.net.Uri
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.util.DisplayMetrics
import android.view.WindowManager
import java.io.File

class RecordingEngine(
  private val context: Context,
  private val projection: MediaProjection,
  private val withMic: Boolean,
) {
  private lateinit var videoCodec: MediaCodec
  private lateinit var muxer: MediaMuxer
  private var virtualDisplay: android.hardware.display.VirtualDisplay? = null
  private var videoTrack = -1
  private var audioTrack = -1
  private var muxerStarted = false
  private var audioEnabled = false
  private val muxerLock = Object()
  @Volatile private var running = false
  private var drainThread: Thread? = null
  private var audioCodec: MediaCodec? = null
  private var audioThread: AudioCaptureThread? = null
  private lateinit var outFile: File

  private val projectionCallback = object : MediaProjection.Callback() {
    override fun onStop() { running = false }
  }

  fun start() {
    val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val metrics = DisplayMetrics()
    @Suppress("DEPRECATION")
    wm.defaultDisplay.getRealMetrics(metrics)
    val width = (metrics.widthPixels / 2 / 16) * 16
    val height = (metrics.heightPixels / 2 / 16) * 16

    val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
      setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
      setInteger(MediaFormat.KEY_BIT_RATE, 12_000_000)
      setInteger(MediaFormat.KEY_FRAME_RATE, 30)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
    }
    videoCodec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
    videoCodec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    val inputSurface = videoCodec.createInputSurface()
    videoCodec.start()

    audioEnabled = true
    val audioFormat = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, SAMPLE_RATE, CHANNELS).apply {
      setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
      setInteger(MediaFormat.KEY_BIT_RATE, 128_000)
    }
    audioCodec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC).apply {
      configure(audioFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
      start()
    }

    outFile = File(context.cacheDir, "senses-${System.currentTimeMillis()}.mp4")
    muxer = MediaMuxer(outFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)

    projection.registerCallback(projectionCallback, Handler(Looper.getMainLooper()))
    virtualDisplay = projection.createVirtualDisplay(
      "senses-capture", width, height, metrics.densityDpi,
      DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, inputSurface, null, null,
    )

    running = true
    drainThread = Thread { drainLoop() }.also { it.start() }

    audioThread = AudioCaptureThread(
      projection,
      withMic = withMic,
      encoder = audioCodec!!,
      onEncodedFrame = { buf, info ->
        synchronized(muxerLock) {
          if (muxerStarted) muxer.writeSampleData(audioTrack, buf, info)
        }
      },
      onFormatReady = { fmt ->
        synchronized(muxerLock) {
          audioTrack = muxer.addTrack(fmt)
          maybeStartMuxer()
        }
      },
    ).also { it.start() }
  }

  private fun drainLoop() {
    val info = MediaCodec.BufferInfo()
    while (true) {
      val index = videoCodec.dequeueOutputBuffer(info, 10_000)
      when {
        index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
          synchronized(muxerLock) {
            videoTrack = muxer.addTrack(videoCodec.outputFormat)
            maybeStartMuxer()
          }
        }
        index >= 0 -> {
          val buf = videoCodec.getOutputBuffer(index) ?: continue
          if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) info.size = 0
          if (info.size > 0) {
            synchronized(muxerLock) {
              if (muxerStarted) {
                buf.position(info.offset)
                buf.limit(info.offset + info.size)
                muxer.writeSampleData(videoTrack, buf, info)
              }
            }
          }
          videoCodec.releaseOutputBuffer(index, false)
          if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) return
        }
        index == MediaCodec.INFO_TRY_AGAIN_LATER && !running -> {
          videoCodec.signalEndOfInputStream()
        }
      }
    }
  }

  private fun maybeStartMuxer() {
    val audioReady = !audioEnabled || audioTrack >= 0
    if (videoTrack >= 0 && audioReady && !muxerStarted) {
      muxer.start()
      muxerStarted = true
    }
  }

  fun stopAndSave(): String? {
    audioThread?.let { t ->
      t.running = false
      t.join(3_000)
    }
    audioCodec?.let { try { it.stop() } catch (_: Exception) {}; it.release() }
    audioThread = null
    audioCodec = null

    running = false
    drainThread?.join(3_000)
    try { videoCodec.stop() } catch (_: Exception) {}
    videoCodec.release()
    virtualDisplay?.release()
    projection.unregisterCallback(projectionCallback)
    projection.stop()
    if (muxerStarted) {
      try { muxer.stop() } catch (_: Exception) {}
    }
    muxer.release()
    if (!muxerStarted || outFile.length() == 0L) {
      outFile.delete()
      return null
    }
    return insertIntoMediaStore()
  }

  private fun insertIntoMediaStore(): String? {
    val values = ContentValues().apply {
      put(MediaStore.Video.Media.DISPLAY_NAME, outFile.name)
      put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
      put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/Senses")
      put(MediaStore.Video.Media.IS_PENDING, 1)
    }
    val resolver = context.contentResolver
    val uri: Uri = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values) ?: return null
    resolver.openOutputStream(uri)?.use { out -> outFile.inputStream().use { it.copyTo(out) } }
    values.clear()
    values.put(MediaStore.Video.Media.IS_PENDING, 0)
    resolver.update(uri, values, null, null)
    outFile.delete()
    return uri.toString()
  }
}
