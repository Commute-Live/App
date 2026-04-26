const IS_DEV = process.env.APP_VARIANT === 'dev';

export default {
  expo: {
    name: IS_DEV ? 'CommuteLive Dev' : 'CommuteLive',
    slug: 'commutelive',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/logo.png',
    scheme: 'commutelive',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/images/logo.png',
      resizeMode: 'contain',
      backgroundColor: '#F2F2F7',
    },
    ios: {
      infoPlist: {
        NSBluetoothAlwaysUsageDescription:
          'CommuteLive uses Bluetooth to set up your transit display without switching Wi-Fi networks.',
        ITSAppUsesNonExemptEncryption: false,
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
          NSAllowsLocalNetworking: true,
        },
      },
      bundleIdentifier: IS_DEV ? 'com.commutelive.app.dev' : 'com.commutelive.app',
      usesAppleSignIn: true,
      appleTeamId: '56V7XSG7Z5',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/logo.png',
        backgroundColor: '#F2F2F7',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: IS_DEV ? 'com.commutelive.app.dev' : 'com.commutelive.app',
      permissions: [
        'android.permission.BLUETOOTH',
        'android.permission.BLUETOOTH_ADMIN',
        'android.permission.BLUETOOTH_CONNECT',
        'android.permission.BLUETOOTH_SCAN',
        'android.permission.ACCESS_FINE_LOCATION',
      ],
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/logo.png',
    },
    plugins: [
      './plugins/withDisableUserScriptSandboxing',
      './plugins/withBlockDevArchive',
      'expo-router',
      'expo-font',
      [
        'react-native-ble-plx',
        {
          isBackgroundEnabled: false,
          modes: ['central'],
          bluetoothAlwaysPermission:
            'Allow CommuteLive to connect to your transit display via Bluetooth.',
        },
      ],
      [
        '@react-native-google-signin/google-signin',
        {
          iosUrlScheme: IS_DEV
            ? 'com.googleusercontent.apps.790984102356-l6hiv8it79uvbeb65s17te3u61dfltft'
            : 'com.googleusercontent.apps.790984102356-sq1leqa8e4c71pb51nmf2gsrl8up0n13',
        },
      ],
      '@react-native-community/datetimepicker',
      [
        'expo-datadog',
        {
          errorTracking: {
            iosDsyms: false,
            iosSourcemaps: false,
            androidSourcemaps: false,
            androidProguardMappingFiles: false,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
    },
  },
};
