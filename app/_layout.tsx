import React from 'react';
import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppStateProvider} from '../state/appState';
import {colors} from '../theme';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {backgroundColor: colors.background},
          }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="dashboard" />
          <Stack.Screen name="paired-online" />
          <Stack.Screen name="setup-intro" />
          <Stack.Screen name="reconnect-help" />
          <Stack.Screen name="edit-stations" />
          <Stack.Screen name="change-layout" />
          <Stack.Screen name="switch-preset" />
          <Stack.Screen name="brightness" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
