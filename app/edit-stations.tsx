import {Redirect, useLocalSearchParams} from 'expo-router';

export default function EditStationsRoute() {
  const params = useLocalSearchParams<{deviceId?: string; presetId?: string}>();

  if (typeof params.presetId !== 'string' || params.presetId.length === 0) {
    return <Redirect href="/dashboard" />;
  }

  return (
    <Redirect
      href={{
        pathname: '/preset-editor',
        params: {
          deviceId: params.deviceId,
          presetId: params.presetId,
          step: 'stops',
        },
      }}
    />
  );
}
