#pragma once
#include <vector>
#include <atomic>
#include <cmath>

class CircularBuffer {
public:
    void init(int capacity) {
        _capacity = capacity;
        _buf.assign(capacity, 0.0f);
        _writeHead.store(0, std::memory_order_relaxed);
        _wrapped = false;
    }

    void write(const float* src, int frames) {
        int head = _writeHead.load(std::memory_order_relaxed);
        for (int i = 0; i < frames; ++i) {
            _buf[head] = src[i];
            if (++head >= _capacity) {
                head = 0;
                _wrapped = true;
            }
        }
        _writeHead.store(head, std::memory_order_release);
    }

    // Linear-interpolated read at absolute float position [0, capacity)
    float readAt(float pos) const {
        pos = fmodf(pos, (float)_capacity);
        if (pos < 0.0f) pos += (float)_capacity;
        int i0 = (int)pos;
        int i1 = (i0 + 1) % _capacity;
        float frac = pos - (float)i0;
        return _buf[i0] + frac * (_buf[i1] - _buf[i0]);
    }

    float fill() const {
        if (_wrapped) return 1.0f;
        return (float)_writeHead.load(std::memory_order_acquire) / (float)_capacity;
    }

    int capacity() const { return _capacity; }

    // Current write position as 0..1 fraction (newest audio is just before this)
    float headFraction() const {
        return (float)_writeHead.load(std::memory_order_acquire) / (float)_capacity;
    }

private:
    std::vector<float> _buf;
    std::atomic<int> _writeHead{0};
    int _capacity{0};
    bool _wrapped{false};
};
