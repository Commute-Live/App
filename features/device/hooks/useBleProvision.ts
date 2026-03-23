import {useCallback, useEffect, useRef, useState} from 'react';
import {BleManager, Device, BleError} from 'react-native-ble-plx';
import {Platform, PermissionsAndroid} from 'react-native';
import {Buffer} from 'buffer';

// CommuteLive custom GATT UUIDs — must match firmware ble_provisioner.cpp
export const BLE_SERVICE_UUID   = 'a1b2c3d4-0000-4a5b-8c7d-9e0f1a2b3c4d';
export const BLE_PROVISION_UUID = 'a1b2c3d4-0001-4a5b-8c7d-9e0f1a2b3c4d';

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
  | 'done'
  | 'error';

export interface BleProvisionState {
  phase: BleProvisionPhase;
  foundDevice: Device | null;
  deviceId: string | null;   // esp32-XXXX — set from BLE device name during scan
  errorMsg: string | null;
}

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
  });

  const deviceRef      = useRef<Device | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setPhase('connected');
    } catch (e: unknown) {
      fail(`Connection failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [setPhase, fail]);

  // Step 3: write WiFi credentials.
  // Returns the deviceId (from device name set during scan) — no characteristic read needed.
  const sendCredentials = useCallback(
    async (ssid: string, password: string, username: string): Promise<string | null> => {
      const device = deviceRef.current;
      if (!device) {
        fail('Device not connected.');
        return null;
      }
      setPhase('provisioning');

      const payload = JSON.stringify({ssid, password, username});
      const encoded = Buffer.from(payload, 'utf8').toString('base64');

      try {
        try {
          // Let the ESP drop BLE immediately after it stores credentials.
          await device.writeCharacteristicWithoutResponseForService(
            BLE_SERVICE_UUID,
            BLE_PROVISION_UUID,
            encoded,
          );
        } catch (error: unknown) {
          const stillConnected = await device.isConnected().catch(() => false);

          if (stillConnected) {
            await device.writeCharacteristicWithResponseForService(
              BLE_SERVICE_UUID,
              BLE_PROVISION_UUID,
              encoded,
            );
          } else {
            console.log('[BLE] Device disconnected after credentials handoff; continuing with network verification');
          }
        }

        setPhase('done');
        // device.name is the deviceId (e.g. "esp32-B44AC2F16E20")
        const deviceId = device.name ?? null;
        console.log('[BLE] Credentials handed off, deviceId =', deviceId);
        return deviceId;
      } catch (e: unknown) {
        fail(`Failed to send credentials: ${e instanceof Error ? e.message : String(e)}`);
        return null;
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
