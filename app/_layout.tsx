import '../lib/fontPatch'; // MUST be first — patches StyleSheet.create before expo-router loads routes
import React, {useEffect} from 'react';
import {Stack, useRouter} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {QueryClientProvider} from '@tanstack/react-query';
import {
  useFonts,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  Geist_800ExtraBold,
  Geist_900Black,
} from '@expo-google-fonts/geist';
import {GoogleSignin} from '../lib/googleSignIn';
import {AppStateProvider} from '../state/appState';
import {colors} from '../theme';
import {setSessionInvalidHandler} from '../lib/api';
import {queryClient} from '../lib/queryClient';
import {AuthProvider, useAuth} from '../state/authProvider';
import 'react-native-reanimated';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

function AppNavigator() {
  const router = useRouter();
  const {clearAuth, status} = useAuth();

  useEffect(() => {
    setSessionInvalidHandler(() => {
      clearAuth();
    });
    return () => {
      setSessionInvalidHandler(null);
    };
  }, [clearAuth]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      const t = setTimeout(() => router.replace('/'), 50);
      return () => clearTimeout(t);
    }
  }, [status, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationTypeForReplace: 'push',
        contentStyle: {backgroundColor: colors.background},
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="register-device" />
      <Stack.Screen name="ble-provision" options={{animation: 'fade'}} />
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
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    Geist_800ExtraBold,
    Geist_900Black,
  });

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AppStateProvider>
          <AuthProvider>
            <StatusBar style="light" />
            <AppNavigator />
          </AuthProvider>
        </AppStateProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
