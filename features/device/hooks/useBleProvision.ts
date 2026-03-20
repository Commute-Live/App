import {useCallback, useEffect, useRef, useState} from 'react';
import {BleManager, Device, BleError, Characteristic} from 'react-native-ble-plx';
import {Platform, PermissionsAndroid} from 'react-native';
import {Buffer} from 'buffer';

// CommuteLive custom GATT UUIDs — must match firmware ble_provisioner.cpp
export const BLE_SERVICE_UUID   = 'a1b2c3d4-0000-4a5b-8c7d-9e0f1a2b3c4d';
export const BLE_PROVISION_UUID = 'a1b2c3d4-0001-4a5b-8c7d-9e0f1a2b3c4d';
export const BLE_STATUS_UUID    = 'a1b2c3d4-0002-4a5b-8c7d-9e0f1a2b3c4d';

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

export interface BleProvisionState {
  phase: BleProvisionPhase;
  foundDevice: Device | null;
  deviceId: string | null;     // ESP32 device ID returned in STATUS notify
  errorMsg: string | null;
}

// Singleton BleManager — created once per app session, never recreated.
// Returns null when the native BLE module is unavailable (e.g. Expo Go).
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
  });

  const deviceRef      = useRef<Device | null>(null);
  const subscriptionRef = useRef<{remove(): void} | null>(null);
  const scanTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPhase = useCallback((phase: BleProvisionPhase, extra?: Partial<BleProvisionState>) => {
    setState(prev => ({...prev, phase, ...extra}));
  }, []);

  const fail = useCallback((msg: string) => {
    setPhase('error', {errorMsg: msg});
  }, [setPhase]);

  // Clean up BLE resources.
  const cleanup = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      clearInterval(scanTimeoutRef.current as unknown as ReturnType<typeof setInterval>);
      scanTimeoutRef.current = null;
    }
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
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
  const startScan = useCallback(async () => {
    setPhase('requesting_permission');

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

    setPhase('scanning');

    // Timeout after 20s if nothing found.
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
      if (device && device.name && device.name.startsWith('CommuteLive-')) {
        clearTimeout(scanTimeoutRef.current!);
        mgr.stopDeviceScan();
        deviceRef.current = device;
        setPhase('device_found', {foundDevice: device});
      }
    });
  }, [setPhase, fail]);

  // Step 2: connect to the found device.
  const connectToDevice = useCallback(async () => {
    const device = deviceRef.current;
    if (!device) {
      fail('No device to connect to.');
      return;
    }
    setPhase('connecting');
    try {
      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();
      deviceRef.current = connected;

      // Read deviceId from STATUS characteristic immediately on connect.
      // This lets us complete registration even if BLE drops during WiFi connect.
      try {
        const statusChar = await connected.readCharacteristicForService(
          BLE_SERVICE_UUID,
          BLE_STATUS_UUID,
        );
        if (statusChar?.value) {
          const raw = Buffer.from(statusChar.value, 'base64').toString('utf8');
          const json: {status?: string; deviceId?: string} = JSON.parse(raw);
          if (json.deviceId) {
            setState(prev => ({...prev, deviceId: json.deviceId ?? null}));
          }
        }
      } catch {
        // Non-fatal — we'll still get deviceId from the notify later.
      }

      setPhase('connected');
    } catch (e: unknown) {
      fail(`Connection failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [setPhase, fail]);

  // Step 3: write WiFi credentials and wait for STATUS notify.
  const sendCredentials = useCallback(
    async (ssid: string, password: string, username: string) => {
      const device = deviceRef.current;
      if (!device) {
        fail('Device not connected.');
        return;
      }
      setPhase('provisioning');

      const payload = JSON.stringify({ssid, password, username});
      const encoded = Buffer.from(payload, 'utf8').toString('base64');

      try {
        await device.writeCharacteristicWithResponseForService(
          BLE_SERVICE_UUID,
          BLE_PROVISION_UUID,
          encoded,
        );
        // Credentials written — registration is handled by the screen immediately after.
        setPhase('done');
      } catch (e: unknown) {
        fail(`Failed to send credentials: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [setPhase, fail],
  );

  const reset = useCallback(() => {
    cleanup();
    deviceRef.current = null;
    setState({phase: 'idle', foundDevice: null, deviceId: null, errorMsg: null});
  }, [cleanup]);

  return {state, startScan, connectToDevice, sendCredentials, reset};
}
