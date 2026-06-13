import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

export function OverlayRail({ keys = [], values = {}, accent = '#888' }) {
  if (!keys.length) return null
  return (
    <View style={styles.rail} pointerEvents="none">
      {keys.map(k => (
        <View key={k} style={styles.line}>
          <Text style={styles.key}>{k}</Text>
          <Text style={[styles.val, { color: accent }]}>
            {Number(values[k] ?? 0).toFixed(2)}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  rail: { position: 'absolute', left: 14, top: '20%', gap: 10 },
  line: { gap: 1 },
  key: {
    color: '#ffffff55',
    fontSize: 9,
    fontFamily: 'monospace',
    letterSpacing: 1.5,
    textShadowColor: '#00000088',
    textShadowRadius: 3,
  },
  val: {
    fontSize: 12,
    fontFamily: 'monospace',
    letterSpacing: 1,
    textShadowColor: '#00000088',
    textShadowRadius: 3,
  },
})
