import {apiFetch} from './api';
import type {CityId} from '../constants/cities';

export type DisplayWeekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export type LineConfig = {
  provider: string;
  line: string;
  stop?: string;
  direction?: string;
  displayType?: number;
  scrolling?: boolean;
  label?: string;
  secondaryLabel?: string;
  topText?: string;
  bottomText?: string;
  textColor?: string;
  nextStops?: number;
  displayFormat?: string;
  primaryContent?: string;
  secondaryContent?: string;
};

export type DeviceConfig = {
  brightness?: number;
  displayType?: number;
  scrolling?: boolean;
  arrivalsToDisplay?: number;
  lines?: LineConfig[];
};

export type DeviceDisplay = {
  displayId: string;
  deviceId: string;
  name: string;
  paused: boolean;
  priority: number;
  sortOrder: number;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  scheduleDays: DisplayWeekday[];
  config: DeviceConfig;
  createdAt: string;
  updatedAt: string;
  isActive?: boolean;
};

export type DisplaySavePayload = {
  name: string;
  paused: boolean;
  priority: number;
  sortOrder: number;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  scheduleDays: DisplayWeekday[];
  config: DeviceConfig;
};

export const DISPLAY_WEEKDAYS: DisplayWeekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const PROVIDER_TO_CITY: Record<string, CityId> = {
  'mta-subway': 'new-york',
  'mta-bus': 'new-york',
  'mbta': 'boston',
  'cta-subway': 'chicago',
  'cta-bus': 'chicago',
  'septa-rail': 'philadelphia',
  'septa-bus': 'philadelphia',
};

const CLOCK_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const parseError = async (response: Response) => {
  const data = await response.json().catch(() => null);
  if (typeof data?.error === 'string') return data.error;
  return `Request failed (${response.status})`;
};

export const providerToCity = (provider: string | undefined | null): CityId | null => {
  if (!provider) return null;
  return PROVIDER_TO_CITY[provider] ?? null;
};

export const toDisplayScheduleText = (display: DeviceDisplay) => {
  const days = Array.isArray(display.scheduleDays) ? display.scheduleDays : [];
  const dayLabel = days.length === 0 ? 'Every day' : days.map((day) => day.toUpperCase()).join(', ');
  return `${dayLabel} ${display.scheduleStart ?? '00:00'}-${display.scheduleEnd ?? '23:59'}`;
};

export const toPreviewSlots = (display: DeviceDisplay, accent: string) => {
  return (display.config.lines ?? []).slice(0, 2).map((line, index) => ({
    id: `${display.displayId}-${index}`,
    color: accent,
    textColor: line.textColor || '#041015',
    routeLabel: (line.line || '--').slice(0, 4).toUpperCase(),
    selected: false,
    stopName: line.topText || line.label || line.stop || 'Select stop',
    subLine: line.bottomText || line.secondaryLabel || undefined,
    times: line.direction || '--',
  }));
};

export const validateDisplayDraft = (payload: DisplaySavePayload) => {
  if (!payload.name.trim()) return 'Display name is required';
  if (payload.scheduleStart && !CLOCK_RE.test(payload.scheduleStart)) return 'Start time must use HH:mm';
  if (payload.scheduleEnd && !CLOCK_RE.test(payload.scheduleEnd)) return 'End time must use HH:mm';

  const lines = payload.config.lines ?? [];
  if (lines.length === 0) return 'Add at least one line';

  for (const [index, line] of lines.entries()) {
    if (!line.provider?.trim()) return `Line ${index + 1}: provider is required`;
    if (!line.line?.trim()) return `Line ${index + 1}: line is required`;
    if (!line.stop?.trim()) return `Line ${index + 1}: stop is required`;
    const top = line.topText?.trim() || '';
    const bottom = line.bottomText?.trim() || '';
    if ((top && !bottom) || (!top && bottom)) {
      return `Line ${index + 1}: top and bottom text must both be filled or both be blank`;
    }
  }

  return null;
};

export async function fetchDisplays(deviceId: string) {
  const response = await apiFetch(`/device/${deviceId}/displays`);
  if (!response.ok) throw new Error(await parseError(response));
  const data = await response.json();
  return {
    displays: Array.isArray(data?.displays) ? (data.displays as DeviceDisplay[]) : [],
    activeDisplayId: typeof data?.activeDisplayId === 'string' ? data.activeDisplayId : null,
  };
}

export async function fetchDisplay(deviceId: string, displayId: string) {
  const response = await apiFetch(`/device/${deviceId}/displays/${displayId}`);
  if (!response.ok) throw new Error(await parseError(response));
  const data = await response.json();
  if (!data?.display) throw new Error('Display not found');
  return data.display as DeviceDisplay;
}

export async function createDisplay(deviceId: string, payload: DisplaySavePayload) {
  const response = await apiFetch(`/device/${deviceId}/displays`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export async function updateDisplay(deviceId: string, displayId: string, payload: DisplaySavePayload) {
  const response = await apiFetch(`/device/${deviceId}/displays/${displayId}`, {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export async function deleteDisplay(deviceId: string, displayId: string) {
  const response = await apiFetch(`/device/${deviceId}/displays/${displayId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}
