import React from 'react'
import { TouchableOpacity, Text, StyleSheet } from 'react-native'

// Placeholder — replaced in Task 8.
export function LiveChrome({ onBack }) {
  return (
    <TouchableOpacity style={styles.back} onPress={onBack} hitSlop={16}>
      <Text style={styles.backText}>←</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  back: { position: 'absolute', top: 48, left: 16, padding: 8 },
  backText: { color: '#888', fontSize: 22 },
})
