import {Redirect, useLocalSearchParams} from 'expo-router';

export default function SwitchPresetRoute() {
  const params = useLocalSearchParams<{deviceId?: string}>();

  return (
    <Redirect
      href={{
        pathname: '/dashboard',
        params: {
          deviceId: params.deviceId,
        },
      }}
    />
  );
}
