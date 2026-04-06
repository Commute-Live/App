import {apiFetch} from './api';
import type {CityId} from '../constants/cities';
import {CITY_LINE_COLORS, hashLineColor, resolveProviderLineColor} from './lineColors';
import {providerToCity as resolveProviderCity} from './transit/providerRegistry';
import type {TransitLineDirection} from '../types/transit';
import {deserializeUiDirection, getLocalDirectionLabel, getLocalDirectionTerminal, getLocalLineLabel, getLocalRouteBadgeLabel, inferUiModeFromProvider, isRailLinePreviewMode} from './transitUi';
import {getTransitCityModule} from './transit/registry';
import {validateScheduleWindow, type DisplayWeekday} from './schedules';

export {DISPLAY_WEEKDAYS} from './schedules';
export type {DisplayWeekday} from './schedules';

export type LineConfig = {
  provider: string;
  providerMode?: string;
  line: string;
  shortName?: string;
  stop?: string;
  direction?: string;
  headsign0?: string;
  headsign1?: string;
  directions?: TransitLineDirection[];
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
  badgeShape?: 'circle' | 'pill' | 'rail' | 'bar';
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

const parseError = async (response: Response) => {
  const data = await response.json().catch(() => null);
  if (typeof data?.error === 'string') return data.error;
  return `Request failed (${response.status})`;
};

export const providerToCity = (provider: string | undefined | null): CityId | null => {
  return resolveProviderCity(provider);
};

const normalizeProviderMode = (value: string | undefined | null) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized.length) return null;
  return KNOWN_PROVIDER_MODES.has(normalized) ? normalized : null;
};

const KNOWN_PROVIDER_MODES = new Set([
  'mta/subway',
  'mta/bus',
  'mta/lirr',
  'mta/mnr',
  'septa/rail',
  'septa/bus',
  'septa/trolley',
  'mbta/subway',
  'mbta/bus',
  'mbta/rail',
  'mbta/ferry',
  'cta/subway',
  'cta/bus',
]);

const inferMbtaProviderMode = (
  stopId: string | undefined | null,
  lineId: string | undefined | null,
) => {
  const mode = inferUiModeFromProvider('mbta', stopId, lineId);
  if (mode === 'bus') return 'mbta/bus';
  if (mode === 'commuter-rail') return 'mbta/rail';
  if (mode === 'ferry') return 'mbta/ferry';
  return 'mbta/subway';
};

export const resolveLineProviderMode = (
  line: Pick<LineConfig, 'provider' | 'providerMode' | 'stop' | 'line'>,
): string | null => {
  const provider = typeof line.provider === 'string' ? line.provider.trim().toLowerCase() : '';
  const providerMode = normalizeProviderMode(line.providerMode);
  if (provider === 'mbta' && providerMode?.startsWith('mbta/')) return providerMode;
  if (provider === 'mbta') {
    return inferMbtaProviderMode(line.stop, line.line);
  }

  return null;
};

export const buildStopLookupKey = (
  line: Pick<LineConfig, 'provider' | 'providerMode' | 'stop' | 'line'>,
): string => {
  const provider = typeof line.provider === 'string' ? line.provider.trim().toLowerCase() : '';
  const stop = typeof line.stop === 'string' ? line.stop.trim() : '';
  return `${resolveLineProviderMode(line) ?? provider}:${stop}`;
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

const trimOptionalString = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

const resolvePreviewLineHeadsign = (
  line: Pick<LineConfig, 'direction' | 'headsign0' | 'headsign1' | 'directions'>,
  direction: ReturnType<typeof deserializeUiDirection>,
) => {
  const metadataTerminal = trimOptionalString(getLocalDirectionTerminal(line, direction));
  if (metadataTerminal) return metadataTerminal;
  const useHeadsign1 =
    direction === 'downtown' || direction === 'dir1' || direction === 'westbound' || direction === 'inbound';
  return trimOptionalString(useHeadsign1 ? line.headsign1 : line.headsign0);
};

const resolvePreviewDirectionCueLabel = (
  line: Pick<LineConfig, 'provider' | 'providerMode' | 'line' | 'stop' | 'direction' | 'headsign0' | 'headsign1' | 'directions'>,
) => {
  const normalized = normalizeDirectionToken(line.direction);
  const city = providerToCity(line.provider ?? null);
  const mode = inferUiModeFromProvider(line.provider, line.stop, line.line, line.providerMode);
  if (city && mode) {
    const direction = deserializeUiDirection(city, mode, line.direction, line.stop);
    if (city === 'new-york' && (mode === 'lirr' || mode === 'mnr')) {
      return getLocalDirectionLabel(city, mode, direction, line, 'bound');
    }
    if (city === 'new-york' && mode === 'bus') {
      return getLocalDirectionLabel(city, mode, direction, line, 'bound');
    }
    if (isRailLinePreviewMode(city, mode)) {
      return getLocalLineLabel(city, mode, line.line ?? '', line.line ?? '');
    }
    return getLocalDirectionLabel(city, mode, direction, line, 'bound');
  }
  if (normalized === 'N') return 'Uptown';
  if (normalized === 'S') return 'Downtown';
  return typeof line.direction === 'string' && line.direction.trim().length > 0 ? line.direction.trim() : '--';
};

const resolvePreviewHeadsignLabel = (
  line: Pick<LineConfig, 'provider' | 'providerMode' | 'line' | 'stop' | 'direction' | 'headsign0' | 'headsign1' | 'directions'>,
) => {
  const city = providerToCity(line.provider ?? null);
  const mode = inferUiModeFromProvider(line.provider, line.stop, line.line, line.providerMode);
  if (city && mode) {
    const direction = deserializeUiDirection(city, mode, line.direction, line.stop);
    const headsign = resolvePreviewLineHeadsign(line, direction);
    if (headsign) return headsign;
    if (city === 'new-york') {
      return '--';
    }
    if (isRailLinePreviewMode(city, mode)) {
      return getLocalLineLabel(city, mode, line.line ?? '', line.line ?? '');
    }
    return getLocalDirectionLabel(city, mode, direction, line.line, 'bound');
  }
  return resolvePreviewDirectionCueLabel(line);
};

const resolvePreviewContent = (
  content: unknown,
  destinationLabel: string,
  directionLabel: string,
  headsignLabel: string,
  customLabel: unknown,
) => {
  const normalized = typeof content === 'string' ? content.trim().toLowerCase() : '';
  if (normalized === 'direction') return directionLabel;
  if (normalized === 'headsign') return headsignLabel || directionLabel || destinationLabel;
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
  let current = Math.max(1, Math.round(firstMinutes)) + 2;
  for (let idx = 0; idx < safeCount; idx += 1) {
    times.push(`${current}m`);
    current += 2;
  }
  return times.join(', ');
};

const resolvePreviewRouteLabel = (
  line: Pick<LineConfig, 'provider' | 'providerMode' | 'line' | 'shortName' | 'stop' | 'direction' | 'headsign0' | 'headsign1' | 'directions'>,
) => {
  const lineId = (line.line ?? '').trim();
  const shortName = (line.shortName ?? '').trim();
  if (!lineId) return '--';
  const city = providerToCity(line.provider ?? null);
  const mode = inferUiModeFromProvider(line.provider, line.stop, lineId, line.providerMode);
  if (city && mode) {
    if (mode === 'lirr') {
      const direction = deserializeUiDirection(city, mode, line.direction, line.stop);
      const preferredHeadsign = trimOptionalString(getLocalDirectionTerminal(line, direction));
      if (preferredHeadsign) {
        return preferredHeadsign;
      }
    }
    if (mode === 'mnr') {
      return getLocalLineLabel(city, mode, lineId, lineId);
    }
    return getLocalRouteBadgeLabel(city, mode, lineId, shortName || lineId, shortName || undefined);
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
    const city = providerToCity(line.provider ?? null);
    const mode = inferUiModeFromProvider(line.provider, line.stop, line.line, line.providerMode);
    const isBusBadge = city && mode ? (getTransitCityModule(city)?.isBusBadge?.(mode) ?? false) : false;
    const lineColors = city ? (CITY_LINE_COLORS[city] ?? {}) : {};
    const lineId = (line.line ?? '').toUpperCase();
    const {color, textColor: lineTextColor} =
      line.provider === 'mta-bus'
        ? {color: '#0039A6', textColor: '#FFFFFF'}
        : resolveProviderLineColor(line.provider ?? '', lineId)
          ?? lineColors[lineId]
          ?? hashLineColor(lineId);
    const directionLabel = resolvePreviewDirectionCueLabel(line);
    const headsignLabel = resolvePreviewHeadsignLabel(line);
    const destinationLabel = stopNames[buildStopLookupKey(line)] || line.stop || 'Select stop';
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
      resolvePreviewContent(line.primaryContent, destinationLabel, directionLabel, headsignLabel, line.label);
    const previewSecondary =
      line.bottomText ||
      resolvePreviewContent(line.secondaryContent, destinationLabel, directionLabel, headsignLabel, line.secondaryLabel);
    const previewSubLine =
      displayType === 3
        ? previewSecondary
        : displayType === 4 || displayType === 5
          ? buildPreviewEtaList(extractMinutesFromPreviewTime(liveTime), line.nextStops ?? DEFAULT_NEXT_STOPS)
          : undefined;
    const badgeShape: PreviewSlot['badgeShape'] =
      city === 'new-york' && (line.provider === 'mta-lirr' || line.provider === 'mta-mnr')
        ? 'bar'
        : isBusBadge
        ? 'pill'
        : city === 'chicago' && line.provider === 'cta-subway'
          ? 'pill'
        : city === 'boston' && (mode === 'train' || mode === 'ferry')
          ? 'pill'
        : city === 'new-jersey' && mode === 'train'
          ? 'pill'
        : city === 'philadelphia' && (mode === 'train' || mode === 'trolley')
            ? 'pill'
            : line.provider === 'mta-lirr' || line.provider === 'mta-mnr' || mode === 'commuter-rail'
          ? 'rail'
          : 'circle';

    return {
      id: `${display.displayId}-${index}`,
      color,
      textColor: line.textColor || lineTextColor,
      routeLabel: resolvePreviewRouteLabel(line),
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
  const scheduleError = validateScheduleWindow({
    start: payload.scheduleStart,
    end: payload.scheduleEnd,
    days: payload.scheduleDays,
  });
  if (scheduleError) return scheduleError;

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
