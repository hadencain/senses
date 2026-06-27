#include "AudioEngine.h"
#include <android/log.h>
#include <cmath>
#include <cstring>

#define LOG_TAG "SensesAudio"
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

void AudioEngine::start() {
    // Input stream — mono mic capture
    oboe::AudioStreamBuilder inputBuilder;
    inputBuilder.setDirection(oboe::Direction::Input);
    inputBuilder.setPerformanceMode(oboe::PerformanceMode::LowLatency);
    inputBuilder.setSharingMode(oboe::SharingMode::Exclusive);
    inputBuilder.setFormat(oboe::AudioFormat::Float);
    inputBuilder.setChannelCount(oboe::ChannelCount::Mono);
    inputBuilder.setCallback(&_inputCb);

    oboe::Result r = inputBuilder.openStream(_inputStream);
    if (r != oboe::Result::OK) {
        LOGE("Failed to open input stream: %s", oboe::convertToText(r));
        return;
    }
    _sampleRate = _inputStream->getSampleRate();
    _buf.init(_sampleRate * 8); // 8-second circular buffer

    // Output stream — stereo playback
    oboe::AudioStreamBuilder outputBuilder;
    outputBuilder.setDirection(oboe::Direction::Output);
    outputBuilder.setPerformanceMode(oboe::PerformanceMode::LowLatency);
    outputBuilder.setSharingMode(oboe::SharingMode::Exclusive);
    outputBuilder.setFormat(oboe::AudioFormat::Float);
    outputBuilder.setChannelCount(oboe::ChannelCount::Stereo);
    outputBuilder.setSampleRate(_sampleRate);
    outputBuilder.setCallback(&_outputCb);

    r = outputBuilder.openStream(_outputStream);
    if (r != oboe::Result::OK) {
        LOGE("Failed to open output stream: %s", oboe::convertToText(r));
        _inputStream->close();
        _inputStream.reset();
        return;
    }

    _inputStream->requestStart();
    _outputStream->requestStart();
}

void AudioEngine::stop() {
    if (_inputStream) {
        _inputStream->requestStop();
        _inputStream->close();
        _inputStream.reset();
    }
    if (_outputStream) {
        _outputStream->requestStop();
        _outputStream->close();
        _outputStream.reset();
    }
    for (auto& v : _voices) v.active = false;
    _loopActive.store(false, std::memory_order_relaxed);
    _pendingW.store(0, std::memory_order_relaxed);
    _pendingR.store(0, std::memory_order_relaxed);
}

void AudioEngine::triggerGrain(float position, float durationSec, float pitchRatio, float amplitude) {
    GrainSpec spec{position, durationSec, pitchRatio, amplitude};
    enqueueGrain(spec);
}

void AudioEngine::setPlayback(bool active, float loopStart, float loopEnd, float rate) {
    _loopStart.store(loopStart, std::memory_order_relaxed);
    _loopEnd.store(loopEnd, std::memory_order_relaxed);
    _loopRate.store(rate, std::memory_order_relaxed);
    _loopActive.store(active, std::memory_order_release);
}

void AudioEngine::setMasterGain(float gain) {
    _masterGain.store(gain, std::memory_order_relaxed);
}

float AudioEngine::getBufferFill() {
    return _buf.fill();
}

// --- SPSC queue ---

void AudioEngine::enqueueGrain(const GrainSpec& spec) {
    int w = _pendingW.load(std::memory_order_relaxed);
    int next = (w + 1) % PENDING_MAX;
    if (next == _pendingR.load(std::memory_order_acquire)) return; // queue full — drop
    _pendingBuf[w] = spec;
    _pendingW.store(next, std::memory_order_release);
}

bool AudioEngine::dequeueGrain(GrainSpec& out) {
    int r = _pendingR.load(std::memory_order_relaxed);
    if (r == _pendingW.load(std::memory_order_acquire)) return false;
    out = _pendingBuf[r];
    _pendingR.store((r + 1) % PENDING_MAX, std::memory_order_release);
    return true;
}

void AudioEngine::activateGrain(const GrainSpec& spec) {
    // Find an inactive voice slot
    for (auto& v : _voices) {
        if (!v.active) {
            int cap = _buf.capacity();
            v.readPos     = spec.position * (float)cap;
            v.rate        = spec.pitchRatio;
            v.amplitude   = spec.amplitude;
            v.samplesTotal = (int)(spec.durationSec * (float)_sampleRate);
            if (v.samplesTotal < 1) v.samplesTotal = 1;
            v.samplesLeft  = v.samplesTotal;
            v.active       = true;
            return;
        }
    }
    // All voices busy — steal the oldest (smallest samplesLeft)
    GrainVoice* oldest = &_voices[0];
    for (auto& v : _voices) {
        if (v.samplesLeft < oldest->samplesLeft) oldest = &v;
    }
    int cap = _buf.capacity();
    oldest->readPos     = spec.position * (float)cap;
    oldest->rate        = spec.pitchRatio;
    oldest->amplitude   = spec.amplitude;
    oldest->samplesTotal = (int)(spec.durationSec * (float)_sampleRate);
    if (oldest->samplesTotal < 1) oldest->samplesTotal = 1;
    oldest->samplesLeft  = oldest->samplesTotal;
    oldest->active       = true;
}

// --- Oboe callbacks ---

void AudioEngine::onInputReady(const float* data, int32_t frames) {
    _buf.write(data, frames);
}

void AudioEngine::onOutputReady(float* data, int32_t frames) {
    // Drain pending grain queue
    GrainSpec spec;
    while (dequeueGrain(spec)) {
        activateGrain(spec);
    }

    const float gain = _masterGain.load(std::memory_order_relaxed);
    const int cap = _buf.capacity();

    // Loop playback state
    const bool  loopOn    = _loopActive.load(std::memory_order_acquire);
    const float loopStart = _loopStart.load(std::memory_order_relaxed) * (float)cap;
    const float loopEnd   = _loopEnd.load(std::memory_order_relaxed) * (float)cap;
    const float loopRate  = _loopRate.load(std::memory_order_relaxed);
    const float loopRange = loopEnd - loopStart;

    for (int i = 0; i < frames; ++i) {
        float mix = 0.0f;

        // Grain voices
        for (auto& v : _voices) {
            if (!v.active) continue;
            float phase = 1.0f - (float)v.samplesLeft / (float)v.samplesTotal;
            float env   = sinf(PI_F * phase);
            env *= env; // sin²: smooth attack and release
            mix += _buf.readAt(v.readPos) * env * v.amplitude;
            v.readPos = fmodf(v.readPos + v.rate, (float)cap);
            if (--v.samplesLeft <= 0) v.active = false;
        }

        // Continuous loop
        if (loopOn && loopRange > 1.0f) {
            mix += _buf.readAt(_loopPos);
            _loopPos += loopRate;
            if (_loopPos >= loopEnd) {
                _loopPos = loopStart + fmodf(_loopPos - loopStart, loopRange);
            }
        }

        float out = mix * gain;
        data[i * 2]     = out; // L
        data[i * 2 + 1] = out; // R
    }
}
