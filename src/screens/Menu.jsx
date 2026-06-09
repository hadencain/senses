import React from 'react'
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, StatusBar, Dimensions,
} from 'react-native'
import { MODES } from '../modes'

const { width } = Dimensions.get('window')
const CARD = (width - 48) / 2

export function Menu({ navigation }) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <Text style={styles.wordmark}>SENSES</Text>
      <FlatList
        data={MODES}
        numColumns={2}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { borderColor: item.accent + '55' }]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate(item.id)}
          >
            <View style={[styles.pip, { backgroundColor: item.accent }]} />
            <View style={styles.cardBody}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.sub}>{item.sub}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingTop: 56,
  },
  wordmark: {
    color: '#2a2a2a',
    fontSize: 10,
    letterSpacing: 8,
    marginBottom: 28,
    paddingHorizontal: 20,
  },
  grid: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  card: {
    width: CARD,
    height: CARD,
    margin: 6,
    backgroundColor: '#111',
    borderWidth: 1,
    borderRadius: 3,
    padding: 14,
    justifyContent: 'space-between',
  },
  pip: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  cardBody: {
    gap: 3,
  },
  label: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  sub: {
    color: '#444',
    fontSize: 10,
  },
})
