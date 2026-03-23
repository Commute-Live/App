import React from 'react';
import {NativeModules, Platform, UIManager, View, type StyleProp, type ViewProps, type ViewStyle} from 'react-native';

const gestureHandlerModule = (() => {
  try {
    return require('react-native-gesture-handler');
  } catch {
    return null;
  }
})();

const bottomSheetModule = (() => {
  if (!gestureHandlerModule) return null;
  try {
    return require('@gorhom/bottom-sheet');
  } catch {
    return null;
  }
})();

const hapticsModule = (() => {
  try {
    return require('expo-haptics') as typeof import('expo-haptics');
  } catch {
    return null;
  }
})();

const localAuthenticationModule = (() => {
  try {
    return require('expo-local-authentication') as typeof import('expo-local-authentication');
  } catch {
    return null;
  }
})();

const blurModule = (() => {
  if (Platform.OS === 'web') {
    try {
      return require('expo-blur') as typeof import('expo-blur');
    } catch {
      return null;
    }
  }

  const hasBlurViewManager =
    typeof UIManager.getViewManagerConfig === 'function'
      ? !!UIManager.getViewManagerConfig('ExpoBlurView')
      : !!(NativeModules as Record<string, unknown>).ExpoBlur;

  if (!hasBlurViewManager) return null;

  try {
    return require('expo-blur') as typeof import('expo-blur');
  } catch {
    return null;
  }
})();

const bleProvisionModule = (() => {
  try {
    return require('../features/device/hooks/useBleProvision') as typeof import('../features/device/hooks/useBleProvision');
  } catch {
    return null;
  }
})();

export const GestureHandlerRootViewCompat: React.ComponentType<ViewProps> =
  gestureHandlerModule?.GestureHandlerRootView ?? View;

export function BottomSheetModalProviderCompat({children}: {children: React.ReactNode}) {
  const Provider = bottomSheetModule?.BottomSheetModalProvider;
  if (!Provider) return <>{children}</>;
  return <Provider>{children}</Provider>;
}

export const getBottomSheetModule = () => bottomSheetModule;

export const getHapticsModule = () => hapticsModule;

export const getLocalAuthenticationModule = () => localAuthenticationModule;

export function BlurViewCompat({
  children,
  intensity,
  tint,
  style,
}: {
  children?: React.ReactNode;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default' | 'extraLight' | 'regular' | 'prominent' | 'systemUltraThinMaterial' | 'systemThinMaterial' | 'systemMaterial' | 'systemThickMaterial' | 'systemChromeMaterial' | 'systemUltraThinMaterialLight' | 'systemThinMaterialLight' | 'systemMaterialLight' | 'systemThickMaterialLight' | 'systemChromeMaterialLight' | 'systemUltraThinMaterialDark' | 'systemThinMaterialDark' | 'systemMaterialDark' | 'systemThickMaterialDark' | 'systemChromeMaterialDark';
  style?: StyleProp<ViewStyle>;
}) {
  const BlurView = blurModule?.BlurView;

  if (!BlurView) {
    return <View style={style}>{children}</View>;
  }

  return (
    <BlurView intensity={intensity} tint={tint} style={style}>
      {children}
    </BlurView>
  );
}

export function useBleProvisionCompat() {
  if (bleProvisionModule?.useBleProvision) {
    return {...bleProvisionModule.useBleProvision(), isAvailable: true as const};
  }

  return {
    state: {
      phase: 'error' as const,
      foundDevice: null,
      deviceId: null,
      errorMsg: 'Bluetooth provisioning is unavailable in this binary. Rebuild the native app to use BLE setup.',
    },
    startScan: async () => {},
    connectToDevice: async () => {},
    sendCredentials: async () => null,
    reset: () => {},
    isAvailable: false as const,
  };
}
