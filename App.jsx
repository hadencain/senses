import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StyleSheet } from 'react-native'
import { Menu } from './src/screens/Menu'
import { EffectScreen } from './src/components/EffectScreen'
import { EditorStub } from './src/screens/EditorStub'

const Stack = createStackNavigator()

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: false }}>
          <Stack.Screen name="Menu" component={Menu} />
          <Stack.Screen name="Effect" component={EffectScreen} />
          <Stack.Screen name="EditorStub" component={EditorStub} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({ root: { flex: 1 } })
