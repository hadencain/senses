package expo.modules.sensesrecorder

import android.annotation.SuppressLint
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.MediaCodec
import android.media.MediaFormat
import android.media.MediaRecorder
import android.media.projection.MediaProjection

const val SAMPLE_RATE = 44100
const val CHANNELS = 2

class AudioCaptureThread(
  projection: MediaProjection,
  private val withMic: Boolean,
  private val encoder: MediaCodec,
  private val onEncodedFrame: (java.nio.ByteBuffer, MediaCodec.BufferInfo) -> Unit,
  private val onFormatReady: (MediaFormat) -> Unit,
) : Thread("senses-audio") {

  @Volatile var running = true

  private val bufFormat = AudioFormat.Builder()
    .setSampleRate(SAMPLE_RATE)
    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
    .setChannelMask(AudioFormat.CHANNEL_IN_STEREO)
    .build()

  private val minBuf = AudioRecord.getMinBufferSize(
    SAMPLE_RATE, AudioFormat.CHANNEL_IN_STEREO, AudioFormat.ENCODING_PCM_16BIT,
  )

  @SuppressLint("MissingPermission")
  private val playbackRecord: AudioRecord = AudioRecord.Builder()
    .setAudioFormat(bufFormat)
    .setBufferSizeInBytes(minBuf * 2)
    .setAudioPlaybackCaptureConfig(
      AudioPlaybackCaptureConfiguration.Builder(projection)
        .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
        .addMatchingUsage(AudioAttributes.USAGE_GAME)
        .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
        .build(),
    )
    .build()

  @SuppressLint("MissingPermission")
  private val micRecord: AudioRecord? = if (withMic) {
    AudioRecord.Builder()
      .setAudioSource(MediaRecorder.AudioSource.MIC)
      .setAudioFormat(bufFormat)
      .setBufferSizeInBytes(minBuf * 2)
      .build()
  } else null

  override fun run() {
    val samplesPerChunk = 1024 * CHANNELS
    val playbackBuf = ShortArray(samplesPerChunk)
    val micBuf = ShortArray(samplesPerChunk)
    var totalFrames = 0L

    playbackRecord.startRecording()
    micRecord?.startRecording()

    val outInfo = MediaCodec.BufferInfo()
    while (running) {
      val n = playbackRecord.read(playbackBuf, 0, samplesPerChunk, AudioRecord.READ_BLOCKING)
      if (n <= 0) continue
      if (micRecord != null) {
        val m = micRecord.read(micBuf, 0, n, AudioRecord.READ_BLOCKING)
        for (i in 0 until n) {
          val mixed = playbackBuf[i] + (if (i < m) micBuf[i].toInt() else 0)
          playbackBuf[i] = mixed.coerceIn(-32768, 32767).toShort()
        }
      }

      val inIndex = encoder.dequeueInputBuffer(10_000)
      if (inIndex >= 0) {
        val inBuf = encoder.getInputBuffer(inIndex)!!
        inBuf.clear()
        for (i in 0 until n) inBuf.putShort(playbackBuf[i])
        val ptsUs = totalFrames * 1_000_000L / SAMPLE_RATE
        encoder.queueInputBuffer(inIndex, 0, n * 2, ptsUs, 0)
        totalFrames += n / CHANNELS
      }

      drainEncoder(outInfo, endOfStream = false)
    }

    val inIndex = encoder.dequeueInputBuffer(10_000)
    if (inIndex >= 0) {
      val ptsUs = totalFrames * 1_000_000L / SAMPLE_RATE
      encoder.queueInputBuffer(inIndex, 0, 0, ptsUs, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
    }
    drainEncoder(outInfo, endOfStream = true)

    playbackRecord.stop(); playbackRecord.release()
    micRecord?.stop(); micRecord?.release()
  }

  private fun drainEncoder(info: MediaCodec.BufferInfo, endOfStream: Boolean) {
    while (true) {
      val index = encoder.dequeueOutputBuffer(info, if (endOfStream) 10_000 else 0)
      when {
        index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> onFormatReady(encoder.outputFormat)
        index >= 0 -> {
          val buf = encoder.getOutputBuffer(index) ?: continue
          if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) info.size = 0
          if (info.size > 0) onEncodedFrame(buf, info)
          encoder.releaseOutputBuffer(index, false)
          if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) return
        }
        else -> if (!endOfStream) return else if (index == MediaCodec.INFO_TRY_AGAIN_LATER) return
      }
    }
  }
}
