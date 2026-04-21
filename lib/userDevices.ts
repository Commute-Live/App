import {apiFetch} from './api';

export type UserDevice = {
  deviceId: string;
  name: string | null;
  timezone: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursDays: string[];
  firmwareVersion: string | null;
  lastActive: string | null;
  online: boolean;
  activePresetId: string | null;
  linkedAt: string;
};

const parseError = async (response: Response) => {
  const data = await response.json().catch(() => null);
  if (typeof data?.error === 'string') return data.error;
  return `Request failed (${response.status})`;
};

const normalizeUserDevice = (value: any): UserDevice | null => {
  if (typeof value?.deviceId !== 'string' || value.deviceId.trim().length === 0) return null;
  return {
    deviceId: value.deviceId,
    name: typeof value?.name === 'string' && value.name.trim().length > 0 ? value.name : null,
    timezone: typeof value?.timezone === 'string' && value.timezone.trim().length > 0 ? value.timezone : 'UTC',
    quietHoursStart: typeof value?.quietHoursStart === 'string' ? value.quietHoursStart : null,
    quietHoursEnd: typeof value?.quietHoursEnd === 'string' ? value.quietHoursEnd : null,
    quietHoursDays: Array.isArray(value?.quietHoursDays)
      ? value.quietHoursDays.filter((day: unknown) => typeof day === 'string')
      : [],
    firmwareVersion: typeof value?.firmwareVersion === 'string' ? value.firmwareVersion : null,
    lastActive: typeof value?.lastActive === 'string' ? value.lastActive : null,
    online: value?.online === true,
    activePresetId: typeof value?.activePresetId === 'string' ? value.activePresetId : null,
    linkedAt: typeof value?.linkedAt === 'string' ? value.linkedAt : '',
  };
};

export async function fetchUserDevices() {
  const response = await apiFetch('/user/devices');
  if (!response.ok) throw new Error(await parseError(response));
  const data = await response.json().catch(() => null);
  return Array.isArray(data?.devices)
    ? data.devices
        .map(normalizeUserDevice)
        .filter((device: UserDevice | null): device is UserDevice => device != null)
    : [];
}
