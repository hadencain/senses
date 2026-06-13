import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'

export function EditorStub() {
  const nav = useNavigation()
  return (
    <View style={styles.root}>
      <Text style={styles.title}>CLIP EDITOR</Text>
      <Text style={styles.sub}>phase 2 — effects applied to recorded footage</Text>
      <TouchableOpacity onPress={() => nav.goBack()} hitSlop={16}>
        <Text style={styles.back}>← menu</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', gap: 12 },
  title: { color: '#444', fontSize: 14, letterSpacing: 6 },
  sub: { color: '#333', fontSize: 11 },
  back: { color: '#666', fontSize: 13, marginTop: 24 },
})
