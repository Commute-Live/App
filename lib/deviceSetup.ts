import {Platform} from 'react-native';

export const supportsBleProvisioning = Platform.OS === 'ios' || Platform.OS === 'android';
export const supportsLocalDeviceSetup = supportsBleProvisioning;

export const unsupportedDeviceSetupMessage =
  'Device setup is currently available only in the iOS and Android app. Finish onboarding on a phone or tablet, then come back here to manage your display.';

export function getPostAuthRoute(deviceIds: string[]) {
  if (deviceIds.length > 0) {
    return '/dashboard';
  }

  return supportsBleProvisioning ? '/ble-provision' : '/setup-intro';
}
