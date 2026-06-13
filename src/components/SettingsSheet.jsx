import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Slider from '@react-native-community/slider'

export function SettingsSheet({ visible, manifest, values, onChange, onClose, onExit }) {
  if (!visible) return null
  return (
    <View style={styles.scrim}>
      <TouchableOpacity style={styles.scrimTouch} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>{manifest.label.toUpperCase()}</Text>
        {manifest.params.map(p => (
          <View key={p.key} style={styles.row}>
            <View style={styles.rowHead}>
              <Text style={styles.pLabel}>{p.label}</Text>
              <Text style={[styles.pVal, { color: manifest.accent }]}>
                {Number(values[p.key] ?? p.default).toFixed(2)}
                {p.unit ? ` ${p.unit}` : ''}
              </Text>
            </View>
            <Slider
              minimumValue={p.min}
              maximumValue={p.max}
              step={p.step}
              value={values[p.key] ?? p.default}
              onValueChange={v => onChange(p.key, v)}
              minimumTrackTintColor={manifest.accent}
              maximumTrackTintColor="#2a2a2a"
              thumbTintColor="#ccc"
            />
          </View>
        ))}
        <View style={styles.actions}>
          <TouchableOpacity onPress={onExit} hitSlop={12}>
            <Text style={styles.exit}>← menu</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  scrimTouch: { flex: 1 },
  sheet: {
    backgroundColor: '#0f0f0fee',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: '#222',
    gap: 4,
  },
  title: { color: '#555', fontSize: 10, letterSpacing: 4, marginBottom: 10 },
  row: { marginBottom: 2 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  pLabel: { color: '#999', fontSize: 12 },
  pVal: { fontSize: 11, fontFamily: 'monospace' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  exit: { color: '#666', fontSize: 13 },
  close: { color: '#bbb', fontSize: 13 },
})
