import React from 'react'
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native'

function fmt(ms) {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function LiveChrome({ recording, durationMs, onRecord, onStop, onSettings, onBack }) {
  if (recording) {
    return (
      <TouchableOpacity style={styles.recDot} onPress={onStop} hitSlop={20}>
        <View style={styles.dot} />
        <Text style={styles.timer}>{fmt(durationMs)}</Text>
      </TouchableOpacity>
    )
  }
  return (
    <>
      <TouchableOpacity style={styles.back} onPress={onBack} hitSlop={16}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.settings} onPress={onSettings} hitSlop={16}>
        <Text style={styles.settingsText}>≡</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.record} onPress={onRecord} activeOpacity={0.8}>
        <View style={styles.recordInner} />
      </TouchableOpacity>
    </>
  )
}

const styles = StyleSheet.create({
  back: { position: 'absolute', top: 48, left: 16, padding: 8 },
  backText: { color: '#888', fontSize: 22 },
  settings: { position: 'absolute', top: 48, right: 16, padding: 8 },
  settingsText: { color: '#888', fontSize: 22 },
  record: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#ffffffcc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#ffffffee' },
  recDot: {
    position: 'absolute',
    top: 54,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e04545' },
  timer: { color: '#ffffffaa', fontSize: 11, fontFamily: 'monospace', letterSpacing: 1 },
})
