import React, { useState, useCallback, useRef } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { listTakes, deleteTake } from '../capture/takes-io'
import { formatDuration } from '../capture/takes'
import { renderTake } from '../render/renderTake'
import SensesRender from '../../modules/senses-render'

export function TakesLibrary({ navigation }) {
  const [takes, setTakes] = useState([])
  const [job, setJob] = useState(null) // { id, progress }
  const [errors, setErrors] = useState({}) // id -> message
  const cancelRef = useRef(false)

  const refresh = useCallback(() => { listTakes().then(setTakes).catch(() => setTakes([])) }, [])
  useFocusEffect(refresh)

  const onDelete = useCallback(async (id) => { try { await deleteTake(id) } finally { refresh() } }, [refresh])

  const onRender = useCallback(async (id) => {
    cancelRef.current = false
    setErrors(e => ({ ...e, [id]: undefined }))
    setJob({ id, progress: 0 })
    SensesRender.setKeepScreenOn(true)
    try {
      await renderTake(id, {
        onProgress: p => setJob({ id, progress: p }),
        shouldCancel: () => cancelRef.current,
      })
    } catch (e) {
      setErrors(prev => ({ ...prev, [id]: e?.message ?? 'render failed' }))
    } finally {
      SensesRender.setKeepScreenOn(false)
      setJob(null)
      refresh()
    }
  }, [refresh])

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={16}><Text style={styles.back}>←</Text></TouchableOpacity>
        <Text style={styles.title}>Takes</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Spike')} hitSlop={16}><Text style={styles.back}>  ⚙ spike</Text></TouchableOpacity>
      </View>
      {takes.length === 0 ? (
        <Text style={styles.empty}>No takes yet. Record one from an effect.</Text>
      ) : (
        <FlatList
          data={takes}
          keyExtractor={t => t.id}
          renderItem={({ item }) => {
            const active = job?.id === item.id
            const busy = job != null
            return (
              <View>
                <View style={styles.row}>
                  <View style={styles.info}>
                    <Text style={styles.effect}>{item.effectId}{item.rendered ? '  ✓' : ''}</Text>
                    <Text style={styles.meta}>{formatDuration(item.durationMs)} · {new Date(item.createdAt).toLocaleString()}</Text>
                  </View>
                  {active ? (
                    <TouchableOpacity style={styles.btn} onPress={() => { cancelRef.current = true }}>
                      <Text style={styles.btnText}>{Math.round(job.progress * 100)}% ✕</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[styles.btn, busy && styles.btnDisabled]} disabled={busy} onPress={() => onRender(item.id)}>
                      <Text style={busy ? styles.btnTextDisabled : styles.btnText}>{item.rendered ? 're-render' : 'render'}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.btn, busy && styles.btnDisabled]} disabled={busy} onPress={() => onDelete(item.id)}>
                    <Text style={busy ? styles.btnTextDisabled : styles.btnText}>delete</Text>
                  </TouchableOpacity>
                </View>
                {errors[item.id] ? <Text style={styles.error}>{errors[item.id]}</Text> : null}
              </View>
            )
          }}
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
  error: { color: '#b3541e', fontSize: 11, paddingHorizontal: 16, paddingBottom: 8 },
})
