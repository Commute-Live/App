import {useMemo} from 'react';
import {useAppState} from '../state/appState';
import {useAuth} from '../state/authProvider';
import type {DeviceInfo} from '../types/device';
import {useUserDevices} from './useUserDevices';
import type {UserDevice} from '../lib/userDevices';

export const useSelectedDevice = (): DeviceInfo => {
  const {
    state: {deviceId: fallbackDeviceId, deviceStatus},
  } = useAppState();
  const {deviceId} = useAuth();
  const {devicesById} = useUserDevices();

  return useMemo(() => {
    const resolvedDeviceId = deviceId ?? fallbackDeviceId;
    const linkedDevice: UserDevice | null = resolvedDeviceId ? devicesById.get(resolvedDeviceId) ?? null : null;
    const status = linkedDevice?.online === true || deviceStatus === 'pairedOnline' ? 'Online' : 'Offline';
    return {
      id: resolvedDeviceId ?? 'commutelive-001',
      name: linkedDevice?.name ?? resolvedDeviceId ?? 'Device',
      status,
    };
  }, [deviceId, devicesById, fallbackDeviceId, deviceStatus]);
};
