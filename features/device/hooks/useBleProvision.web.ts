import {useCallback, useState} from 'react';

export const BLE_SERVICE_UUID = 'a1b2c3d4-0000-4a5b-8c7d-9e0f1a2b3c4d';
export const BLE_PROVISION_UUID = 'a1b2c3d4-0001-4a5b-8c7d-9e0f1a2b3c4d';
export const BLE_STATUS_UUID = 'a1b2c3d4-0002-4a5b-8c7d-9e0f1a2b3c4d';
export const BLE_WIFI_SCAN_UUID = 'a1b2c3d4-0003-4a5b-8c7d-9e0f1a2b3c4d';

export type BleProvisionPhase =
  | 'idle'
  | 'requesting_permission'
  | 'scanning'
  | 'device_found'
  | 'connecting'
  | 'connected'
  | 'provisioning'
  | 'waiting_wifi'
  | 'reconnecting'
  | 'done'
  | 'error';

export interface WifiNetwork {
  ssid: string;
  rssi: number;
  encryption: 0 | 1 | 2 | 3 | 4;
}

export interface BleDiscoveredDevice {
  id: string;
  name: string | null;
}

export interface BleProvisionState {
  phase: BleProvisionPhase;
  foundDevice: BleDiscoveredDevice | null;
  foundDevices: BleDiscoveredDevice[];
  deviceId: string | null;
  errorMsg: string | null;
  bluetoothState: string | null;
  bluetoothMessage: string | null;
  wifiNetworks: WifiNetwork[];
  isScanning: boolean;
  statusUpdate: {
    status: string | null;
    phase: string | null;
    deviceId: string | null;
    reason: string | null;
    wifiStatus: string | null;
    attempt: number | null;
    attempts: number | null;
    raw: string | null;
  } | null;
}

const unsupportedMessage =
  'Bluetooth provisioning is not available on this platform. Use the iOS or Android app to finish setup.';

export function useBleProvision() {
  const [state, setState] = useState<BleProvisionState>({
    phase: 'error',
    foundDevice: null,
    foundDevices: [],
    deviceId: null,
    errorMsg: unsupportedMessage,
    bluetoothState: null,
    bluetoothMessage: unsupportedMessage,
    wifiNetworks: [],
    isScanning: false,
    statusUpdate: null,
  });

  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      phase: 'error',
      errorMsg: unsupportedMessage,
      bluetoothMessage: unsupportedMessage,
      wifiNetworks: [],
      isScanning: false,
      statusUpdate: null,
    }));
  }, []);

  const startScan = useCallback(() => {
    setState(prev => ({
      ...prev,
      phase: 'error',
      errorMsg: unsupportedMessage,
      bluetoothMessage: unsupportedMessage,
    }));
  }, []);

  const selectFoundDevice = useCallback((_device: BleDiscoveredDevice) => {}, []);
  const connectToDevice = useCallback(async (_device?: BleDiscoveredDevice) => {}, []);
  const sendCredentials = useCallback(
    async (
      _ssid: string,
      _password: string,
      _username: string,
      _token: string,
      _serverUrl: string,
    ) => null,
    [],
  );
  const requestWifiScan = useCallback(async () => {}, []);
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      errorMsg: null,
    }));
  }, []);

  return {
    state,
    startScan,
    selectFoundDevice,
    connectToDevice,
    sendCredentials,
    requestWifiScan,
    clearError,
    reset,
  };
}
