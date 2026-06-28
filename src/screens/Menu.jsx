import React from 'react'
import { View, Text, TouchableOpacity, SectionList, StyleSheet, StatusBar } from 'react-native'
import { ALL_ENTRIES } from '../modes'

function buildSections() {
  const byCat = {}
  for (const entry of ALL_ENTRIES) {
    const cat = entry.manifest.category
    if (!byCat[cat]) byCat[cat] = []
    byCat[cat].push(entry)
  }
  return Object.entries(byCat).map(([title, data]) => ({ title, data }))
}

export function Menu({ navigation }) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <Text style={styles.wordmark}>SENSES</Text>
      <SectionList
        sections={buildSections()}
        keyExtractor={entry => entry.manifest.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={styles.section}>{section.title.toUpperCase()}</Text>
        )}
        renderItem={({ item }) => {
          const m = item.manifest
          return (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.6}
              onPress={() =>
                m.type === 'editor'
                  ? navigation.navigate('EditorStub')
                  : navigation.navigate('Effect', { modeId: m.id })
              }
            >
              <View style={[styles.pip, { backgroundColor: m.accent }]} />
              <Text style={styles.label}>{m.label}</Text>
              <Text style={styles.sub}>{m.sub}</Text>
            </TouchableOpacity>
          )
        }}
        ListFooterComponent={
          <>
            <Text style={styles.section}>LIBRARY</Text>
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.6}
              onPress={() => navigation.navigate('Takes')}
            >
              <View style={[styles.pip, { backgroundColor: '#555' }]} />
              <Text style={styles.label}>Takes</Text>
              <Text style={styles.sub}>recordings</Text>
            </TouchableOpacity>
          </>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 56 },
  wordmark: { color: '#2a2a2a', fontSize: 10, letterSpacing: 8, marginBottom: 20, paddingHorizontal: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  section: { color: '#3a3a3a', fontSize: 10, letterSpacing: 3, marginTop: 26, marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1a1a1a',
  },
  pip: { width: 6, height: 6, borderRadius: 3, alignSelf: 'center' },
  label: { color: '#ddd', fontSize: 15, fontWeight: '500', letterSpacing: 0.2 },
  sub: { color: '#555', fontSize: 11, flex: 1, textAlign: 'right' },
})
