import {apiFetch} from './api';
import {getCurrentIanaTimeZone} from './schedules';

export type RegisterAndLinkDeviceResult =
  | {ok: true}
  | {ok: false; error: string};

export async function registerAndLinkDevice(deviceId: string): Promise<RegisterAndLinkDeviceResult> {
  const registerResponse = await apiFetch('/device/register', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      id: deviceId,
      timezone: getCurrentIanaTimeZone(),
    }),
  });

  if (!registerResponse.ok && registerResponse.status !== 409) {
    const registerData = await registerResponse.json().catch(() => null);
    return {
      ok: false,
      error:
        typeof registerData?.error === 'string'
          ? `Device register failed: ${registerData.error}`
          : `Device register failed (${registerResponse.status})`,
    };
  }

  const linkResponse = await apiFetch('/user/device/link', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({deviceId}),
  });

  if (!linkResponse.ok) {
    const linkData = await linkResponse.json().catch(() => null);
    const linkError = typeof linkData?.error === 'string' ? linkData.error : '';
    return {
      ok: false,
      error:
        linkError === 'DEVICE_COMMAND_CLEAR_FAILED'
          ? 'Wi-Fi connected, but pairing could not finish. Try again in a moment.'
          : typeof linkData?.error === 'string'
          ? `Wi-Fi connected, but device link failed: ${linkData.error}`
          : `Wi-Fi connected, but device link failed (${linkResponse.status})`,
    };
  }

  return {ok: true};
}
