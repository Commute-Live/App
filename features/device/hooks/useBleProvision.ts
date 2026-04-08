import {useCallback, useEffect, useRef, useState} from 'react';
import {BleManager, Device, BleError} from 'react-native-ble-plx';
import {Platform, PermissionsAndroid} from 'react-native';
import {Buffer} from 'buffer';
import {logger} from '../../../lib/datadog';

// CommuteLive custom GATT UUIDs — must match firmware ble_provisioner.cpp
export const BLE_SERVICE_UUID    = 'a1b2c3d4-0000-4a5b-8c7d-9e0f1a2b3c4d';
export const BLE_PROVISION_UUID  = 'a1b2c3d4-0001-4a5b-8c7d-9e0f1a2b3c4d';
export const BLE_STATUS_UUID     = 'a1b2c3d4-0002-4a5b-8c7d-9e0f1a2b3c4d';
export const BLE_WIFI_SCAN_UUID  = 'a1b2c3d4-0003-4a5b-8c7d-9e0f1a2b3c4d';

// The firmware advertises as "esp32-XXXX" (same as its MQTT deviceId).
const BLE_NAME_PREFIX = 'esp32-';

export type BleProvisionPhase =
  | 'idle'
  | 'requesting_permission'
  | 'scanning'
  | 'device_found'
  | 'connecting'
  | 'connected'
  | 'provisioning'
  | 'waiting_wifi'
  | 'done'
  | 'error';

export interface WifiNetwork {
  ssid: string;
  rssi: number;
  encryption: 0 | 1 | 2 | 3 | 4; // 0=open, 1=WEP, 2=WPA, 3=WPA2, 4=Enterprise
}

export interface BleProvisionState {
  phase: BleProvisionPhase;
  foundDevice: Device | null;
  foundDevices: Device[];
  deviceId: string | null;   // esp32-XXXX — set from BLE device name during scan
  errorMsg: string | null;
  bluetoothState: string | null;
  bluetoothMessage: string | null;
  wifiNetworks: WifiNetwork[];
  isScanning: boolean;
  statusUpdate: BleStatusPayload | null;
}

type BleStatusPayload = {
  status: string | null;
  phase: string | null;
  deviceId: string | null;
  reason: string | null;
  wifiStatus: string | null;
  attempt: number | null;
  attempts: number | null;
  raw: string | null;
};

type PendingWifiResult = {
  resolve: (deviceId: string | null) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const WIFI_RESULT_TIMEOUT_MS = 45_000;
const SCAN_TIMEOUT_MS = 20_000;
const DISCOVERY_SETTLE_MS = 2_500;

const getBluetoothMessage = (bleState: string | null | undefined): string | null => {
  switch (bleState) {
    case 'PoweredOff':
      return 'Bluetooth is off. Turn it on, then try again.';
    case 'Unauthorized':
      return 'Bluetooth access is blocked. Allow Bluetooth in Settings, then try again.';
    case 'Unsupported':
      return 'Bluetooth is not supported on this device.';
    default:
      return null;
  }
};

const parseBleStatusPayload = (value: string | null | undefined): BleStatusPayload => {
  if (!value) {
    return {
      status: null,
      phase: null,
      deviceId: null,
      reason: null,
      wifiStatus: null,
      attempt: null,
      attempts: null,
      raw: null,
    };
  }

  try {
    const data = JSON.parse(value) as {
      status?: unknown;
      phase?: unknown;
      deviceId?: unknown;
      reason?: unknown;
      wifiStatus?: unknown;
      attempt?: unknown;
      attempts?: unknown;
    };
    return {
      status: typeof data.status === 'string' ? data.status : null,
      phase: typeof data.phase === 'string' ? data.phase : null,
      deviceId: typeof data.deviceId === 'string' ? data.deviceId : null,
      reason: typeof data.reason === 'string' ? data.reason : null,
      wifiStatus: typeof data.wifiStatus === 'string' ? data.wifiStatus : null,
      attempt: typeof data.attempt === 'number' ? data.attempt : null,
      attempts: typeof data.attempts === 'number' ? data.attempts : null,
      raw: value,
    };
  } catch {
    return {
      status: null,
      phase: null,
      deviceId: null,
      reason: null,
      wifiStatus: null,
      attempt: null,
      attempts: null,
      raw: value,
    };
  }
};

const getWifiFailureMessage = (payload: BleStatusPayload): string => {
  switch (payload.reason) {
    case 'auth_error':
      return 'The display could not join Wi-Fi. Check the password and try again.';
    case 'provision_error':
      return 'The display joined Wi-Fi but could not finish setup. Try again.';
    default:
      return 'Display could not connect to Wi-Fi. Check your network name, username, and password, then try again.';
  }
};

const isCancelledBleError = (error: BleError | null | undefined) => {
  if (!error) return false;
  return error.message.trim().toLowerCase() === 'operation was cancelled';
};

// Singleton BleManager — created once per app session, never recreated.
let managerInstance: BleManager | null = null;
function getManager(): BleManager | null {
  if (!managerInstance) {
    try {
      managerInstance = new BleManager();
    } catch {
      return null;
    }
  }
  return managerInstance;
}

async function requestAndroidPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 31) {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return (
      results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]  === PermissionsAndroid.RESULTS.GRANTED &&
      results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
    );
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function useBleProvision() {
  const [state, setState] = useState<BleProvisionState>({
    phase: 'idle',
    foundDevice: null,
    foundDevices: [],
    deviceId: null,
    errorMsg: null,
    bluetoothState: null,
    bluetoothMessage: null,
    wifiNetworks: [],
    isScanning: false,
    statusUpdate: null,
  });

  const deviceRef      = useRef<Device | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discoveryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusSubscriptionRef = useRef<{remove: () => void} | null>(null);
  const wifiScanSubscriptionRef = useRef<{remove: () => void} | null>(null);
  const bleStateSubscriptionRef = useRef<{remove: () => void} | null>(null);
  const pendingWifiResultRef = useRef<PendingWifiResult | null>(null);
  const scanChunksRef = useRef<Array<{s: string; r: number; e: number}>>([]);

  const setPhase = useCallback((phase: BleProvisionPhase, extra?: Partial<BleProvisionState>) => {
    setState(prev => ({...prev, phase, ...extra}));
  }, []);

  const fail = useCallback((msg: string) => {
    setPhase('error', {errorMsg: msg});
  }, [setPhase]);

  const cleanup = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    if (discoveryTimeoutRef.current) {
      clearTimeout(discoveryTimeoutRef.current);
      discoveryTimeoutRef.current = null;
    }
    if (pendingWifiResultRef.current) {
      clearTimeout(pendingWifiResultRef.current.timeout);
      pendingWifiResultRef.current.resolve(null);
      pendingWifiResultRef.current = null;
    }
    statusSubscriptionRef.current?.remove();
    statusSubscriptionRef.current = null;
    wifiScanSubscriptionRef.current?.remove();
    wifiScanSubscriptionRef.current = null;
    const mgr = getManager();
    mgr?.stopDeviceScan();
    if (deviceRef.current) {
      deviceRef.current.cancelConnection().catch(() => {});
      deviceRef.current = null;
    }
  }, []);

  const syncBluetoothState = useCallback((bleState: string | null) => {
    const bluetoothMessage = getBluetoothMessage(bleState);

    if (bluetoothMessage) {
      cleanup();
    }

    setState(prev => {
      const nextState: BleProvisionState = {
        ...prev,
        bluetoothState: bleState,
        bluetoothMessage,
      };

      if (
        !bluetoothMessage &&
        prev.phase === 'error' &&
        prev.errorMsg &&
        prev.errorMsg === prev.bluetoothMessage
      ) {
        return {
          ...nextState,
          phase: 'idle',
          errorMsg: null,
        };
      }

      if (
        bluetoothMessage &&
        prev.phase !== 'idle' &&
        prev.phase !== 'error' &&
        prev.phase !== 'done'
      ) {
        return {
          ...nextState,
          phase: 'error',
          errorMsg: bluetoothMessage,
          isScanning: false,
        };
      }

      return nextState;
    });
  }, [cleanup]);

  useEffect(() => {
    const mgr = getManager();

    if (mgr) {
      bleStateSubscriptionRef.current = mgr.onStateChange((nextState) => {
        syncBluetoothState(nextState);
      }, true);
    }

    return () => {
      bleStateSubscriptionRef.current?.remove();
      bleStateSubscriptionRef.current = null;
      cleanup();
    };
  }, [cleanup, syncBluetoothState]);

  // Step 1: scan for the CommuteLive device.
  // Firmware advertises as "esp32-XXXX" — device.name IS the deviceId.
  const startScan = useCallback(async () => {
    cleanup();
    setPhase('requesting_permission', {
      errorMsg: null,
      foundDevice: null,
      foundDevices: [],
      deviceId: null,
      statusUpdate: null,
    });

    const mgr = getManager();
    if (!mgr) {
      fail('Bluetooth is not available. Make sure you are running a dev client build, not Expo Go.');
      return;
    }

    const granted = await requestAndroidPermissions();
    if (!granted) {
      fail('Bluetooth permission denied. Please enable it in Settings.');
      return;
    }

    try {
      const bleState = await mgr.state();
      syncBluetoothState(bleState);
      const bluetoothMessage = getBluetoothMessage(bleState);
      if (bluetoothMessage) {
        fail(bluetoothMessage);
        return;
      }
    } catch {
      // Ignore state lookup errors and let scan attempt surface a concrete failure.
    }

    setPhase('scanning', {errorMsg: null});
    const matchedDevices = new Map<string, Device>();
    let scanFinished = false;

    const finishScan = () => {
      if (scanFinished) return;
      scanFinished = true;
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      if (discoveryTimeoutRef.current) {
        clearTimeout(discoveryTimeoutRef.current);
        discoveryTimeoutRef.current = null;
      }
      mgr.stopDeviceScan();

      const foundDevices = Array.from(matchedDevices.values()).sort((a, b) =>
        (a.name ?? a.id).localeCompare(b.name ?? b.id),
      );
      if (foundDevices.length === 0) {
        fail('No CommuteLive device found nearby. Make sure it is powered on.');
        return;
      }

      deviceRef.current = null;
      setPhase('device_found', {
        foundDevices,
        foundDevice: null,
        deviceId: null,
        errorMsg: null,
        statusUpdate: null,
      });
      console.log(
        '[BLE] Found devices =',
        foundDevices.map(device => device.name ?? device.id).join(', '),
      );
    };

    scanTimeoutRef.current = setTimeout(finishScan, SCAN_TIMEOUT_MS);

    mgr.startDeviceScan(null, {allowDuplicates: false}, (error: BleError | null, device: Device | null) => {
      if (error) {
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
          scanTimeoutRef.current = null;
        }
        if (discoveryTimeoutRef.current) {
          clearTimeout(discoveryTimeoutRef.current);
          discoveryTimeoutRef.current = null;
        }
        mgr.stopDeviceScan();
        logger.error('BLE scan error', {error: error.message});
        fail(`Scan error: ${error.message}`);
        return;
      }
      if (device?.name && device.name.startsWith(BLE_NAME_PREFIX)) {
        matchedDevices.set(device.id, device);
        if (!discoveryTimeoutRef.current) {
          discoveryTimeoutRef.current = setTimeout(finishScan, DISCOVERY_SETTLE_MS);
        }
      }
    });
  }, [cleanup, setPhase, fail]);

  const selectFoundDevice = useCallback((device: Device) => {
    deviceRef.current = device;
    setState(prev => ({
      ...prev,
      foundDevice: device,
      deviceId: device.name ?? prev.deviceId,
      statusUpdate: null,
    }));
  }, []);

  // Step 2: connect to the found device.
  const connectToDevice = useCallback(async (nextDevice?: Device) => {
    const device = nextDevice ?? deviceRef.current ?? state.foundDevice;
    if (!device) {
      fail('No device to connect to.');
      return;
    }
    deviceRef.current = device;
    setState(prev => ({
      ...prev,
      foundDevice: device,
      deviceId: device.name ?? prev.deviceId,
      statusUpdate: null,
    }));
    setPhase('connecting', {errorMsg: null});
    try {
      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();
      statusSubscriptionRef.current?.remove();
      statusSubscriptionRef.current = connected.monitorCharacteristicForService(
        BLE_SERVICE_UUID,
        BLE_STATUS_UUID,
        (error, characteristic) => {
          if (error) {
            if (isCancelledBleError(error)) {
              return;
            }
            console.log('[BLE] status monitor error:', error.message);
            return;
          }

          const rawValue = characteristic?.value
            ? Buffer.from(characteristic.value, 'base64').toString('utf8')
            : null;
          const payload = parseBleStatusPayload(rawValue);
          const nextDeviceId = payload.deviceId ?? connected.name ?? null;

          if (rawValue) {
            console.log('[BLE] status update:', rawValue);
          }

          setState(prev => ({
            ...prev,
            statusUpdate: payload,
            deviceId: nextDeviceId ?? prev.deviceId,
          }));

          if (payload.status === 'ready') {
            return;
          }

          if (payload.status === 'connecting') {
            setPhase('waiting_wifi', {
              deviceId: nextDeviceId,
              errorMsg: null,
              statusUpdate: payload,
            });
            return;
          }

          if (payload.status === 'connected') {
            setPhase('connected', {
              deviceId: nextDeviceId,
              errorMsg: null,
              statusUpdate: payload,
            });
            if (pendingWifiResultRef.current) {
              clearTimeout(pendingWifiResultRef.current.timeout);
              pendingWifiResultRef.current.resolve(nextDeviceId);
              pendingWifiResultRef.current = null;
            }
            return;
          }

          if (payload.status === 'failed') {
            logger.error('BLE device WiFi connection failed', {deviceId: nextDeviceId});
            setPhase('connected', {
              deviceId: nextDeviceId,
              errorMsg: getWifiFailureMessage(payload),
              statusUpdate: payload,
            });
            if (pendingWifiResultRef.current) {
              clearTimeout(pendingWifiResultRef.current.timeout);
              pendingWifiResultRef.current.resolve(null);
              pendingWifiResultRef.current = null;
            }
          }
        },
      );
      deviceRef.current = connected;
      setPhase('connected', {errorMsg: null});
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('BLE device connection failed', {deviceId: device.name ?? device.id, error: msg});
      fail(`Connection failed: ${msg}`);
    }
  }, [fail, setPhase, state.foundDevice]);

  // Step 3: write WiFi credentials + pairing token.
  // Returns the deviceId (from device name set during scan) — no characteristic read needed.
  const sendCredentials = useCallback(
    async (ssid: string, password: string, username: string, token: string, serverUrl: string): Promise<string | null> => {
      const device = deviceRef.current;
      if (!device) {
        fail('Device not connected.');
        return null;
      }
      setPhase('provisioning', {errorMsg: null, statusUpdate: null});

      const payload = JSON.stringify({ssid, password, username, token, server_url: serverUrl});
      const encoded = Buffer.from(payload, 'utf8').toString('base64');

      try {
        if (pendingWifiResultRef.current) {
          clearTimeout(pendingWifiResultRef.current.timeout);
          pendingWifiResultRef.current.resolve(null);
          pendingWifiResultRef.current = null;
        }

        const wifiResult = new Promise<string | null>((resolve) => {
          const timeout = setTimeout(() => {
            pendingWifiResultRef.current = null;
            setPhase('connected', {
              errorMsg: 'Timed out waiting for the display to join Wi-Fi. Check the credentials and try again.',
              statusUpdate: null,
            });
            resolve(null);
          }, WIFI_RESULT_TIMEOUT_MS);

          pendingWifiResultRef.current = {resolve, timeout};
        });

        await device.writeCharacteristicWithResponseForService(
          BLE_SERVICE_UUID,
          BLE_PROVISION_UUID,
          encoded,
        );
        setPhase('waiting_wifi', {errorMsg: null, statusUpdate: null});
        const deviceId = await wifiResult;
        console.log('[BLE] Credentials result deviceId =', deviceId);
        return deviceId;
      } catch (e: unknown) {
        if (pendingWifiResultRef.current) {
          clearTimeout(pendingWifiResultRef.current.timeout);
          pendingWifiResultRef.current.resolve(null);
          pendingWifiResultRef.current = null;
        }
        const msg = e instanceof Error ? e.message : String(e);
        logger.error('BLE credential send failed', {error: msg});
        fail(`Failed to send credentials: ${msg}`);
        return null;
      }
    },
    [setPhase, fail],
  );

  // Request WiFi network scan from ESP over BLE.
  const requestWifiScan = useCallback(async () => {
    const device = deviceRef.current;
    if (!device) return;

    setState(prev => ({...prev, isScanning: true, wifiNetworks: []}));
    scanChunksRef.current = [];

    // Subscribe to WIFI_SCAN notifications for results
    wifiScanSubscriptionRef.current?.remove();
    let totalChunks = -1;
    let receivedChunks = 0;

    const scanTimeout = setTimeout(() => {
      wifiScanSubscriptionRef.current?.remove();
      wifiScanSubscriptionRef.current = null;
      finalizeScanResults();
    }, 10_000);

    const finalizeScanResults = () => {
      clearTimeout(scanTimeout);
      // Deduplicate by SSID, keeping strongest signal
      const bySSID = new Map<string, {s: string; r: number; e: number}>();
      for (const net of scanChunksRef.current) {
        const existing = bySSID.get(net.s);
        if (!existing || net.r > existing.r) {
          bySSID.set(net.s, net);
        }
      }
      const networks: WifiNetwork[] = Array.from(bySSID.values())
        .sort((a, b) => b.r - a.r)
        .map(n => ({ssid: n.s, rssi: n.r, encryption: n.e as WifiNetwork['encryption']}));
      setState(prev => ({...prev, wifiNetworks: networks, isScanning: false}));
      console.log('[BLE] WiFi scan complete, networks:', networks.length);
    };

    wifiScanSubscriptionRef.current = device.monitorCharacteristicForService(
      BLE_SERVICE_UUID,
      BLE_WIFI_SCAN_UUID,
      (error, characteristic) => {
        if (error) {
          if (isCancelledBleError(error)) {
            return;
          }
          console.log('[BLE] scan monitor error:', error.message);
          return;
        }
        const raw = characteristic?.value
          ? Buffer.from(characteristic.value, 'base64').toString('utf8')
          : null;
        if (!raw) return;
        try {
          const chunk = JSON.parse(raw) as {c: number; t: number; n: Array<{s: string; r: number; e: number}>};
          if (totalChunks < 0) totalChunks = chunk.t;
          scanChunksRef.current.push(...chunk.n);
          receivedChunks++;
          if (receivedChunks >= totalChunks) {
            wifiScanSubscriptionRef.current?.remove();
            wifiScanSubscriptionRef.current = null;
            finalizeScanResults();
          }
        } catch {
          console.log('[BLE] scan chunk parse error:', raw);
        }
      },
    );

    // Write scan action to PROVISION characteristic
    const payload = JSON.stringify({action: 'scan'});
    const encoded = Buffer.from(payload, 'utf8').toString('base64');
    try {
      await device.writeCharacteristicWithResponseForService(
        BLE_SERVICE_UUID,
        BLE_PROVISION_UUID,
        encoded,
      );
    } catch (e: unknown) {
      console.log('[BLE] scan request write failed:', e instanceof Error ? e.message : String(e));
      setState(prev => ({...prev, isScanning: false}));
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({...prev, errorMsg: null}));
  }, []);

  const reset = useCallback(() => {
    cleanup();
    deviceRef.current = null;
    setState(prev => ({
      phase: 'idle',
      foundDevice: null,
      foundDevices: [],
      deviceId: null,
      errorMsg: null,
      bluetoothState: prev.bluetoothState,
      bluetoothMessage: prev.bluetoothMessage,
      wifiNetworks: [],
      isScanning: false,
      statusUpdate: null,
    }));
  }, [cleanup]);

  return {state, startScan, selectFoundDevice, connectToDevice, sendCredentials, requestWifiScan, clearError, reset};
}
