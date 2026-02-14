import React, {useEffect} from 'react';
import {Stack, useRouter} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppStateProvider} from '../state/appState';
import {colors} from '../theme';
import {setSessionInvalidHandler} from '../lib/api';
import {AuthProvider, useAuth} from '../state/authProvider';
import 'react-native-reanimated';

function AppNavigator() {
  const router = useRouter();
  const {clearAuth} = useAuth();

  useEffect(() => {
    setSessionInvalidHandler(() => {
      clearAuth();
      router.replace('/auth');
    });
    return () => {
      setSessionInvalidHandler(null);
    };
  }, [clearAuth, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {backgroundColor: colors.background},
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="login" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="register-device" />
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
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <AppNavigator />
        </AuthProvider>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
