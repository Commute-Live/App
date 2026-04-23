import {Platform} from 'react-native';

import {apiFetch} from './api';

export const supportsBleProvisioning = Platform.OS === 'ios' || Platform.OS === 'android';
export const supportsLocalDeviceSetup = supportsBleProvisioning;
export const postPairingRoute = '/dashboard';

export const unsupportedDeviceSetupMessage =
  'Device setup is currently available only in the iOS and Android app. Finish onboarding on a phone or tablet, then come back here to manage your display.';

export function getStartPairingRoute(): '/ble-provision' | '/register-device' {
  return supportsBleProvisioning ? '/ble-provision' : '/register-device';
}

export function getPostAuthRoute(deviceIds: string[]): '/dashboard' | '/ble-provision' | '/register-device' {
  if (deviceIds.length > 0) {
    return '/dashboard';
  }

  return getStartPairingRoute();
}

const parseDeviceSetupError = async (response: Response) => {
  const data = await response.json().catch(() => null);
  if (data?.error === 'DEVICE_NOT_LINKED') {
    return 'This device is not linked to your account.';
  }
  if (data?.error === 'DEVICE_WIFI_RESET_DISPATCH_FAILED') {
    return 'Could not reset the display right now. Try again when the device is online.';
  }
  if (data?.error === 'DEVICE_MQTT_RECONNECT_DISPATCH_FAILED') {
    return 'Could not reach the device. Try again in a moment.';
  }
  return 'Could not start Wi-Fi setup. Try again.';
};

export async function forceReconnectMqtt(deviceId: string) {
  try {
    const response = await apiFetch(`/user/device/${encodeURIComponent(deviceId)}/reconnect-mqtt`, {
      method: 'POST',
    });
    if (!response.ok) {
      return {ok: false as const, error: await parseDeviceSetupError(response)};
    }
    const data = await response.json().catch(() => ({})) as {deviceOnline?: boolean};
    return {ok: true as const, deviceOnline: data?.deviceOnline === true};
  } catch {
    return {ok: false as const, error: 'Network error'};
  }
}

export async function resetDeviceWifi(deviceId: string) {
  try {
    const response = await apiFetch(`/user/device/${encodeURIComponent(deviceId)}/reset-wifi`, {
      method: 'POST',
    });
    if (!response.ok) {
      return {ok: false as const, error: await parseDeviceSetupError(response)};
    }
    const data = await response.json().catch(() => ({})) as {deviceOnline?: boolean};
    return {ok: true as const, deviceOnline: data?.deviceOnline === true};
  } catch {
    return {ok: false as const, error: 'Network error'};
  }
}
