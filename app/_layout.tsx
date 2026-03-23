import 'react-native-reanimated';

import React, {useEffect} from 'react';
import {View} from 'react-native';
import {Stack, useRouter} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {QueryClientProvider} from '@tanstack/react-query';
import {AppStateProvider} from '../state/appState';
import {colors} from '../theme';
import {setSessionInvalidHandler} from '../lib/api';
import {queryClient} from '../lib/queryClient';
import {AuthProvider, useAuth} from '../state/authProvider';
import {BottomSheetModalProviderCompat, GestureHandlerRootViewCompat} from '../lib/nativeCompat';

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
        animation: 'slide_from_right',
        animationTypeForReplace: 'push',
        contentStyle: {backgroundColor: colors.background},
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" options={{animation: 'none'}} />
      <Stack.Screen name="login" options={{animation: 'none'}} />
      <Stack.Screen name="sign-up" options={{animation: 'none'}} />
      <Stack.Screen name="forgot-password" options={{animation: 'none'}} />
      <Stack.Screen name="reset-password" options={{animation: 'none'}} />
      <Stack.Screen name="register-device" />
      <Stack.Screen name="ble-provision" />
      <Stack.Screen name="dashboard" options={{animation: 'none'}} />
      <Stack.Screen name="presets" options={{animation: 'none'}} />
      <Stack.Screen name="settings" options={{animation: 'none'}} />
      <Stack.Screen name="preset-editor" options={{animation: 'slide_from_right'}} />
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
    <GestureHandlerRootViewCompat style={{flex: 1}}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <BottomSheetModalProviderCompat>
            <AppStateProvider>
              <AuthProvider>
                <StatusBar style="auto" />
                <AppNavigator />
              </AuthProvider>
            </AppStateProvider>
          </BottomSheetModalProviderCompat>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootViewCompat>
  );
}
