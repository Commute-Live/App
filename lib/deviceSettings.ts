import {apiFetch} from './api';
import {
  getCurrentIanaTimeZone,
  sanitizeDisplayWeekdays,
  validateScheduleWindow,
  type DisplayWeekday,
} from './schedules';

export type DeviceSettings = {
  deviceId: string;
  name: string | null;
  timezone: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursDays: DisplayWeekday[];
};

export type DeviceSettingsSavePayload = DeviceSettings;

const parseError = async (response: Response) => {
  const data = await response.json().catch(() => null);
  if (typeof data?.error === 'string') return data.error;
  return `Request failed (${response.status})`;
};

const normalizeDeviceSettings = (value: any, deviceId: string): DeviceSettings => ({
  deviceId: typeof value?.deviceId === 'string' && value.deviceId.trim().length > 0 ? value.deviceId : deviceId,
  name: typeof value?.name === 'string' && value.name.trim().length > 0 ? value.name : null,
  timezone:
    typeof value?.timezone === 'string' && value.timezone.trim().length > 0
      ? value.timezone
      : getCurrentIanaTimeZone(),
  quietHoursStart: typeof value?.quietHoursStart === 'string' ? value.quietHoursStart : null,
  quietHoursEnd: typeof value?.quietHoursEnd === 'string' ? value.quietHoursEnd : null,
  quietHoursDays: sanitizeDisplayWeekdays(value?.quietHoursDays),
});

export const validateDeviceSettings = (payload: DeviceSettingsSavePayload) => {
  if (!payload.deviceId.trim()) return 'Device ID is required';
  if (!payload.timezone.trim()) return 'Timezone is required';
  return validateScheduleWindow({
    start: payload.quietHoursStart,
    end: payload.quietHoursEnd,
    days: payload.quietHoursDays,
  });
};

export async function fetchDeviceSettings(deviceId: string) {
  const response = await apiFetch(`/device/${deviceId}/settings`);
  if (!response.ok) throw new Error(await parseError(response));
  const data = await response.json().catch(() => null);
  return normalizeDeviceSettings(data, deviceId);
}

export async function updateDeviceSettings(deviceId: string, payload: DeviceSettingsSavePayload) {
  const response = await apiFetch(`/device/${deviceId}/settings`, {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseError(response));
  const data = await response.json().catch(() => null);
  return normalizeDeviceSettings(data, deviceId);
}
