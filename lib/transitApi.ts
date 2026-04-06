import {apiFetch} from './api';
import {resolveTransitModeMapping} from './transitModeMap';
import {resolveBackendProviderContext} from './transit/providerRegistry';
import type {
  TransitApi,
  TransitArrival,
  TransitArrivalGroup,
  TransitBackendMode,
  TransitCity,
  TransitContext,
  TransitLine,
  TransitLineDirection,
  TransitLineGroup,
  TransitStation,
  TransitStationGroup,
  TransitUiMode,
} from '../types/transit';
import {isUiDirection} from './transit/frontendTypes';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const readFirstString = (record: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = normalizeString(record[key]);
    if (value) return value;
  }
  return null;
};

const readFirstNumber = (record: Record<string, unknown>, keys: string[]): number | null => {
  for (const key of keys) {
    const value = parseNumber(record[key]);
    if (value !== null) return value;
  }
  return null;
};

const collectArray = (payload: unknown, keys: string[]): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  for (const key of keys) {
    if (Array.isArray(payload[key])) {
      return payload[key] as unknown[];
    }
  }

  return [];
};

const dedupeById = <T extends {id: string}>(items: T[]): T[] => {
  const seen = new Set<string>();
  const next: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    next.push(item);
  }
  return next;
};

const normalizeStopId = (stopId: string): string => {
  const normalized = normalizeString(stopId);
  if (!normalized) {
    throw new Error('Transit API requires a non-empty stopId.');
  }
  return normalized;
};

const normalizeLineIds = (lineIds: readonly string[]): string[] => {
  const next: string[] = [];
  const seen = new Set<string>();

  for (const rawLineId of lineIds) {
    const lineId = normalizeString(rawLineId);
    if (!lineId || seen.has(lineId)) continue;
    seen.add(lineId);
    next.push(lineId);
  }

  if (next.length === 0) {
    throw new Error('Transit API requires at least one lineId for arrivals.');
  }

  return next;
};

const createContext = (city: TransitCity, uiMode: TransitUiMode): TransitContext => ({
  city,
  uiMode,
  ...resolveTransitModeMapping(city, uiMode),
});

const buildStationsEndpoint = (context: TransitContext) =>
  `/${encodeURIComponent(context.provider)}/stations?mode=${encodeURIComponent(context.mode)}`;

const buildLinesEndpoint = (context: TransitContext, stopId: string) =>
  `/${encodeURIComponent(context.provider)}/stations/${encodeURIComponent(context.mode)}/${encodeURIComponent(stopId)}/lines`;

const buildGlobalLinesEndpoint = (context: TransitContext) =>
  `/${encodeURIComponent(context.provider)}/stations/${encodeURIComponent(context.mode)}/lines`;

const buildStopsByLineEndpoint = (context: TransitContext, lineId: string) =>
  `/${encodeURIComponent(context.provider)}/stations/${encodeURIComponent(context.mode)}/${encodeURIComponent(lineId)}/stopId`;

const buildArrivalsEndpoint = (
  context: TransitContext,
  stopId: string,
  lineIds: string[],
  options: {
    direction?: string;
  } = {},
) => {
  const query = new URLSearchParams({line_ids: lineIds.join(',')});
  if (typeof options.direction === 'string' && options.direction.trim().length > 0) {
    query.set('direction', options.direction.trim());
  }
  return `/${encodeURIComponent(context.provider)}/stations/${encodeURIComponent(context.mode)}/${encodeURIComponent(
    stopId,
  )}/arrivals?${query.toString()}`;
};

const parseBackendError = async (response: Response): Promise<string | null> => {
  try {
    const payload = await response.clone().json();
    if (!isRecord(payload)) return null;
    return readFirstString(payload, ['error', 'message', 'detail']);
  } catch {
    return null;
  }
};

const ensureOk = async (response: Response, endpoint: string) => {
  if (response.ok) return;
  const backendError = await parseBackendError(response);
  const message = backendError ? `: ${backendError}` : '';
  throw new Error(`Transit API request failed (${response.status}) for ${endpoint}${message}`);
};

const parseJson = async (response: Response, endpoint: string): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    throw new Error(`Transit API returned invalid JSON for ${endpoint}`);
  }
};

const parseIsoMillis = (value: string | null): number | null => {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

const minutesFromTimestamp = (timestamp: string | null): number | null => {
  const ms = parseIsoMillis(timestamp);
  if (ms === null) return null;
  return Math.max(0, Math.round((ms - Date.now()) / 60000));
};

export const normalizeTransitStation = (value: unknown): TransitStation | null => {
  if (!isRecord(value)) return null;

  const id = readFirstString(value, ['stopId', 'stationId', 'id']);
  const name = readFirstString(value, ['name', 'stop', 'station', 'label']);
  if (!id || !name) return null;

  const rawLines = Array.isArray(value.lines) ? value.lines : [];
  const lines = rawLines
    .map((line): TransitStation['lines'][number] | null => {
      if (!isRecord(line)) {
        const lineId = normalizeString(line);
        return lineId ? {id: lineId, shortName: lineId, label: lineId} : null;
      }
      const lineId = readFirstString(line, ['id', 'lineId', 'routeId']);
      if (!lineId) return null;
      return {
        id: lineId,
        shortName: readFirstString(line, ['shortName']) ?? lineId,
        label: readFirstString(line, ['label', 'longName']) ?? lineId,
      };
    })
    .filter((line): line is TransitStation['lines'][number] => line !== null);

  return {
    id,
    name,
    area: readFirstString(value, ['area', 'borough', 'district', 'region', 'city']),
    lines,
  };
};

export const normalizeTransitLine = (value: unknown): TransitLine | null => {
  if (!isRecord(value)) {
    const lineId = normalizeString(value);
    if (!lineId) return null;
    return {
      id: lineId,
      shortName: lineId,
      label: lineId,
      sortOrder: null,
      color: null,
      textColor: null,
      headsign0: null,
      headsign1: null,
      directions: [],
    };
  }

  const id = readFirstString(value, ['id', 'lineId', 'routeId', 'shortName', 'line']);
  if (!id) return null;
  const shortName = readFirstString(value, ['shortName']) ?? null;

  const label = readFirstString(value, ['shortName', 'label', 'line', 'longName', 'name']) ?? id;

  const rawColor = readFirstString(value, ['color', 'routeColor', 'bg_color']);
  const color = rawColor ? (rawColor.startsWith('#') ? rawColor : `#${rawColor}`) : null;

  const rawTextColor = readFirstString(value, ['textColor', 'text_color', 'routeTextColor']);
  const textColor = rawTextColor ? (rawTextColor.startsWith('#') ? rawTextColor : `#${rawTextColor}`) : null;

  const rawDirections = Array.isArray(value.directions) ? value.directions : [];
  const directions = rawDirections
    .map((entry): TransitLineDirection | null => {
      if (!isRecord(entry)) return null;
      const id = readFirstString(entry, ['id']);
      const uiKey = readFirstString(entry, ['uiKey', 'ui_key']);
      const label = readFirstString(entry, ['label']);
      const boundLabel = readFirstString(entry, ['boundLabel', 'bound_label']);
      const toggleLabel = readFirstString(entry, ['toggleLabel', 'toggle_label']);
      const summaryLabel = readFirstString(entry, ['summaryLabel', 'summary_label']);
      if (!id || !uiKey || !isUiDirection(uiKey) || !label || !boundLabel || !toggleLabel || !summaryLabel) {
        return null;
      }
      return {
        id,
        uiKey,
        label,
        terminal: readFirstString(entry, ['terminal']) ?? null,
        boundLabel,
        toggleLabel,
        summaryLabel,
      };
    })
    .filter((entry): entry is TransitLineDirection => entry !== null);

  return {
    id,
    shortName,
    label,
    sortOrder: readFirstNumber(value, ['sortOrder', 'routeSortOrder', 'route_sort_order']),
    color,
    textColor,
    headsign0: readFirstString(value, ['headsign0', 'headsign_0']) ?? null,
    headsign1: readFirstString(value, ['headsign1', 'headsign_1']) ?? null,
    directions,
  };
};

export const normalizeTransitArrival = (value: unknown, lineIdHint: string | null): TransitArrival | null => {
  if (!isRecord(value)) return null;

  const lineId = readFirstString(value, ['lineId', 'routeId', 'line']) ?? lineIdHint;
  if (!lineId) return null;

  const scheduledAt = readFirstString(value, ['scheduledTime', 'scheduledAt']);
  const arrivalAt = readFirstString(value, ['arrivalTime', 'arrivalAt']);
  const etaMinutes = readFirstNumber(value, ['minutes', 'eta', 'waitMinutes']);
  const computedMinutes = minutesFromTimestamp(arrivalAt) ?? minutesFromTimestamp(scheduledAt);
  const delaySeconds = readFirstNumber(value, ['delaySeconds', 'delay']);
  const rawStatus = readFirstString(value, ['status']);

  return {
    lineId,
    destination: readFirstString(value, ['destination', 'headsign', 'dest', 'to']),
    minutes: etaMinutes ?? computedMinutes,
    status: rawStatus ?? (delaySeconds !== null && delaySeconds > 120 ? 'DELAYS' : 'GOOD'),
    scheduledAt: scheduledAt ?? arrivalAt,
  };
};

export const normalizeTransitStationGroup = (payload: unknown, context: TransitContext): TransitStationGroup => {
  const stations = dedupeById(
    collectArray(payload, ['stations', 'stops'])
      .map(normalizeTransitStation)
      .filter((item): item is TransitStation => item !== null),
  );

  return {
    ...context,
    stations,
  };
};

export const normalizeTransitLineGroup = (
  payload: unknown,
  context: TransitContext,
  stopId: string,
): TransitLineGroup => {
  const resolvedStopId = isRecord(payload)
    ? readFirstString(payload, ['stopId', 'stationId', 'id']) ?? stopId
    : stopId;
  const lines = dedupeById(
    collectArray(payload, ['lines', 'routes'])
      .map(normalizeTransitLine)
      .filter((item): item is TransitLine => item !== null),
  );

  return {
    ...context,
    stopId: resolvedStopId,
    lines,
  };
};

export const normalizeTransitArrivalGroup = (
  payload: unknown,
  context: TransitContext,
  stopId: string,
  lineIds: string[],
): TransitArrivalGroup => {
  const groups = collectArray(payload, ['groups']);
  const arrivals: TransitArrival[] = [];

  if (groups.length > 0) {
    for (const group of groups) {
      if (!isRecord(group)) continue;
      const groupLineId = readFirstString(group, ['lineId', 'id']) ?? lineIds[0] ?? null;
      const groupDestination = readFirstString(group, ['destination']);
      const groupArrivals = collectArray(group, ['arrivals']);
      for (const row of groupArrivals) {
        const arrival = normalizeTransitArrival(row, groupLineId);
        if (arrival) {
          arrivals.push(groupDestination && !arrival.destination ? {...arrival, destination: groupDestination} : arrival);
        }
      }
    }
  } else {
    const fallbackLineId = lineIds[0] ?? null;
    const rows = collectArray(payload, ['arrivals', 'predictions', 'times']);
    for (const row of rows) {
      const arrival = normalizeTransitArrival(row, fallbackLineId);
      if (arrival) arrivals.push(arrival);
    }
  }

  return {
    ...context,
    stopId,
    lineIds,
    arrivals,
  };
};

export const getTransitStations = async (
  city: TransitCity,
  uiMode: TransitUiMode,
): Promise<TransitStationGroup> => {
  const context = createContext(city, uiMode);
  const endpoint = buildStationsEndpoint(context);
  const response = await apiFetch(endpoint);

  await ensureOk(response, endpoint);
  const payload = await parseJson(response, endpoint);
  return normalizeTransitStationGroup(payload, context);
};

export const getTransitLines = async (
  city: TransitCity,
  uiMode: TransitUiMode,
  stopId: string,
): Promise<TransitLineGroup> => {
  const context = createContext(city, uiMode);
  const normalizedStopId = normalizeStopId(stopId);
  const endpoint = buildLinesEndpoint(context, normalizedStopId);
  const response = await apiFetch(endpoint);

  await ensureOk(response, endpoint);
  const payload = await parseJson(response, endpoint);
  return normalizeTransitLineGroup(payload, context, normalizedStopId);
};

export const getGlobalTransitLines = async (
  city: TransitCity,
  uiMode: TransitUiMode,
): Promise<TransitLineGroup> => {
  const context = createContext(city, uiMode);
  const endpoint = buildGlobalLinesEndpoint(context);
  const response = await apiFetch(endpoint);

  await ensureOk(response, endpoint);
  const payload = await parseJson(response, endpoint);
  return normalizeTransitLineGroup(payload, context, '');
};

export const getTransitStopsForLine = async (
  city: TransitCity,
  uiMode: TransitUiMode,
  lineId: string,
): Promise<TransitStationGroup> => {
  const normalizedLineId = normalizeString(lineId);
  if (!normalizedLineId) throw new Error('Transit API requires a non-empty lineId.');
  const context = createContext(city, uiMode);
  const endpoint = buildStopsByLineEndpoint(context, normalizedLineId);
  const response = await apiFetch(endpoint);
  await ensureOk(response, endpoint);
  const payload = await parseJson(response, endpoint);
  return normalizeTransitStationGroup(payload, context);
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

const inferMbtaModeFromStopId = (stopId: string): TransitBackendMode => {
  if (/^Boat-/i.test(stopId)) return 'ferry';
  if (/^\d+$/.test(stopId)) return 'bus';
  if (!/^place-/i.test(stopId)) return 'rail';
  return 'subway';
};

const resolveStationLookupContexts = (
  backendProvider: string,
  stopId: string,
  providerMode?: string | null,
): Array<{provider: string; mode: string; stopId: string}> => {
  const normalizedProviderMode = normalizeProviderMode(providerMode);
  if (normalizedProviderMode) {
    const [provider = '', mode = ''] = normalizedProviderMode.split('/', 2);
    if (provider && mode) {
      const normalizedStopId =
        provider === 'mta' && mode === 'subway' ? stopId.replace(/[NS]$/i, '') : stopId;
      return [{provider, mode, stopId: normalizedStopId}];
    }
  }

  if (backendProvider === 'mbta') {
    const orderedModes = Array.from(
      new Set<TransitBackendMode>([
        inferMbtaModeFromStopId(stopId),
        'subway',
        'rail',
        'bus',
      ]),
    );
    return orderedModes.map(mode => ({provider: 'mbta', mode, stopId}));
  }

  const context = resolveBackendProviderContext(backendProvider);
  if (!context) return [];

  return [{
    provider: context.provider,
    mode: context.mode,
    stopId:
      context.provider === 'mta' && context.mode === 'subway'
        ? stopId.replace(/[NS]$/i, '')
        : stopId,
  }];
};

export const getTransitStationName = async (
  backendProvider: string,
  stopId: string,
  providerMode?: string | null,
): Promise<string | null> => {
  const contexts = resolveStationLookupContexts(backendProvider, stopId, providerMode);
  for (const ctx of contexts) {
    const endpoint = `/${ctx.provider}/stations/${ctx.mode}/${encodeURIComponent(ctx.stopId)}/lines`;
    try {
      const response = await apiFetch(endpoint);
      if (!response.ok) continue;
      const payload = await response.json().catch(() => null);
      if (!isRecord(payload)) continue;
      const resolvedName = readFirstString(payload, ['name', 'station', 'stopName']);
      if (resolvedName) return resolvedName;
    } catch {
      // Keep trying fallback contexts.
    }
  }
  return null;
};

export const getTransitArrivals = async (
  city: TransitCity,
  uiMode: TransitUiMode,
  stopId: string,
  lineIds: readonly string[],
  options: {
    direction?: string;
  } = {},
): Promise<TransitArrivalGroup> => {
  const context = createContext(city, uiMode);
  const normalizedStopId = normalizeStopId(stopId);
  const normalizedLineIds = normalizeLineIds(lineIds);
  const endpoint = buildArrivalsEndpoint(context, normalizedStopId, normalizedLineIds, options);
  const response = await apiFetch(endpoint);

  await ensureOk(response, endpoint);
  const payload = await parseJson(response, endpoint);
  return normalizeTransitArrivalGroup(payload, context, normalizedStopId, normalizedLineIds);
};

const transitApi: TransitApi = {
  getTransitStations,
  getTransitLines,
  getTransitArrivals,
};

export default transitApi;
