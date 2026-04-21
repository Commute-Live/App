import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {fetchUserDevices, type UserDevice} from '../lib/userDevices';
import {queryKeys} from '../lib/queryKeys';
import {useAuth} from '../state/authProvider';

export const useUserDevices = () => {
  const {status} = useAuth();

  const query = useQuery({
    queryKey: queryKeys.user.devices,
    queryFn: fetchUserDevices,
    enabled: status === 'authenticated',
    staleTime: 30_000,
  });

  const devices = query.data ?? [];
  const devicesById = useMemo(
    () => new Map<string, UserDevice>(devices.map((device: UserDevice) => [device.deviceId, device])),
    [devices],
  );

  return {
    ...query,
    devices,
    devicesById,
  };
};
