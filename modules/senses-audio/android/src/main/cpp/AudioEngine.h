#pragma once
#include "CircularBuffer.h"
#include <oboe/Oboe.h>
#include <array>
#include <atomic>
#include <memory>

static constexpr int MAX_VOICES   = 32;
static constexpr int PENDING_MAX  = 64;
static constexpr float PI_F       = 3.14159265f;

struct GrainSpec {
    float position;    // 0..1 in circular buffer
    float durationSec;
    float pitchRatio;
    float amplitude;
};

struct GrainVoice {
    bool  active{false};
    float readPos;      // absolute sample position in buffer
    float rate;         // buffer advance per output sample (= pitchRatio)
    float amplitude;
    int   samplesTotal;
    int   samplesLeft;
};

class AudioEngine {
public:
    void  start();
    void  stop();
    void  triggerGrain(float position, float durationSec, float pitchRatio, float amplitude);
    void  setPlayback(bool active, float loopStart, float loopEnd, float rate);
    void  setMasterGain(float gain);
    float getBufferFill();

    // Called from Oboe callbacks — do not call directly
    void onInputReady(const float* data, int32_t frames);
    void onOutputReady(float* data, int32_t frames);

private:
    class InputCb : public oboe::AudioStreamCallback {
    public:
        explicit InputCb(AudioEngine& e) : eng(e) {}
        oboe::DataCallbackResult onAudioReady(
            oboe::AudioStream*, void* data, int32_t frames) override {
            eng.onInputReady(static_cast<const float*>(data), frames);
            return oboe::DataCallbackResult::Continue;
        }
        AudioEngine& eng;
    };

    class OutputCb : public oboe::AudioStreamCallback {
    public:
        explicit OutputCb(AudioEngine& e) : eng(e) {}
        oboe::DataCallbackResult onAudioReady(
            oboe::AudioStream*, void* data, int32_t frames) override {
            eng.onOutputReady(static_cast<float*>(data), frames);
            return oboe::DataCallbackResult::Continue;
        }
        AudioEngine& eng;
    };

    InputCb  _inputCb{*this};
    OutputCb _outputCb{*this};

    std::shared_ptr<oboe::AudioStream> _inputStream;
    std::shared_ptr<oboe::AudioStream> _outputStream;

    CircularBuffer _buf;
    int _sampleRate{48000};

    // Active grain voices — accessed only from output callback
    std::array<GrainVoice, MAX_VOICES> _voices{};

    // Lock-free SPSC queue: JS thread → output callback
    std::array<GrainSpec, PENDING_MAX> _pendingBuf;
    std::atomic<int> _pendingW{0};
    std::atomic<int> _pendingR{0};

    // Loop playback — atomics allow JS-thread writes, output-callback reads
    std::atomic<bool>  _loopActive{false};
    std::atomic<float> _loopStart{0.0f};
    std::atomic<float> _loopEnd{1.0f};
    std::atomic<float> _loopRate{1.0f};
    float _loopPos{0.0f};   // only touched from output callback

    std::atomic<float> _masterGain{0.8f};

    void enqueueGrain(const GrainSpec& spec);
    bool dequeueGrain(GrainSpec& out);
    void activateGrain(const GrainSpec& spec);
};
