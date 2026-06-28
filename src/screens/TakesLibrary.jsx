import React, { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { listTakes, deleteTake } from '../capture/takes-io'
import { formatDuration } from '../capture/takes'

export function TakesLibrary({ navigation }) {
  const [takes, setTakes] = useState([])

  const refresh = useCallback(() => { listTakes().then(setTakes).catch(() => setTakes([])) }, [])
  useFocusEffect(refresh)

  const onDelete = useCallback(async (id) => { await deleteTake(id); refresh() }, [refresh])

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={16}><Text style={styles.back}>←</Text></TouchableOpacity>
        <Text style={styles.title}>Takes</Text>
      </View>
      {takes.length === 0 ? (
        <Text style={styles.empty}>No takes yet. Record one from an effect.</Text>
      ) : (
        <FlatList
          data={takes}
          keyExtractor={t => t.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.effect}>{item.effectId}</Text>
                <Text style={styles.meta}>{formatDuration(item.durationMs)} · {new Date(item.createdAt).toLocaleString()}</Text>
              </View>
              <TouchableOpacity style={[styles.btn, styles.btnDisabled]} disabled>
                <Text style={styles.btnTextDisabled}>render (Phase 2)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={() => onDelete(item.id)}>
                <Text style={styles.btnText}>delete</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingTop: 48 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  back: { color: '#888', fontSize: 22 },
  title: { color: '#eee', fontSize: 18 },
  empty: { color: '#666', textAlign: 'center', marginTop: 64 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  info: { flex: 1 },
  effect: { color: '#ddd', fontSize: 15 },
  meta: { color: '#666', fontSize: 12, marginTop: 2 },
  btn: { paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#c8a96e', fontSize: 13 },
  btnTextDisabled: { color: '#888', fontSize: 13 },
})
