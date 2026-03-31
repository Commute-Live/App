import {apiFetch} from './api';
import type {CityId} from '../constants/cities';
import {CITY_LINE_COLORS, hashLineColor} from './lineColors';

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

export type LiveArrivalLookup = {
  byLineKey: Record<string, string>;
  byIndex: string[];
};

export type PreviewSlotOptions = {
  showDirectionFallback?: boolean;
};

type PreviewSlot = {
  id: string;
  color: string;
  textColor: string;
  routeLabel: string;
  badgeShape?: 'circle' | 'pill' | 'rail';
  selected: boolean;
  stopName: string;
  subLine?: string;
  subLineColor?: string;
  times: string;
  timesColor?: string;
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
  'mta-lirr': 'new-york',
  'mta-mnr': 'new-york',
  'mbta': 'boston',
  'cta-subway': 'chicago',
  'cta-bus': 'chicago',
  'septa-rail': 'philadelphia',
  'septa-bus': 'philadelphia',
  'septa-trolley': 'philadelphia',
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

type RecordValue = Record<string, unknown>;

const asRecord = (value: unknown): RecordValue | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as RecordValue;
};

const readPath = (record: RecordValue, path: string[]) => {
  let current: unknown = record;
  for (const segment of path) {
    const next = asRecord(current);
    if (!next) return undefined;
    current = next[segment];
  }
  return current;
};

const normalizeDirectionToken = (value: unknown) => {
  if (typeof value !== 'string') return '';
  const token = value.trim().toUpperCase();
  if (!token) return '';
  if (token === 'N' || token === 'UPTOWN' || token === 'NORTHBOUND') return 'N';
  if (token === 'S' || token === 'DOWNTOWN' || token === 'SOUTHBOUND') return 'S';
  return token;
};

const toLineKeyPart = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

const toDisplayTimeLabel = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const rounded = Math.max(0, Math.round(value));
    return rounded === 0 ? 'DUE' : `${rounded}m`;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    const rounded = Math.max(0, Math.round(numeric));
    return rounded === 0 ? 'DUE' : `${rounded}m`;
  }
  return trimmed;
};

const PREVIEW_TIME_COLOR_ONTIME = '#34D399';
const PREVIEW_TIME_COLOR_DUE = '#EF4444';
const DEFAULT_NEXT_STOPS = 3;

const isDueTimeLabel = (value: string) => {
  const normalized = value.trim().toUpperCase();
  return (
    normalized === 'DUE' ||
    normalized === 'NOW' ||
    normalized === 'ARR' ||
    normalized === 'ARRIVING' ||
    normalized === '0M' ||
    normalized === '0'
  );
};

const resolvePreviewDirectionLabel = (value: unknown) => {
  const normalized = normalizeDirectionToken(value);
  if (normalized === 'N') return 'Uptown';
  if (normalized === 'S') return 'Downtown';
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '--';
};

const resolvePreviewContent = (
  content: unknown,
  destinationLabel: string,
  directionLabel: string,
  customLabel: unknown,
) => {
  const normalized = typeof content === 'string' ? content.trim().toLowerCase() : '';
  if (normalized === 'direction') return directionLabel;
  if (normalized === 'custom') {
    return typeof customLabel === 'string' && customLabel.trim().length > 0 ? customLabel.trim() : destinationLabel;
  }
  return destinationLabel;
};

const extractMinutesFromPreviewTime = (value: string | undefined) => {
  if (!value) return 2;
  const match = value.match(/(\d+)/);
  if (!match) return 2;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 2;
};

const buildPreviewEtaList = (firstMinutes: number, count: number) => {
  const safeCount = Math.max(1, Math.min(5, Math.round(count || DEFAULT_NEXT_STOPS)));
  const times: string[] = [];
  let current = Math.max(1, Math.round(firstMinutes));
  for (let idx = 0; idx < safeCount; idx += 1) {
    times.push(`${current}m`);
    current += idx % 2 === 0 ? 2 : 3;
  }
  return times.join(', ');
};

const MTA_MNR_LINE_LABELS: Record<string, string> = {
  '1': 'Hudson',
  '2': 'Harlem',
  '3': 'New Haven',
  '4': 'New Canaan',
  '5': 'Danbury',
  '6': 'Waterbury',
};

const resolvePreviewRouteLabel = (provider: string | undefined, rawLineId: string) => {
  const lineId = rawLineId.trim();
  if (!lineId) return '--';
  if ((provider ?? '').trim().toLowerCase() === 'mta-mnr') {
    return MTA_MNR_LINE_LABELS[lineId.toUpperCase()] ?? MTA_MNR_LINE_LABELS[lineId] ?? lineId;
  }
  return lineId.toUpperCase().slice(0, 4);
};

export const buildPreviewLineKey = (line: Pick<LineConfig, 'provider' | 'line' | 'stop' | 'direction'>) => {
  return [
    toLineKeyPart(line.provider),
    toLineKeyPart(line.line),
    toLineKeyPart(line.stop),
    normalizeDirectionToken(line.direction),
  ].join('|');
};

const toBaseLineKey = (lineKey: string) => {
  const [provider = '', line = '', stop = ''] = lineKey.split('|');
  return [provider, line, stop, ''].join('|');
};

const ENTRY_KEY_PATHS = {
  provider: [
    ['provider'],
    ['providerId'],
    ['agency'],
    ['line', 'provider'],
    ['route', 'provider'],
  ],
  line: [
    ['line'],
    ['lineId'],
    ['route'],
    ['routeId'],
    ['tripId'],
    ['line', 'id'],
    ['route', 'id'],
  ],
  stop: [
    ['stop'],
    ['stopId'],
    ['station'],
    ['stationId'],
    ['line', 'stop'],
    ['station', 'id'],
  ],
  direction: [
    ['direction'],
    ['bound'],
    ['line', 'direction'],
    ['route', 'direction'],
  ],
};

const TIME_VALUE_PATHS = [
  ['nextArrivalMinutes'],
  ['arrivalMinutes'],
  ['etaMinutes'],
  ['minutes'],
  ['nextArrival'],
  ['arrival'],
  ['eta'],
  ['countdown'],
  ['time'],
] as const;

const TIME_LIST_PATHS = [
  ['nextArrivals'],
  ['arrivals'],
  ['times'],
  ['etas'],
] as const;

const CANDIDATE_ARRAY_PATHS = [
  ['lines'],
  ['arrivals'],
  ['payload', 'lines'],
  ['payload', 'arrivals'],
  ['data', 'lines'],
  ['data', 'arrivals'],
  ['transit', 'lines'],
  ['transit', 'arrivals'],
  ['command', 'lines'],
  ['command', 'arrivals'],
] as const;

const readEntryField = (record: RecordValue, paths: ReadonlyArray<readonly string[]>) => {
  for (const path of paths) {
    const value = readPath(record, [...path]);
    if (value == null) continue;
    if (typeof value === 'string' && value.trim().length === 0) continue;
    return value;
  }
  return undefined;
};

const extractTimeFromEntry = (entry: unknown): string | null => {
  const direct = toDisplayTimeLabel(entry);
  if (direct) return direct;

  const record = asRecord(entry);
  if (!record) return null;

  for (const path of TIME_VALUE_PATHS) {
    const label = toDisplayTimeLabel(readPath(record, [...path]));
    if (label) return label;
  }

  for (const path of TIME_LIST_PATHS) {
    const raw = readPath(record, [...path]);
    if (!Array.isArray(raw)) continue;
    for (const value of raw) {
      const label = extractTimeFromEntry(value);
      if (label) return label;
    }
  }

  return null;
};

const extractEntryLineKey = (entry: unknown): string | null => {
  const record = asRecord(entry);
  if (!record) return null;

  const provider = readEntryField(record, ENTRY_KEY_PATHS.provider);
  const line = readEntryField(record, ENTRY_KEY_PATHS.line);
  const stop = readEntryField(record, ENTRY_KEY_PATHS.stop);
  const direction = readEntryField(record, ENTRY_KEY_PATHS.direction);

  if (provider == null && line == null && stop == null) return null;

  return [
    toLineKeyPart(provider),
    toLineKeyPart(line),
    toLineKeyPart(stop),
    normalizeDirectionToken(direction),
  ].join('|');
};

export const getLiveArrivalLookup = (payload: unknown): LiveArrivalLookup => {
  const byLineKey: Record<string, string> = {};
  const byIndex: string[] = [];

  let source: unknown = payload;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch {
      source = null;
    }
  }

  let root = asRecord(source);
  if (root && typeof root.payload === 'string') {
    try {
      const parsed = JSON.parse(root.payload);
      const nested = asRecord(parsed);
      if (nested) root = nested;
    } catch {
      // ignore malformed nested payload string
    }
  }
  if (!root) return {byLineKey, byIndex};

  for (const path of CANDIDATE_ARRAY_PATHS) {
    const entries = readPath(root, [...path]);
    if (!Array.isArray(entries)) continue;

    entries.forEach((entry, index) => {
      const label = extractTimeFromEntry(entry);
      if (!label) return;

      if (!byIndex[index]) byIndex[index] = label;

      const lineKey = extractEntryLineKey(entry);
      if (lineKey) {
        if (!byLineKey[lineKey]) byLineKey[lineKey] = label;
        const baseLineKey = toBaseLineKey(lineKey);
        if (!byLineKey[baseLineKey]) byLineKey[baseLineKey] = label;
      }
    });
  }

  return {byLineKey, byIndex};
};

export const toDisplayScheduleText = (display: DeviceDisplay) => {
  const days = Array.isArray(display.scheduleDays) ? display.scheduleDays : [];
  const dayLabel = days.length === 0 ? 'Every day' : days.map((day) => day.toUpperCase()).join(', ');
  return `${dayLabel} ${display.scheduleStart ?? '00:00'}-${display.scheduleEnd ?? '23:59'}`;
};

export const toPreviewSlots = (
  display: DeviceDisplay,
  accent: string,
  stopNames: Record<string, string> = {},
  liveArrivals: LiveArrivalLookup | null = null,
  options: PreviewSlotOptions = {},
): PreviewSlot[] => {
  const showDirectionFallback = options.showDirectionFallback ?? true;
  return (display.config.lines ?? []).slice(0, 2).map((line, index) => {
    const city = PROVIDER_TO_CITY[line.provider ?? ''] ?? null;
    const lineColors = city ? (CITY_LINE_COLORS[city] ?? {}) : {};
    const lineId = (line.line ?? '').toUpperCase();
    const {color, textColor: lineTextColor} =
      line.provider === 'mta-bus'
        ? {color: '#0039A6', textColor: '#FFFFFF'}
        : lineColors[lineId] ?? hashLineColor(lineId);
    const directionLabel = resolvePreviewDirectionLabel(line.direction);
    const destinationLabel = stopNames[`${line.provider}:${line.stop}`] || line.stop || 'Select stop';
    const displayType = Number.isFinite(Number(line.displayType))
      ? Math.max(1, Math.min(5, Math.trunc(Number(line.displayType))))
      : Number.isFinite(Number(display.config.displayType))
        ? Math.max(1, Math.min(5, Math.trunc(Number(display.config.displayType))))
        : 1;
    const lineKey = buildPreviewLineKey(line);
    const liveTime =
      liveArrivals?.byLineKey[lineKey] ??
      liveArrivals?.byLineKey[toBaseLineKey(lineKey)] ??
      liveArrivals?.byIndex[index];
    const liveTimeColor =
      typeof liveTime === 'string' && liveTime.length > 0
        ? isDueTimeLabel(liveTime)
          ? PREVIEW_TIME_COLOR_DUE
          : PREVIEW_TIME_COLOR_ONTIME
        : undefined;
    const previewTitle =
      line.topText ||
      resolvePreviewContent(line.primaryContent, destinationLabel, directionLabel, line.label);
    const previewSecondary =
      line.bottomText ||
      resolvePreviewContent(line.secondaryContent, destinationLabel, directionLabel, line.secondaryLabel);
    const previewSubLine =
      displayType === 3
        ? previewSecondary
        : displayType === 4 || displayType === 5
          ? buildPreviewEtaList(extractMinutesFromPreviewTime(liveTime), line.nextStops ?? DEFAULT_NEXT_STOPS)
          : undefined;
    const badgeShape: PreviewSlot['badgeShape'] =
      city === 'new-york' && line.provider === 'mta-bus'
        ? 'pill'
        : line.provider === 'mta-lirr' || line.provider === 'mta-mnr' || line.provider === 'mbta'
          ? 'rail'
          : 'circle';

    return {
      id: `${display.displayId}-${index}`,
      color,
      textColor: line.textColor || lineTextColor,
      routeLabel: resolvePreviewRouteLabel(line.provider, line.line ?? ''),
      badgeShape,
      selected: false,
      stopName: previewTitle,
      subLine: previewSubLine,
      subLineColor: displayType === 4 || displayType === 5 ? '#E5C15A' : undefined,
      times: liveTime || (showDirectionFallback ? directionLabel : '--'),
      timesColor: liveTimeColor,
    };
  });
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
