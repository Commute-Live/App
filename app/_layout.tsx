import React, {useEffect} from 'react';
import {Stack, useRouter} from 'expo-router';
import {DatadogProvider} from '@datadog/mobile-react-native';
import {createDatadogConfig} from '../lib/datadog';
import {StatusBar} from 'expo-status-bar';
import {useFonts} from 'expo-font';
import {FlatList, ScrollView, SectionList} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {QueryClientProvider} from '@tanstack/react-query';
import {GoogleSignin} from '../lib/googleSignIn';
import {googleAuthConfig} from '../lib/googleAuthConfig';
import {AppStateProvider} from '../state/appState';
import {colors} from '../theme';
import {setSessionInvalidHandler} from '../lib/api';
import {queryClient} from '../lib/queryClient';
import {AuthProvider, useAuth} from '../state/authProvider';
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
  const [fontsLoaded] = useFonts({
    Rubik_300Light: require('../assets/fonts/Rubik/static/Rubik-Light.ttf'),
    Rubik_300LightItalic: require('../assets/fonts/Rubik/static/Rubik-LightItalic.ttf'),
    Rubik_400Regular: require('../assets/fonts/Rubik/static/Rubik-Regular.ttf'),
    Rubik_400Italic: require('../assets/fonts/Rubik/static/Rubik-Italic.ttf'),
    Rubik_500Medium: require('../assets/fonts/Rubik/static/Rubik-Medium.ttf'),
    Rubik_500MediumItalic: require('../assets/fonts/Rubik/static/Rubik-MediumItalic.ttf'),
    Rubik_600SemiBold: require('../assets/fonts/Rubik/static/Rubik-SemiBold.ttf'),
    Rubik_600SemiBoldItalic: require('../assets/fonts/Rubik/static/Rubik-SemiBoldItalic.ttf'),
    Rubik_700Bold: require('../assets/fonts/Rubik/static/Rubik-Bold.ttf'),
    Rubik_700BoldItalic: require('../assets/fonts/Rubik/static/Rubik-BoldItalic.ttf'),
    Rubik_800ExtraBold: require('../assets/fonts/Rubik/static/Rubik-ExtraBold.ttf'),
    Rubik_800ExtraBoldItalic: require('../assets/fonts/Rubik/static/Rubik-ExtraBoldItalic.ttf'),
    Rubik_900Black: require('../assets/fonts/Rubik/static/Rubik-Black.ttf'),
    Rubik_900BlackItalic: require('../assets/fonts/Rubik/static/Rubik-BlackItalic.ttf'),
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <DatadogProvider configuration={datadogConfig}>
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
    </DatadogProvider>
  );
}
