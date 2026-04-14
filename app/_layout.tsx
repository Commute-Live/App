import React, {useEffect} from 'react';
import {Stack, useRouter} from 'expo-router';
import {DatadogProvider} from '@datadog/mobile-react-native';
import {createDatadogConfig} from '../lib/datadog';
import {StatusBar} from 'expo-status-bar';
import {FlatList, ScrollView, SectionList} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {QueryClientProvider} from '@tanstack/react-query';
import {GoogleSignin} from '../lib/googleSignIn';
import {googleAuthConfig} from '../lib/googleAuthConfig';
import {AppStateProvider} from '../state/appState';
import {colors} from '../theme';
import {queryClient} from '../lib/queryClient';
import {AuthProvider, useAuth} from '../state/authProvider';
import {ErrorBoundary} from '../components/ErrorBoundary';
import '../lib/fontPatch';
import 'react-native-reanimated';

type ScrollIndicatorDefaultsComponent = {
  defaultProps?: Record<string, unknown>;
};

const hiddenScrollIndicatorDefaults = {
  showsHorizontalScrollIndicator: false,
  showsVerticalScrollIndicator: false,
};

function hideScrollIndicatorsByDefault(component: ScrollIndicatorDefaultsComponent) {
  component.defaultProps = {
    ...component.defaultProps,
    ...hiddenScrollIndicatorDefaults,
  };
}

hideScrollIndicatorsByDefault(ScrollView as ScrollIndicatorDefaultsComponent);
hideScrollIndicatorsByDefault(FlatList as ScrollIndicatorDefaultsComponent);
hideScrollIndicatorsByDefault(SectionList as ScrollIndicatorDefaultsComponent);

GoogleSignin.configure({
  webClientId: googleAuthConfig.webClientId,
  iosClientId: googleAuthConfig.iosClientId,
});

const datadogConfig = createDatadogConfig();

function AppNavigator() {
  const router = useRouter();
  const {status} = useAuth();

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
      <Stack.Screen name="(tabs)" options={{animation: 'none'}} />
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
    <DatadogProvider configuration={datadogConfig}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <AppStateProvider>
            <AuthProvider>
              <StatusBar style="dark" />
              <ErrorBoundary label="root">
                <AppNavigator />
              </ErrorBoundary>
            </AuthProvider>
          </AppStateProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </DatadogProvider>
  );
}
