#include "AudioEngine.h"
#include <jni.h>

static AudioEngine gEngine;

extern "C" {

JNIEXPORT void JNICALL
Java_expo_modules_sensesaudio_SensesAudioModule_nativeStart(JNIEnv*, jobject) {
    gEngine.start();
}

JNIEXPORT void JNICALL
Java_expo_modules_sensesaudio_SensesAudioModule_nativeStop(JNIEnv*, jobject) {
    gEngine.stop();
}

JNIEXPORT void JNICALL
Java_expo_modules_sensesaudio_SensesAudioModule_nativeTriggerGrain(
        JNIEnv*, jobject,
        jfloat position, jfloat durationSec, jfloat pitchRatio, jfloat amplitude) {
    gEngine.triggerGrain(position, durationSec, pitchRatio, amplitude);
}

JNIEXPORT void JNICALL
Java_expo_modules_sensesaudio_SensesAudioModule_nativeSetPlayback(
        JNIEnv*, jobject,
        jboolean active, jfloat loopStart, jfloat loopEnd, jfloat rate) {
    gEngine.setPlayback(active != JNI_FALSE, loopStart, loopEnd, rate);
}

JNIEXPORT void JNICALL
Java_expo_modules_sensesaudio_SensesAudioModule_nativeSetMasterGain(
        JNIEnv*, jobject, jfloat gain) {
    gEngine.setMasterGain(gain);
}

JNIEXPORT jfloat JNICALL
Java_expo_modules_sensesaudio_SensesAudioModule_nativeGetBufferFill(JNIEnv*, jobject) {
    return gEngine.getBufferFill();
}

} // extern "C"
