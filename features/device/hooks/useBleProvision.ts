import {useCallback, useEffect, useRef, useState} from 'react';
import {BleManager, Device, BleError} from 'react-native-ble-plx';
import {Platform, PermissionsAndroid} from 'react-native';
import {Buffer} from 'buffer';

// CommuteLive custom GATT UUIDs — must match firmware ble_provisioner.cpp
export const BLE_SERVICE_UUID    = 'a1b2c3d4-0000-4a5b-8c7d-9e0f1a2b3c4d';
export const BLE_PROVISION_UUID  = 'a1b2c3d4-0001-4a5b-8c7d-9e0f1a2b3c4d';
export const BLE_STATUS_UUID     = 'a1b2c3d4-0002-4a5b-8c7d-9e0f1a2b3c4d';
export const BLE_WIFI_SCAN_UUID  = 'a1b2c3d4-0003-4a5b-8c7d-9e0f1a2b3c4d';

// The firmware advertises as "esp32-XXXX" (same as its MQTT deviceId).
// Also accept "CommuteLive-" for backwards compatibility with older firmware.
const BLE_NAME_PREFIXES = ['esp32-', 'CommuteLive-'];

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
  deviceId: string | null;   // esp32-XXXX — set from BLE device name during scan
  errorMsg: string | null;
  wifiNetworks: WifiNetwork[];
  isScanning: boolean;
}

type BleStatusPayload = {
  status: string | null;
  deviceId: string | null;
};

type PendingWifiResult = {
  resolve: (deviceId: string | null) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const WIFI_RESULT_TIMEOUT_MS = 45_000;

const parseBleStatusPayload = (value: string | null | undefined): BleStatusPayload => {
  if (!value) {
    return {status: null, deviceId: null};
  }

  try {
    const data = JSON.parse(value) as {status?: unknown; deviceId?: unknown};
    return {
      status: typeof data.status === 'string' ? data.status : null,
      deviceId: typeof data.deviceId === 'string' ? data.deviceId : null,
    };
  } catch {
    return {status: null, deviceId: null};
  }
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
    deviceId: null,
    errorMsg: null,
    wifiNetworks: [],
    isScanning: false,
  });

  const deviceRef      = useRef<Device | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusSubscriptionRef = useRef<{remove: () => void} | null>(null);
  const wifiScanSubscriptionRef = useRef<{remove: () => void} | null>(null);
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

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Step 1: scan for the CommuteLive device.
  // Firmware advertises as "esp32-XXXX" — device.name IS the deviceId.
  const startScan = useCallback(async () => {
    cleanup();
    setPhase('requesting_permission', {errorMsg: null, foundDevice: null, deviceId: null});

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

    setPhase('scanning', {errorMsg: null});

    scanTimeoutRef.current = setTimeout(() => {
      mgr.stopDeviceScan();
      fail('No CommuteLive device found nearby. Make sure it is powered on.');
    }, 20000);

    mgr.startDeviceScan(null, {allowDuplicates: false}, (error: BleError | null, device: Device | null) => {
      if (error) {
        clearTimeout(scanTimeoutRef.current!);
        fail(`Scan error: ${error.message}`);
        return;
      }
      if (device?.name && BLE_NAME_PREFIXES.some(p => device.name!.startsWith(p))) {
        clearTimeout(scanTimeoutRef.current!);
        mgr.stopDeviceScan();
        deviceRef.current = device;
        // device.name === "esp32-XXXX" which is also the MQTT deviceId
        setPhase('device_found', {foundDevice: device, deviceId: device.name});
        console.log('[BLE] Found device, deviceId =', device.name);
      }
    });
  }, [cleanup, setPhase, fail]);

  // Step 2: connect to the found device.
  const connectToDevice = useCallback(async () => {
    const device = deviceRef.current;
    if (!device) {
      fail('No device to connect to.');
      return;
    }
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

          if (payload.status === 'ready') {
            setState(prev => ({...prev, deviceId: nextDeviceId ?? prev.deviceId}));
            return;
          }

          if (payload.status === 'connecting') {
            setPhase('waiting_wifi', {deviceId: nextDeviceId, errorMsg: null});
            return;
          }

          if (payload.status === 'connected') {
            setPhase('connected', {deviceId: nextDeviceId, errorMsg: null});
            if (pendingWifiResultRef.current) {
              clearTimeout(pendingWifiResultRef.current.timeout);
              pendingWifiResultRef.current.resolve(nextDeviceId);
              pendingWifiResultRef.current = null;
            }
            return;
          }

          if (payload.status === 'failed') {
            setPhase('connected', {
              deviceId: nextDeviceId,
              errorMsg: 'Display could not connect to Wi-Fi. Check the SSID, username, and password, then try again.',
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
      fail(`Connection failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [setPhase, fail]);

  // Step 3: write WiFi credentials + pairing token.
  // Returns the deviceId (from device name set during scan) — no characteristic read needed.
  const sendCredentials = useCallback(
    async (ssid: string, password: string, username: string, token: string, serverUrl: string): Promise<string | null> => {
      const device = deviceRef.current;
      if (!device) {
        fail('Device not connected.');
        return null;
      }
      setPhase('provisioning', {errorMsg: null});

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
        setPhase('waiting_wifi', {errorMsg: null});
        const deviceId = await wifiResult;
        console.log('[BLE] Credentials result deviceId =', deviceId);
        return deviceId;
      } catch (e: unknown) {
        if (pendingWifiResultRef.current) {
          clearTimeout(pendingWifiResultRef.current.timeout);
          pendingWifiResultRef.current.resolve(null);
          pendingWifiResultRef.current = null;
        }
        fail(`Failed to send credentials: ${e instanceof Error ? e.message : String(e)}`);
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

  const reset = useCallback(() => {
    cleanup();
    deviceRef.current = null;
    setState({phase: 'idle', foundDevice: null, deviceId: null, errorMsg: null, wifiNetworks: [], isScanning: false});
  }, [cleanup]);

  return {state, startScan, connectToDevice, sendCredentials, requestWifiScan, reset};
}
