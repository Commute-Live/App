import {normalizeCityId, type CityId} from '../../../constants/cities';
import {CITY_LINE_COLORS, FALLBACK_ROUTE_COLORS} from '../../../lib/lineColors';
import {getGlobalTransitLines, getTransitArrivals, getTransitLines, getTransitStations, getTransitStopsForLine} from '../../../lib/transitApi';
import type {
  ModeId,
  TransitRouteGroup,
  TransitRoutePickerItem,
  TransitRouteRecord,
  UiDirection,
} from '../../../lib/transit/frontendTypes';
import {
  getCityModeOrder,
  getTransitCityModule,
  isSupportedTransitCity,
  resolveBackendProviderId,
  resolveCityModeFromBackendProvider,
  SUPPORTED_TRANSIT_CITIES,
} from '../../../lib/transit/registry';
import {formatLocalRoutePickerLabel, getDefaultUiDirection, getLocalDirectionOptions, getLocalModeLabel, serializeUiDirection} from '../../../lib/transitUi';
import type {DisplayContent, DisplayFormat, TransitArrival, TransitStationLine, TransitUiMode} from '../../../types/transit';

type Station = {id: string; name: string; area: string; lines: TransitStationLine[]};
type Direction = UiDirection;
type Route = TransitRouteRecord;
type Arrival = {lineId: string; minutes: number; status: 'GOOD' | 'DELAYS'; destination: string | null};
type LinePick = {
  id: string;
  mode: ModeId;
  stationId: string;
  routeId: string;
  direction: Direction;
  label: string;
  secondaryLabel: string;
  textColor: string;
  nextStops: number;
  displayFormat: DisplayFormat;
  primaryContent: DisplayContent;
  secondaryContent: DisplayContent;
};
type StationsByMode = Partial<Record<ModeId, Station[]>>;
type RoutesByStation = Record<string, Route[]>;
type RoutePickerItem = TransitRoutePickerItem;
type RouteGroup = TransitRouteGroup;

const DEFAULT_TEXT_COLOR = '#E9ECEF';
const DEFAULT_NEXT_STOPS = 3;
const MIN_NEXT_STOPS = 1;
const MAX_NEXT_STOPS = 5;
const TIME_OPTIONS = ['00:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '17:00', '18:00', '20:00', '22:00', '23:00'];

export function resolveBackendProvider(c: CityId, mode: ModeId): string {
  if (!isSupportedTransitCity(c)) {
    throw new Error(`Transit provider lookup does not support city "${c}".`);
  }
  return resolveBackendProviderId(c, mode);
}

export function cityModeFromProvider(provider: string): {city: CityId; mode: ModeId} | null {
  return resolveCityModeFromBackendProvider(provider);
}

export function normalizeCityIdParam(value: string | undefined): CityId {
  return normalizeCityId(value);
}

export function isLiveCitySupported(city: CityId) {
  return SUPPORTED_TRANSIT_CITIES.includes(city);
}

export function getAvailableModes(city: CityId): ModeId[] {
  return getCityModeOrder(city) as ModeId[];
}

export function getModeLabel(city: CityId, mode: ModeId) {
  return getLocalModeLabel(city, mode);
}

function hasMode(city: CityId, mode: ModeId) {
  return getAvailableModes(city).includes(mode);
}

export function normalizeMode(city: CityId, mode: ModeId): ModeId {
  if (hasMode(city, mode)) return mode;
  return getAvailableModes(city)[0] ?? 'train';
}

export function routeLookupKey(mode: ModeId, stationId: string) {
  return `${mode}:${stationId}`;
}

export function resolveSelectedStationForLine(
  line: Pick<LinePick, 'mode' | 'routeId' | 'stationId'>,
  city: CityId,
  stationsByMode: StationsByMode,
  stationsByLine: Partial<Record<string, Station[]>>,
) {
  const mode = normalizeMode(city, line.mode);
  const lineStations = line.routeId ? (stationsByLine[line.routeId] ?? []) : [];
  const stationFromLine = lineStations.find(station => station.id === line.stationId);
  if (stationFromLine) return stationFromLine;
  return (stationsByMode[mode] ?? []).find(station => station.id === line.stationId);
}

export function areSameLinePicks(left: LinePick[], right: LinePick[]) {
  if (left.length !== right.length) return false;
  return left.every((line, idx) => {
    const other = right[idx];
    return (
      line.id === other.id
      && line.mode === other.mode
      && line.stationId === other.stationId
      && line.routeId === other.routeId
      && line.direction === other.direction
      && line.label === other.label
      && line.secondaryLabel === other.secondaryLabel
      && line.textColor === other.textColor
      && line.nextStops === other.nextStops
      && line.displayFormat === other.displayFormat
      && line.primaryContent === other.primaryContent
      && line.secondaryContent === other.secondaryContent
    );
  });
}

function lineColorFor(routeId: string) {
  let hash = 0;
  for (let idx = 0; idx < routeId.length; idx += 1) {
    hash = (hash * 31 + routeId.charCodeAt(idx)) >>> 0;
  }
  return FALLBACK_ROUTE_COLORS[hash % FALLBACK_ROUTE_COLORS.length];
}

function buildAreaFromName(name: string) {
  const splitAt = name.indexOf('-');
  if (splitAt === -1) return '';
  return name.slice(splitAt + 1).trim();
}

export function normalizeSavedStationId(provider: string, stopId: string) {
  const mapping = cityModeFromProvider(provider);
  if (mapping?.city) {
    const cityModule = getTransitCityModule(mapping.city);
    if (cityModule) return cityModule.normalizeSavedStationId(provider, stopId);
  }
  return stopId.trim().toUpperCase();
}

export function describePresetBehavior(displayPreset: number) {
  switch (displayPreset) {
    case 2:
      return {
        primary: 'Direction is used as the main label, with the primary ETA on the right.',
        secondary: 'This keeps the same base geometry as preset 1 but swaps the label behavior.',
      };
    case 3:
      return {
        primary: 'Direction appears on the first compact line, with destination underneath.',
        secondary: 'Use this when you want both direction and destination visible in one row.',
      };
    case 4:
      return {
        primary: 'Destination is used as the main label, with a compact extra-ETA line below.',
        secondary: 'The device uses this extra line for additional arrival times.',
      };
    case 5:
      return {
        primary: 'Direction is used as the main label, with a compact extra-ETA line below.',
        secondary: 'This combines the direction-first label with the extra arrivals strip.',
      };
    case 1:
    default:
      return {
        primary: 'Destination is used as the main label, with the primary ETA on the right.',
        secondary: 'This is the default firmware preset.',
      };
  }
}

function toTransitUiMode(mode: ModeId): TransitUiMode {
  return mode;
}

function sortStationsForPicker(stations: Station[]) {
  return [...stations].sort((left, right) => {
    const leftStreetNumber = extractLeadingStreetNumber(left.name);
    const rightStreetNumber = extractLeadingStreetNumber(right.name);
    if (leftStreetNumber !== null || rightStreetNumber !== null) {
      if (leftStreetNumber === null) return 1;
      if (rightStreetNumber === null) return -1;
      if (leftStreetNumber !== rightStreetNumber) return leftStreetNumber - rightStreetNumber;
    }

    const nameCompare = left.name.localeCompare(right.name, undefined, {numeric: true, sensitivity: 'base'});
    if (nameCompare !== 0) return nameCompare;

    const areaCompare = left.area.localeCompare(right.area, undefined, {numeric: true, sensitivity: 'base'});
    if (areaCompare !== 0) return areaCompare;

    return left.id.localeCompare(right.id, undefined, {numeric: true, sensitivity: 'base'});
  });
}

function extractLeadingStreetNumber(name: string): number | null {
  const match = name.match(/\b(\d{1,3})(?:ST|ND|RD|TH)?\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export async function loadStopsForLine(city: CityId, mode: ModeId, lineId: string): Promise<Station[]> {
  const response = await getTransitStopsForLine(city, toTransitUiMode(mode), lineId);
  return sortStationsForPicker(response.stations.map(station => ({
    id: station.id,
    name: station.name,
    area: station.area ?? buildAreaFromName(station.name),
    lines: station.lines,
  })));
}

export async function loadStationsForCityMode(city: CityId, mode: ModeId): Promise<Station[]> {
  const response = await getTransitStations(city, toTransitUiMode(mode));
  return sortStationsForPicker(response.stations.map(station => ({
    id: station.id,
    name: station.name,
    area: station.area ?? buildAreaFromName(station.name),
    lines: station.lines,
  })));
}

function resolveMappedRouteAppearance(city: CityId, mode: ModeId, lineId: string, label?: string | null) {
  const map = CITY_LINE_COLORS[city];
  if (!map) return null;

  const preferLabelFirst = city === 'new-york' && (mode === 'lirr' || mode === 'mnr');
  const candidates = preferLabelFirst
    ? [label ?? '', (label ?? '').toUpperCase(), lineId, lineId.toUpperCase()].filter(Boolean)
    : [lineId, label ?? '', lineId.toUpperCase(), (label ?? '').toUpperCase()].filter(Boolean);
  for (const candidate of candidates) {
    const appearance = map[candidate];
    if (appearance) return appearance;
  }

  return null;
}

function resolveRouteColor(city: CityId, mode: ModeId, lineId: string, label: string | null, apiColor: string | null): string {
  const cityModule = getTransitCityModule(city);
  const appearance = cityModule?.resolveRouteAppearance?.(mode, lineId, label);
  if (appearance) return appearance.color;

  const mapped = resolveMappedRouteAppearance(city, mode, lineId, label);
  if (mapped) return mapped.color;
  if (apiColor) return apiColor;
  return lineColorFor(lineId);
}

function resolveRouteTextColor(city: CityId, mode: ModeId, lineId: string, label: string | null, apiTextColor: string | null): string {
  const cityModule = getTransitCityModule(city);
  const appearance = cityModule?.resolveRouteAppearance?.(mode, lineId, label);
  if (appearance) return appearance.textColor;

  const mapped = resolveMappedRouteAppearance(city, mode, lineId, label);
  if (mapped) return mapped.textColor;
  if (apiTextColor) return apiTextColor;
  return '#FFFFFF';
}

export function formatRoutePickerLabel(city: CityId, mode: ModeId, route: Route) {
  return formatLocalRoutePickerLabel(city, mode, route.id, route.label);
}

export function isNycBusBadge(city: CityId, mode: ModeId) {
  return getTransitCityModule(city)?.isBusBadge?.(mode) ?? false;
}

export async function loadRoutesForStation(city: CityId, mode: ModeId, stopId: string): Promise<Route[]> {
  const response = await getTransitLines(city, toTransitUiMode(mode), stopId);
  return response.lines.map(line => ({
    id: line.id,
    label: line.label || line.id,
    color: resolveRouteColor(city, mode, line.id, line.label, line.color),
    textColor: resolveRouteTextColor(city, mode, line.id, line.label, line.textColor),
    headsign0: line.headsign0,
    headsign1: line.headsign1,
    directions: line.directions,
  }));
}

export async function loadGlobalLinesForCityMode(city: CityId, mode: ModeId): Promise<Route[]> {
  const response = await getGlobalTransitLines(city, toTransitUiMode(mode));
  return response.lines.map(line => ({
    id: line.id,
    label: line.label || line.id,
    color: resolveRouteColor(city, mode, line.id, line.label, line.color),
    textColor: resolveRouteTextColor(city, mode, line.id, line.label, line.textColor),
    headsign0: line.headsign0,
    headsign1: line.headsign1,
    directions: line.directions,
  }));
}

function naturalRouteLabelCompare(left: string, right: string) {
  return left.localeCompare(right, undefined, {numeric: true, sensitivity: 'base'});
}

function normalizeRoutePickerLabel(route: {label: string}) {
  return route.label.trim().toUpperCase();
}

function compareDuplicateRouteCandidates(left: Route, right: Route) {
  const leftLabel = normalizeRoutePickerLabel(left);
  const rightLabel = normalizeRoutePickerLabel(right);
  const leftExact = left.id.toUpperCase() === leftLabel ? 0 : 1;
  const rightExact = right.id.toUpperCase() === rightLabel ? 0 : 1;
  if (leftExact !== rightExact) return leftExact - rightExact;

  if (left.id.length !== right.id.length) return left.id.length - right.id.length;

  return naturalRouteLabelCompare(left.id, right.id);
}

function dedupeRoutesForPicker(routes: Route[]): Route[] {
  const seen = new Map<string, Route>();

  for (const route of routes) {
    const key = normalizeRoutePickerLabel(route);
    const existing = seen.get(key);
    if (!existing || compareDuplicateRouteCandidates(route, existing) < 0) {
      seen.set(key, route);
    }
  }

  return [...seen.values()];
}

function sortRoutesForPicker(routes: Route[]): Route[] {
  return [...routes].sort((left, right) => {
    const colorCompare = left.color.localeCompare(right.color);
    if (colorCompare !== 0) return colorCompare;

    const labelCompare = naturalRouteLabelCompare(left.label, right.label);
    if (labelCompare !== 0) return labelCompare;

    return naturalRouteLabelCompare(left.id, right.id);
  });
}

function sortRoutesAlphabetically(routes: Route[]): Route[] {
  return [...routes].sort((left, right) => {
    const labelCompare = naturalRouteLabelCompare(left.label, right.label);
    if (labelCompare !== 0) return labelCompare;
    return naturalRouteLabelCompare(left.id, right.id);
  });
}

export function prepareRouteEntriesForPicker(city: CityId, mode: ModeId, routes: Route[]) {
  const deduped = dedupeRoutesForPicker(routes);
  const cityModule = getTransitCityModule(city);
  const prepared = cityModule?.prepareRouteEntries(mode, deduped);
  if (prepared) return prepared;
  return sortRoutesForPicker(deduped).map(route => routeToPickerItem(route, city, mode));
}

function routeToPickerItem(route: Route, city: CityId, mode: ModeId): RoutePickerItem {
  return {
    id: route.id,
    label: route.label,
    displayLabel: formatRoutePickerLabel(city, mode, route),
    color: route.color,
    textColor: route.textColor,
    routes: [route],
  };
}

export function buildRouteGroups(city: CityId, mode: ModeId, routes: RoutePickerItem[]): RouteGroup[] {
  const cityModule = getTransitCityModule(city);
  const cityGroups = cityModule?.buildRouteGroups(mode, routes);
  if (cityGroups) return cityGroups;

  const fallbackGroups: Array<{key: string; routes: RoutePickerItem[]}> = [];

  for (const route of routes) {
    const current = fallbackGroups[fallbackGroups.length - 1];
    if (!current || current.key !== route.color) {
      fallbackGroups.push({key: route.color, routes: [route]});
      continue;
    }
    current.routes.push(route);
  }

  return fallbackGroups;
}

export function isExpressRouteBadge(city: CityId, mode: ModeId, route: RoutePickerItem) {
  return getTransitCityModule(city)?.isExpressRouteBadge?.(mode, route) ?? false;
}

export function isExpressVariant(route: Route) {
  return getTransitCityModule('new-york')?.isExpressVariant?.('train', route) ?? false;
}

function statusFromArrival(arrival: TransitArrival): Arrival['status'] {
  const raw = (arrival.status ?? '').toUpperCase();
  if (raw.includes('DELAY')) return 'DELAYS';
  return 'GOOD';
}

function getArrivalDirectionParam(city: CityId, line: LinePick): string | undefined {
  if (city === 'philadelphia' && line.mode === 'train') {
    return undefined;
  }
  return serializeUiDirection(city, line.mode, line.direction);
}

export async function loadArrivalForSelection(city: CityId, line: LinePick): Promise<Omit<Arrival, 'lineId'> | null> {
  if (!line.stationId.trim() || !line.routeId.trim()) return null;
  const response = await getTransitArrivals(
    city,
    toTransitUiMode(line.mode),
    line.stationId,
    [line.routeId],
    {direction: getArrivalDirectionParam(city, line)},
  );
  if (response.arrivals.length === 0) return null;

  const matched = response.arrivals.filter(arrival => arrival.lineId === line.routeId);
  const candidates = matched.length > 0 ? matched : response.arrivals;
  const sorted = [...candidates].sort((a, b) => {
    const left = typeof a.minutes === 'number' ? a.minutes : Number.MAX_SAFE_INTEGER;
    const right = typeof b.minutes === 'number' ? b.minutes : Number.MAX_SAFE_INTEGER;
    return left - right;
  });
  const nextArrival = sorted[0];
  if (!nextArrival || typeof nextArrival.minutes !== 'number') return null;

  return {
    minutes: Math.max(0, Math.round(nextArrival.minutes)),
    status: statusFromArrival(nextArrival),
    destination: nextArrival.destination ?? null,
  };
}

export function mergeArrivals(existing: Arrival[], updates: Arrival[], lines: LinePick[]): Arrival[] {
  const updateMap = new Map<string, Arrival>();
  updates.forEach(update => updateMap.set(update.lineId, update));
  return lines.map(line => {
    const fallback: Arrival = {lineId: line.id, minutes: 0, status: 'GOOD', destination: null};
    return updateMap.get(line.id) ?? existing.find(item => item.lineId === line.id) ?? fallback;
  });
}

function newLine(
  city: CityId,
  mode: ModeId,
  id: string,
  stationsByMode: StationsByMode,
  routesByStation: RoutesByStation,
): LinePick {
  const safeMode = normalizeMode(city, mode);
  const stations = stationsByMode[safeMode] ?? [];
  const firstStation = stations[0];
  const routes = firstStation ? routesByStation[routeLookupKey(safeMode, firstStation.id)] ?? [] : [];
  const firstRoute = routes[0];

  return normalizeLine(
    city,
    {
      id,
      mode: safeMode,
      stationId: firstStation?.id ?? '',
      routeId: firstRoute?.id ?? '',
      direction: getDefaultUiDirection(city, safeMode, firstRoute),
      label: '',
      secondaryLabel: '',
      textColor: DEFAULT_TEXT_COLOR,
      nextStops: DEFAULT_NEXT_STOPS,
      displayFormat: 'single-line' as DisplayFormat,
      primaryContent: 'destination' as DisplayContent,
      secondaryContent: 'direction' as DisplayContent,
    },
    stationsByMode,
    routesByStation,
  );
}

export function normalizeLine(
  city: CityId,
  line: LinePick,
  stationsByMode: StationsByMode,
  routesByStation: RoutesByStation,
): LinePick {
  const safeMode = normalizeMode(city, line.mode);
  const stations = stationsByMode[safeMode] ?? [];
  const station = stations.find(item => item.id === line.stationId);
  const resolvedStationId = station?.id ?? line.stationId;

  const routeKey = resolvedStationId ? routeLookupKey(safeMode, resolvedStationId) : null;
  const routes = routeKey ? (routesByStation[routeKey] ?? []) : [];
  const stationLineIds = station ? station.lines.map(l => l.id) : [];
  const allowedRoutes = station && stationLineIds.length > 0 ? routes.filter(route => stationLineIds.includes(route.id)) : routes;
  const routesLoaded = routes.length > 0;
  const routeMatch = allowedRoutes.find(item => item.id === line.routeId);
  const resolvedRouteId = routeMatch?.id ?? (routesLoaded ? (allowedRoutes[0]?.id ?? routes[0]?.id ?? line.routeId) : line.routeId);
  const resolvedRoute = routeMatch ?? (routesLoaded ? (allowedRoutes[0] ?? routes[0]) : undefined);
  const directionOptions = getLocalDirectionOptions(city, safeMode, resolvedRoute);
  const resolvedDirection = directionOptions.includes(line.direction) ? line.direction : (directionOptions[0] ?? line.direction);
  const displayFormat = normalizeDisplayFormat(line.displayFormat);

  return {
    ...line,
    mode: safeMode,
    stationId: resolvedStationId,
    routeId: resolvedRouteId,
    direction: resolvedDirection,
    label: normalizeCustomLabel(line.label),
    secondaryLabel: normalizeCustomLabel(line.secondaryLabel),
    textColor: normalizeHexColor(line.textColor) ?? DEFAULT_TEXT_COLOR,
    nextStops: clampNextStops(line.nextStops),
    displayFormat,
    primaryContent: normalizePrimaryContent(displayFormat, line.primaryContent, line.displayFormat),
    secondaryContent: normalizeSecondaryContent(displayFormat, line.secondaryContent, line.displayFormat),
  };
}

function seedDefaultLines(city: CityId, stationsByMode: StationsByMode, routesByStation: RoutesByStation): LinePick[] {
  const modes = getAvailableModes(city);
  const primary = modes[0] ?? 'train';
  const defaults = [newLine(city, primary, 'line-1', stationsByMode, routesByStation)];
  defaults.push(newLine(city, primary, 'line-2', stationsByMode, routesByStation));
  return defaults;
}

export function ensureLineCount(
  existing: LinePick[],
  city: CityId,
  slots: number,
  stationsByMode: StationsByMode,
  routesByStation: RoutesByStation,
): LinePick[] {
  const next: LinePick[] = [];
  const defaults = seedDefaultLines(city, stationsByMode, routesByStation);
  for (let index = 0; index < slots; index += 1) {
    const id = `line-${index + 1}`;
    const fromExisting = existing.find(line => line.id === id);
    if (fromExisting) {
      next.push(normalizeLine(city, {...fromExisting, id}, stationsByMode, routesByStation));
      continue;
    }

    const defaultLine = defaults[index] ?? defaults[0];
    if (defaultLine) {
      next.push({...defaultLine, id});
      continue;
    }
    next.push(newLine(city, 'train', id, stationsByMode, routesByStation));
  }
  return next;
}

export function syncArrivals(existing: Arrival[], lines: LinePick[]): Arrival[] {
  return lines.map(line => {
    const found = existing.find(item => item.lineId === line.id);
    if (found) return found;
    return {
      lineId: line.id,
      minutes: 0,
      status: 'GOOD',
      destination: null,
    };
  });
}

export function clampNextStops(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_NEXT_STOPS;
  return Math.min(MAX_NEXT_STOPS, Math.max(MIN_NEXT_STOPS, Math.round(value)));
}

export function normalizeDisplayFormat(value: string | undefined | null): DisplayFormat {
  switch (value) {
    case 'single-line':
    case 'two-line':
    case 'times-line':
      return value;
    case 'direction-single':
    case 'headsign-single':
      return 'single-line';
    case 'both-single':
    case 'both-single-flip':
      return 'two-line';
    case 'headsign-multi':
    case 'direction-multi':
      return 'times-line';
    default:
      return 'single-line';
  }
}

export function normalizePrimaryContent(
  displayFormat: DisplayFormat,
  value: DisplayContent | undefined | null,
  legacyFormat?: string | null,
): DisplayContent {
  if (value === 'direction' || value === 'custom' || value === 'destination' || value === 'headsign') return value;
  if (legacyFormat === 'direction-single' || legacyFormat === 'both-single' || legacyFormat === 'direction-multi') {
    return 'direction';
  }
  if (legacyFormat === 'headsign-single' || legacyFormat === 'headsign-multi') {
    return 'headsign';
  }
  return 'destination';
}

export function normalizeSecondaryContent(
  displayFormat: DisplayFormat,
  value: DisplayContent | undefined | null,
  legacyFormat?: string | null,
): DisplayContent {
  if (displayFormat !== 'two-line') return 'direction';
  if (value === 'direction' || value === 'custom' || value === 'destination' || value === 'headsign') return value;
  if (legacyFormat === 'both-single') return 'destination';
  if (legacyFormat === 'both-single-flip') return 'direction';
  return 'direction';
}

export function resolveDisplayContent(
  content: DisplayContent,
  destinationLabel: string,
  directionLabel: string,
  headsignLabel: string,
  customLabel: string,
) {
  if (content === 'direction') return directionLabel;
  if (content === 'headsign') return headsignLabel || directionLabel || destinationLabel;
  if (content === 'custom') return customLabel || destinationLabel;
  return destinationLabel;
}

export function cycleTimeOption(current: string, delta: 1 | -1) {
  const index = TIME_OPTIONS.indexOf(current);
  const safeIndex = index === -1 ? 0 : index;
  const nextIndex = (safeIndex + delta + TIME_OPTIONS.length) % TIME_OPTIONS.length;
  return TIME_OPTIONS[nextIndex];
}

function normalizeCustomLabel(value: string | undefined | null) {
  if (typeof value !== 'string') return '';
  return value.trim().length > 0 ? value : '';
}

function normalizeHexColor(value: string | undefined | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return null;
  return `#${match[1].toUpperCase()}`;
}

export function buildNextArrivalTimes(firstMinutes: number, count: number): string[] {
  const safeCount = clampNextStops(count);
  const times: string[] = [];
  let current = Math.max(1, Math.round(firstMinutes)) + 2;
  for (let idx = 0; idx < safeCount; idx += 1) {
    times.push(`${current}m`);
    current += 2;
  }
  return times;
}
