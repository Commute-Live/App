import {useCallback, useEffect, useRef, useState} from 'react';
import {BleManager, Device, BleError} from 'react-native-ble-plx';
import {Platform, PermissionsAndroid} from 'react-native';
import {Buffer} from 'buffer';
import {logger} from '../../../lib/logger';

// CommuteLive custom GATT UUIDs — must match firmware ble_provisioner.cpp
export const BLE_SERVICE_UUID    = 'a1b2c3d4-0000-4a5b-8c7d-9e0f1a2b3c4d';
export const BLE_PROVISION_UUID  = 'a1b2c3d4-0001-4a5b-8c7d-9e0f1a2b3c4d';
export const BLE_STATUS_UUID     = 'a1b2c3d4-0002-4a5b-8c7d-9e0f1a2b3c4d';
export const BLE_WIFI_SCAN_UUID  = 'a1b2c3d4-0003-4a5b-8c7d-9e0f1a2b3c4d';
export const BLE_PAIRING_CODE_UUID = 'a1b2c3d4-0004-4a5b-8c7d-9e0f1a2b3c4d';

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
  | 'reconnecting'
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
  pairingCode: string | null;
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
  message: string | null;
  pairingCode: string | null;
  wifiStatus: string | null;
  attempt: number | null;
  attempts: number | null;
  raw: string | null;
};

type PendingWifiResult = {
  resolve: (deviceId: string | null) => void;
  timeout: ReturnType<typeof setTimeout> | null;
};

type PendingCredentials = {
  ssid: string;
  password: string;
  username: string;
  token: string;
  serverUrl: string;
  pairingCode: string;
};

const WIFI_RESULT_TIMEOUT_MS = 135_000;
const SCAN_TIMEOUT_MS = 20_000;
const DISCOVERY_SETTLE_MS = 2_500;
const RECOVERY_SCAN_INTERVAL_MS = 10_000;
const RECOVERY_SCAN_SLICE_MS = 7_000;
const RECOVERY_WINDOW_MS = 360_000;
const EXPECTED_SUCCESS_DISCONNECT_MS = 2_000;
const WIFI_SCAN_DEBOUNCE_MS = 3_000;

const PHASE_EVENT_NAMES: Partial<Record<BleProvisionPhase, string>> = {
  scanning: 'ble.scan_started',
  device_found: 'ble.device_found',
  connected: 'ble.connected',
};

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
      message: null,
      pairingCode: null,
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
      message?: unknown;
      pairingCode?: unknown;
      wifiStatus?: unknown;
      attempt?: unknown;
      attempts?: unknown;
    };
    return {
      status: typeof data.status === 'string' ? data.status : null,
      phase: typeof data.phase === 'string' ? data.phase : null,
      deviceId: typeof data.deviceId === 'string' ? data.deviceId : null,
      reason: typeof data.reason === 'string' ? data.reason : null,
      message: typeof data.message === 'string' ? data.message : null,
      pairingCode: typeof data.pairingCode === 'string' ? data.pairingCode : null,
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
      message: null,
      pairingCode: null,
      wifiStatus: null,
      attempt: null,
      attempts: null,
      raw: value,
    };
  }
};

const getWifiFailureMessage = (payload: BleStatusPayload): string => {
  if (payload.message) return payload.message;
  switch (payload.reason) {
    case 'auth_error':
      return 'The display could not join Wi-Fi. Check the password and try again.';
    case 'provision_error':
      return 'The display joined Wi-Fi but could not finish setup. Try again.';
    case 'DEVICE_ALREADY_LINKED':
      return 'This display is already linked to another account. Contact support to unlink it before setting it up here.';
    case 'rate_limited':
      return 'Too many setup attempts. Wait a minute and try again.';
    case 'connection_lost':
      return 'Wi-Fi signal is too weak. Move the display closer to your router and try again.';
    case 'disconnected':
      return 'Wi-Fi dropped during setup. Please try again.';
    case 'ble_disconnected':
      return 'Phone disconnected during setup. Please try again.';
    case 'pairing_code_required':
    case 'PAIRING_CODE_REQUIRED':
      return 'Enter the 4-digit code shown on your display before sending Wi-Fi credentials.';
    case 'pairing_code_mismatch':
    case 'PAIRING_CODE_MISMATCH':
      return 'The pairing code did not match. Check the display and try again.';
    case 'timeout':
      return 'Taking longer than expected. Keep the display powered on, then try setup again from your phone.';
    default:
      if (payload.reason) {
        logger.warn('Unknown BLE WiFi failure reason', {
          reason: payload.reason,
          phase: payload.phase,
          wifiStatus: payload.wifiStatus,
        });
      }
      return 'Display could not connect to Wi-Fi. Check your network name, username, and password, then try again.';
  }
};

const isRecoverableWifiFailure = (payload: BleStatusPayload): boolean => {
  // Explicit allowlist: only reasons we know are transient are retried.
  // Unknown reasons fail fast so a future firmware addition doesn't trap the user in "still working on it…".
  switch (payload.reason) {
    case 'connection_lost':
      return true;
    default:
      return false;
  }
};

const isCancelledBleError = (error: BleError | null | undefined) => {
  if (!error) return false;
  return error.message.trim().toLowerCase() === 'operation was cancelled';
};

const decodeBleString = (value: string | null | undefined): string | null => {
  if (!value) return null;
  return Buffer.from(value, 'base64').toString('utf8').trim();
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

export function useBleProvision(options: {targetDeviceId?: string | null} = {}) {
  const targetDeviceId = options.targetDeviceId ?? null;
  const [state, setState] = useState<BleProvisionState>({
    phase: 'idle',
    foundDevice: null,
    foundDevices: [],
    deviceId: null,
    pairingCode: null,
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
  const terminalProvisionStatusRef = useRef(false);
  const expectedSuccessDisconnectUntilRef = useRef(0);
  const phaseRef = useRef<BleProvisionPhase>('idle');
  const deviceIdRef = useRef<string | null>(targetDeviceId);
  const pairingCodeRef = useRef<string | null>(null);
  const credsSentAtRef = useRef<number | null>(null);
  const pendingCredentialsRef = useRef<PendingCredentials | null>(null);
  const recoveryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recoveryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoveryScanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoveryActiveRef = useRef(false);
  const recoveryScanningRef = useRef(false);
  const handleProvisionStallRef = useRef<(message: string, payload?: BleStatusPayload | null) => void>(() => {});
  const connectRecoveredDeviceRef = useRef<(device: Device) => Promise<void>>(async () => {});
  const scanChunksRef = useRef<Array<{s: string; r: number; e: number}>>([]);
  const lastWifiScanAtRef = useRef(0);

  const trackBleEvent = useCallback((event: string, context?: Record<string, unknown>) => {
    logger.info(event, context ?? {});
  }, []);

  const trackProvisionTerminal = useCallback((event: string, context?: Record<string, unknown>) => {
    const durationMs = credsSentAtRef.current === null ? null : Date.now() - credsSentAtRef.current;
    trackBleEvent(event, {...context, durationMs});
  }, [trackBleEvent]);

  const setPhase = useCallback((phase: BleProvisionPhase, extra?: Partial<BleProvisionState>) => {
    const previousPhase = phaseRef.current;
    if (previousPhase !== phase) {
      phaseRef.current = phase;
      const eventName = PHASE_EVENT_NAMES[phase];
      if (eventName) {
        trackBleEvent(eventName, {
          previousPhase,
          deviceId: extra?.deviceId ?? deviceIdRef.current,
        });
      }
    }
    setState(prev => ({...prev, phase, ...extra}));
  }, [trackBleEvent]);

  const fail = useCallback((msg: string) => {
    setPhase('error', {errorMsg: msg});
  }, [setPhase]);

  useEffect(() => {
    phaseRef.current = state.phase;
    deviceIdRef.current = state.deviceId ?? targetDeviceId;
    pairingCodeRef.current = state.pairingCode;
  }, [state.phase, state.deviceId, state.pairingCode, targetDeviceId]);

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
      if (pendingWifiResultRef.current.timeout) {
        clearTimeout(pendingWifiResultRef.current.timeout);
      }
      pendingWifiResultRef.current.resolve(null);
      pendingWifiResultRef.current = null;
    }
    if (recoveryIntervalRef.current) {
      clearInterval(recoveryIntervalRef.current);
      recoveryIntervalRef.current = null;
    }
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = null;
    }
    if (recoveryScanTimeoutRef.current) {
      clearTimeout(recoveryScanTimeoutRef.current);
      recoveryScanTimeoutRef.current = null;
    }
    recoveryActiveRef.current = false;
    recoveryScanningRef.current = false;
    expectedSuccessDisconnectUntilRef.current = 0;
    credsSentAtRef.current = null;
    pendingCredentialsRef.current = null;
    terminalProvisionStatusRef.current = false;
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

  const stopRecovery = useCallback(() => {
    if (recoveryIntervalRef.current) {
      clearInterval(recoveryIntervalRef.current);
      recoveryIntervalRef.current = null;
    }
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = null;
    }
    if (recoveryScanTimeoutRef.current) {
      clearTimeout(recoveryScanTimeoutRef.current);
      recoveryScanTimeoutRef.current = null;
    }
    if (recoveryScanningRef.current) {
      getManager()?.stopDeviceScan();
    }
    recoveryActiveRef.current = false;
    recoveryScanningRef.current = false;
  }, []);

  const resolvePendingWifiResult = useCallback((deviceId: string | null) => {
    if (!pendingWifiResultRef.current) {
      return;
    }
    if (pendingWifiResultRef.current.timeout) {
      clearTimeout(pendingWifiResultRef.current.timeout);
    }
    pendingWifiResultRef.current.resolve(deviceId);
    pendingWifiResultRef.current = null;
  }, []);

  const hardFailProvision = useCallback((message: string, payload?: BleStatusPayload | null) => {
    stopRecovery();
    // Terminal app-side failures should ignore late BLE status notifications from
    // a previous attempt or a recovered advertising session.
    terminalProvisionStatusRef.current = true;
    setPhase('connected', {
      errorMsg: message,
      statusUpdate: payload ?? null,
      deviceId: payload?.deviceId ?? deviceIdRef.current,
    });
    trackProvisionTerminal('ble.failed', {
      deviceId: payload?.deviceId ?? deviceIdRef.current,
      reason: payload?.reason ?? 'app_error',
      phase: payload?.phase ?? phaseRef.current,
      wifiStatus: payload?.wifiStatus ?? null,
    });
    resolvePendingWifiResult(null);
  }, [resolvePendingWifiResult, setPhase, stopRecovery, trackProvisionTerminal]);

  const startProvisionRecovery = useCallback((message: string, payload?: BleStatusPayload | null) => {
    const pending = pendingWifiResultRef.current;
    if (!pending) {
      hardFailProvision(message, payload);
      return;
    }
    if (pending.timeout) {
      clearTimeout(pending.timeout);
      pending.timeout = null;
    }

    const targetId = payload?.deviceId ?? deviceIdRef.current ?? targetDeviceId;
    if (!targetId) {
      hardFailProvision(message, payload);
      return;
    }

    if (recoveryActiveRef.current) {
      return;
    }

    recoveryActiveRef.current = true;
    setPhase('reconnecting', {
      errorMsg: null,
      statusUpdate: payload ?? null,
      deviceId: targetId,
    });
    trackBleEvent('ble.reconnect_started', {
      deviceId: targetId,
      reason: payload?.reason ?? 'status_timeout',
      phase: payload?.phase ?? phaseRef.current,
    });

    const runScan = () => {
      if (!recoveryActiveRef.current || recoveryScanningRef.current) {
        return;
      }

      const mgr = getManager();
      if (!mgr) {
        hardFailProvision('Bluetooth is not available. Try setup again from your phone.', payload);
        return;
      }

      recoveryScanningRef.current = true;
      mgr.stopDeviceScan();
      recoveryScanTimeoutRef.current = setTimeout(() => {
        recoveryScanningRef.current = false;
        mgr.stopDeviceScan();
      }, RECOVERY_SCAN_SLICE_MS);

      mgr.startDeviceScan(null, {allowDuplicates: false}, (error: BleError | null, device: Device | null) => {
        if (!recoveryActiveRef.current) {
          mgr.stopDeviceScan();
          recoveryScanningRef.current = false;
          return;
        }
        if (error) {
          logger.warn('BLE recovery scan error', {error: error.message, deviceId: targetId});
          return;
        }
        if (!device?.name || device.name !== targetId) {
          return;
        }

        if (recoveryScanTimeoutRef.current) {
          clearTimeout(recoveryScanTimeoutRef.current);
          recoveryScanTimeoutRef.current = null;
        }
        mgr.stopDeviceScan();
        recoveryScanningRef.current = false;
        trackBleEvent('ble.reconnected', {deviceId: targetId});
        void connectRecoveredDeviceRef.current(device);
      });
    };

    recoveryTimeoutRef.current = setTimeout(() => {
      hardFailProvision('The display did not come back online. Keep it powered on, then try setup again.', payload);
    }, RECOVERY_WINDOW_MS);
    runScan();
    recoveryIntervalRef.current = setInterval(runScan, RECOVERY_SCAN_INTERVAL_MS);
  }, [hardFailProvision, setPhase, targetDeviceId, trackBleEvent]);

  useEffect(() => {
    handleProvisionStallRef.current = startProvisionRecovery;
  }, [startProvisionRecovery]);

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
    trackBleEvent('ble.setup_started', {targetDeviceId});
    setPhase('requesting_permission', {
      errorMsg: null,
      foundDevice: null,
      foundDevices: [],
      deviceId: targetDeviceId,
      pairingCode: null,
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
      const visibleDevices = targetDeviceId
        ? foundDevices.filter(device => device.name === targetDeviceId)
        : foundDevices;
      if (visibleDevices.length === 0) {
        fail(
          targetDeviceId
            ? `Display ${targetDeviceId} was not found nearby. Keep it powered on and try again.`
            : 'No CommuteLive device found nearby. Make sure it is powered on.',
        );
        return;
      }

      deviceRef.current = null;
      setPhase('device_found', {
        foundDevices: visibleDevices,
        foundDevice: null,
        deviceId: targetDeviceId,
        pairingCode: null,
        errorMsg: null,
        statusUpdate: null,
      });
      logger.info('BLE devices found', {
        devices: visibleDevices.map(device => device.name ?? device.id),
        targetDeviceId,
      });
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
  }, [cleanup, setPhase, fail, syncBluetoothState, targetDeviceId, trackBleEvent]);

  const selectFoundDevice = useCallback((device: Device) => {
    deviceRef.current = device;
    setState(prev => ({
      ...prev,
      foundDevice: device,
      deviceId: device.name ?? prev.deviceId,
      pairingCode: null,
      statusUpdate: null,
    }));
  }, []);

  // Step 2: connect to the found device.
  const connectToDevice = useCallback(async (nextDevice?: Device) => {
    const device = nextDevice ?? deviceRef.current ?? state.foundDevice;
    if (!device) {
      fail('No device to connect to.');
      return false;
    }
    deviceRef.current = device;
    setState(prev => ({
      ...prev,
      foundDevice: device,
      deviceId: device.name ?? prev.deviceId,
      pairingCode: null,
      statusUpdate: null,
    }));
    setPhase('connecting', {errorMsg: null});
    let connectStage = 'connect';
    try {
      logger.info('BLE connect starting', {deviceId: device.name ?? device.id});
      const connected = await device.connect();
      connectStage = 'discover';
      logger.info('BLE discover starting', {deviceId: device.name ?? device.id});
      await connected.discoverAllServicesAndCharacteristics();
      connectStage = 'read_pairing_code';
      logger.info('BLE pairing code read starting', {deviceId: device.name ?? device.id});
      const pairingCodeCharacteristic = await connected.readCharacteristicForService(
        BLE_SERVICE_UUID,
        BLE_PAIRING_CODE_UUID,
      );
      const pairingCode = decodeBleString(pairingCodeCharacteristic.value);
      if (!pairingCode || !/^\d{4}$/.test(pairingCode)) {
        fail('Could not verify the display pairing code. Restart setup and try again.');
        return false;
      }
      pairingCodeRef.current = pairingCode;
      trackBleEvent('ble.pairing_code_read', {
        deviceId: device.name ?? device.id,
      });
      statusSubscriptionRef.current?.remove();
      statusSubscriptionRef.current = connected.monitorCharacteristicForService(
        BLE_SERVICE_UUID,
        BLE_STATUS_UUID,
        (error, characteristic) => {
          if (error) {
            if (isCancelledBleError(error)) {
              return;
            }
            if (
              terminalProvisionStatusRef.current &&
              Date.now() < expectedSuccessDisconnectUntilRef.current
            ) {
              logger.debug('BLE status monitor ended after successful provisioning', {error: error.message});
              return;
            }
            if (phaseRef.current === 'waiting_wifi' || phaseRef.current === 'provisioning') {
              logger.warn('BLE status monitor interrupted during provisioning', {error: error.message});
              handleProvisionStallRef.current(
                'Still working on it. Keep the app open while the display reconnects.',
                null,
              );
              return;
            }
            logger.warn('BLE status monitor error', {error: error.message});
            return;
          }

          const rawValue = characteristic?.value
            ? Buffer.from(characteristic.value, 'base64').toString('utf8')
            : null;
          const payload = parseBleStatusPayload(rawValue);
          const nextDeviceId = payload.deviceId ?? connected.name ?? null;

          if (rawValue) {
            logger.debug('BLE status update', {rawValue});
          }

          setState(prev => ({
            ...prev,
            statusUpdate: payload,
            deviceId: nextDeviceId ?? prev.deviceId,
            pairingCode: payload.pairingCode ?? pairingCode,
          }));

          if (payload.status === 'ready') {
            return;
          }

          if (terminalProvisionStatusRef.current) {
            logger.debug('BLE late status update ignored', {rawValue});
            return;
          }

          if (payload.status === 'connecting') {
            if (payload.phase === 'wifi_connecting') {
              trackBleEvent('ble.wifi_connecting', {
                deviceId: nextDeviceId,
                wifiStatus: payload.wifiStatus,
                attempt: payload.attempt,
                attempts: payload.attempts,
              });
            }
            if (payload.phase === 'wifi_connected') {
              trackBleEvent('ble.wifi_connected', {
                deviceId: nextDeviceId,
                wifiStatus: payload.wifiStatus,
              });
            }
            setPhase('waiting_wifi', {
              deviceId: nextDeviceId,
              errorMsg: null,
              statusUpdate: payload,
            });
            return;
          }

          if (payload.status === 'connected') {
            terminalProvisionStatusRef.current = true;
            // Firmware drops BLE shortly after success; disconnects in this window are expected.
            expectedSuccessDisconnectUntilRef.current = Date.now() + EXPECTED_SUCCESS_DISCONNECT_MS;
            stopRecovery();
            trackProvisionTerminal('ble.provisioned', {
              deviceId: nextDeviceId,
              phase: payload.phase,
              wifiStatus: payload.wifiStatus,
            });
            setPhase('connected', {
              deviceId: nextDeviceId,
              errorMsg: null,
              statusUpdate: payload,
            });
            resolvePendingWifiResult(nextDeviceId);
            return;
          }

          if (payload.status === 'failed') {
            logger.error('BLE device WiFi connection failed', {deviceId: nextDeviceId});
            if (isRecoverableWifiFailure(payload)) {
              handleProvisionStallRef.current(
                'Still working on it. Keep the app open while the display reconnects.',
                payload,
              );
              return;
            }
            hardFailProvision(getWifiFailureMessage(payload), payload);
          }
        },
      );
      deviceRef.current = connected;
      setPhase('connected', {errorMsg: null, pairingCode});
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('BLE device connection failed', {deviceId: device.name ?? device.id, stage: connectStage, error: msg});
      if (phaseRef.current === 'waiting_wifi' || recoveryActiveRef.current) {
        handleProvisionStallRef.current(
          'Still working on it. Keep the app open while the display reconnects.',
          null,
        );
        return false;
      }
      fail(`Connection failed: ${msg}`);
      return false;
    }
  }, [fail, hardFailProvision, resolvePendingWifiResult, setPhase, state.foundDevice, stopRecovery, trackBleEvent, trackProvisionTerminal]);

  // Step 3: write WiFi credentials + pairing token.
  // Returns the deviceId (from device name set during scan) — no characteristic read needed.
  const sendCredentials = useCallback(
    async (ssid: string, password: string, username: string, token: string, serverUrl: string): Promise<string | null> => {
      const device = deviceRef.current;
      if (!device) {
        fail('Device not connected.');
        return null;
      }
      const pairingCode = pairingCodeRef.current;
      if (!pairingCode) {
        fail('Enter the 4-digit code shown on your display before sending Wi-Fi credentials.');
        return null;
      }
      setPhase('provisioning', {errorMsg: null, statusUpdate: null});
      terminalProvisionStatusRef.current = false;
      expectedSuccessDisconnectUntilRef.current = 0;
      pendingCredentialsRef.current = {ssid, password, username, token, serverUrl, pairingCode};
      credsSentAtRef.current = null;

      const payload = JSON.stringify({ssid, password, username, token, server_url: serverUrl, pairing_code: pairingCode});
      const encoded = Buffer.from(payload, 'utf8').toString('base64');

      try {
        if (pendingWifiResultRef.current) {
          if (pendingWifiResultRef.current.timeout) {
            clearTimeout(pendingWifiResultRef.current.timeout);
          }
          pendingWifiResultRef.current.resolve(null);
          pendingWifiResultRef.current = null;
        }

        const wifiResult = new Promise<string | null>((resolve) => {
          const timeout = setTimeout(() => {
            if (pendingWifiResultRef.current) {
              pendingWifiResultRef.current.timeout = null;
            }
            handleProvisionStallRef.current(
              'Still working on it. Keep the app open while the display reconnects.',
              null,
            );
          }, WIFI_RESULT_TIMEOUT_MS);

          pendingWifiResultRef.current = {resolve, timeout};
        });

        await device.writeCharacteristicWithResponseForService(
          BLE_SERVICE_UUID,
          BLE_PROVISION_UUID,
          encoded,
        );
        credsSentAtRef.current = Date.now();
        trackBleEvent('ble.creds_sent', {deviceId: deviceIdRef.current ?? device.name ?? device.id});
        setPhase('waiting_wifi', {errorMsg: null, statusUpdate: null});
        const deviceId = await wifiResult;
        logger.info('BLE credentials completed', {deviceId});
        return deviceId;
      } catch (e: unknown) {
        if (pendingWifiResultRef.current) {
          if (pendingWifiResultRef.current.timeout) {
            clearTimeout(pendingWifiResultRef.current.timeout);
          }
          pendingWifiResultRef.current.resolve(null);
          pendingWifiResultRef.current = null;
        }
        const msg = e instanceof Error ? e.message : String(e);
        logger.error('BLE credential send failed', {error: msg});
        fail(`Failed to send credentials: ${msg}`);
        return null;
      }
    },
    [setPhase, fail, trackBleEvent],
  );

  const resendCredentialsAfterRecovery = useCallback(async () => {
    const creds = pendingCredentialsRef.current;
    const device = deviceRef.current;
    if (!creds || !device || !pendingWifiResultRef.current) {
      return;
    }

    const payload = JSON.stringify({
      ssid: creds.ssid,
      password: creds.password,
      username: creds.username,
      token: creds.token,
      server_url: creds.serverUrl,
      pairing_code: creds.pairingCode,
    });
    const encoded = Buffer.from(payload, 'utf8').toString('base64');

    try {
      // Firmware treats this as a fresh provisioning write once its prior attempt
      // has failed or timed out; if it is still busy, the write remains pending.
      await device.writeCharacteristicWithResponseForService(
        BLE_SERVICE_UUID,
        BLE_PROVISION_UUID,
        encoded,
      );
      trackBleEvent('ble.creds_sent', {
        deviceId: deviceIdRef.current ?? device.name ?? device.id,
        recovery: true,
      });
      setPhase('waiting_wifi', {errorMsg: null});
    } catch (e: unknown) {
      logger.warn('BLE credential resend failed during recovery', {
        error: e instanceof Error ? e.message : String(e),
        deviceId: deviceIdRef.current,
      });
    }
  }, [setPhase, trackBleEvent]);

  useEffect(() => {
    connectRecoveredDeviceRef.current = async (device: Device) => {
      const connected = await connectToDevice(device);
      if (connected) {
        stopRecovery();
        await resendCredentialsAfterRecovery();
      }
    };
  }, [connectToDevice, resendCredentialsAfterRecovery, stopRecovery]);

  // Request WiFi network scan from ESP over BLE.
  const requestWifiScan = useCallback(async () => {
    const device = deviceRef.current;
    if (!device) return;

    const now = Date.now();
    if (now - lastWifiScanAtRef.current < WIFI_SCAN_DEBOUNCE_MS) {
      logger.debug('BLE WiFi scan debounced', {
        msSinceLast: now - lastWifiScanAtRef.current,
      });
      return;
    }
    lastWifiScanAtRef.current = now;

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
      logger.info('BLE WiFi scan complete', {networkCount: networks.length});
      trackBleEvent('ble.wifi_scan_complete', {
        networkCount: networks.length,
        deviceId: deviceIdRef.current ?? null,
      });
    };

    wifiScanSubscriptionRef.current = device.monitorCharacteristicForService(
      BLE_SERVICE_UUID,
      BLE_WIFI_SCAN_UUID,
      (error, characteristic) => {
        if (error) {
          if (isCancelledBleError(error)) {
            return;
          }
          logger.warn('BLE WiFi scan monitor error', {error: error.message});
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
          logger.warn('BLE WiFi scan chunk parse error', {raw});
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
      logger.warn('BLE WiFi scan request write failed', {
        error: e instanceof Error ? e.message : String(e),
      });
      setState(prev => ({...prev, isScanning: false}));
    }
  }, [trackBleEvent]);

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
      deviceId: targetDeviceId,
      pairingCode: null,
      errorMsg: null,
      bluetoothState: prev.bluetoothState,
      bluetoothMessage: prev.bluetoothMessage,
      wifiNetworks: [],
      isScanning: false,
      statusUpdate: null,
    }));
  }, [cleanup, targetDeviceId]);

  return {state, startScan, selectFoundDevice, connectToDevice, sendCredentials, requestWifiScan, clearError, reset};
}
