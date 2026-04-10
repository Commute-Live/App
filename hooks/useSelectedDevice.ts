import {useMemo} from 'react';
import {useAppState} from '../state/appState';
import {useAuth} from '../state/authProvider';
import type {DeviceInfo} from '../types/device';

export const useSelectedDevice = (): DeviceInfo => {
  const {
    state: {deviceId: fallbackDeviceId, deviceStatus},
  } = useAppState();
  const {deviceId} = useAuth();

  return useMemo(() => {
    const resolvedDeviceId = deviceId ?? fallbackDeviceId;
    const status = deviceStatus === 'pairedOnline' ? 'Online' : 'Offline';
    return {
      id: resolvedDeviceId ?? 'commutelive-001',
      name: 'My Device',
      status,
    };
  }, [deviceId, fallbackDeviceId, deviceStatus]);
};
