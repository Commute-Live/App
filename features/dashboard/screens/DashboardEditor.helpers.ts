import {normalizeCityId, type CityId} from '../../../constants/cities';
import {CITY_LINE_COLORS, FALLBACK_ROUTE_COLORS} from '../../../lib/lineColors';
import {getGlobalTransitLines, getTransitArrivals, getTransitLines, getTransitStations, getTransitStopsForLine} from '../../../lib/transitApi';
import type {DisplayContent, DisplayFormat, TransitArrival, TransitUiMode} from '../../../types/transit';

type ModeId = 'train' | 'bus' | 'trolley' | 'commuter-rail' | 'ferry';
type Direction = 'uptown' | 'downtown';
type Station = {id: string; name: string; area: string; lines: string[]};
type Route = {id: string; label: string; color: string; textColor?: string};
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
type RoutePickerItem = {id: string; label: string; displayLabel: string; color: string; textColor?: string; routes: Route[]};
type RouteGroup = {key: string; title?: string; routes: RoutePickerItem[]};

const DEFAULT_TEXT_COLOR = '#E9ECEF';
const DEFAULT_NEXT_STOPS = 3;
const MIN_NEXT_STOPS = 2;
const MAX_NEXT_STOPS = 5;
const TIME_OPTIONS = ['00:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '17:00', '18:00', '20:00', '22:00', '23:00'];
const MODE_ORDER: ModeId[] = ['train', 'bus', 'trolley', 'commuter-rail', 'ferry'];
const LIVE_SUPPORTED_CITIES: CityId[] = ['new-york', 'philadelphia', 'boston', 'chicago'];
const CITY_MODE_ORDER: Record<CityId, ModeId[]> = {
  'new-york': ['train', 'bus', 'commuter-rail'],
  philadelphia: ['train', 'trolley', 'bus'],
  boston: ['train', 'bus', 'commuter-rail', 'ferry'],
  chicago: ['train', 'bus'],
};

export function resolveBackendProvider(c: CityId, mode: ModeId): string {
  if (c === 'new-york') {
    if (mode === 'bus') return 'mta-bus';
    if (mode === 'commuter-rail') return 'mta-lirr';
    return 'mta-subway';
  }
  if (c === 'philadelphia') {
    if (mode === 'bus') return 'septa-bus';
    if (mode === 'trolley') return 'septa-trolley';
    return 'septa-rail';
  }
  if (c === 'chicago') {
    if (mode === 'bus') return 'cta-bus';
    return 'cta-subway';
  }
  return 'mbta';
}

export function cityModeFromProvider(provider: string): {city: CityId; mode: ModeId} | null {
  const map: Record<string, {city: CityId; mode: ModeId}> = {
    'mta-subway': {city: 'new-york', mode: 'train'},
    'mta-bus': {city: 'new-york', mode: 'bus'},
    'mta-lirr': {city: 'new-york', mode: 'commuter-rail'},
    'septa-rail': {city: 'philadelphia', mode: 'train'},
    'septa-bus': {city: 'philadelphia', mode: 'bus'},
    'septa-trolley': {city: 'philadelphia', mode: 'trolley'},
    mbta: {city: 'boston', mode: 'train'},
    'cta-subway': {city: 'chicago', mode: 'train'},
    'cta-bus': {city: 'chicago', mode: 'bus'},
  };
  return map[provider] ?? null;
}

export function normalizeCityIdParam(value: string | undefined): CityId {
  return normalizeCityId(value);
}

export function isLiveCitySupported(city: CityId) {
  return LIVE_SUPPORTED_CITIES.includes(city);
}

export function getAvailableModes(city: CityId): ModeId[] {
  const order = CITY_MODE_ORDER[city] ?? MODE_ORDER;
  return order.filter(mode => hasMode(city, mode));
}

export function getModeLabel(city: CityId, mode: ModeId) {
  if (mode === 'train') return city === 'philadelphia' ? 'Rail' : 'Subway';
  if (mode === 'bus') return 'Bus';
  if (mode === 'trolley') return 'Trolley';
  if (mode === 'ferry') return 'Ferry';
  return 'Commuter Rail';
}

function hasMode(city: CityId, mode: ModeId) {
  const order = CITY_MODE_ORDER[city] ?? MODE_ORDER;
  return order.includes(mode);
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
  const normalizedProvider = provider.trim().toLowerCase();
  const normalizedStopId = stopId.trim().toUpperCase();
  if (normalizedProvider === 'mta-subway' && /[NS]$/.test(normalizedStopId)) {
    return normalizedStopId.slice(0, -1);
  }
  return normalizedStopId;
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

export async function loadStopsForLine(city: CityId, mode: ModeId, lineId: string): Promise<Station[]> {
  const response = await getTransitStopsForLine(city, toTransitUiMode(mode), lineId);
  return response.stations.map(station => ({
    id: station.id,
    name: station.name,
    area: station.area ?? buildAreaFromName(station.name),
    lines: station.lines,
  }));
}

export async function loadStationsForCityMode(city: CityId, mode: ModeId): Promise<Station[]> {
  const response = await getTransitStations(city, toTransitUiMode(mode));
  return response.stations.map(station => ({
    id: station.id,
    name: station.name,
    area: station.area ?? buildAreaFromName(station.name),
    lines: station.lines,
  }));
}

function resolveMappedRouteAppearance(city: CityId, lineId: string, label?: string | null) {
  const map = CITY_LINE_COLORS[city];
  if (!map) return null;

  const candidates = [lineId, label ?? '', lineId.toUpperCase(), (label ?? '').toUpperCase()].filter(Boolean);
  for (const candidate of candidates) {
    const appearance = map[candidate];
    if (appearance) return appearance;
  }

  return null;
}

function resolveNycBusAppearance(lineId: string, label?: string | null) {
  const normalized = `${lineId} ${label ?? ''}`.toUpperCase();

  if (normalized.includes('SBS') || normalized.includes('SELECT BUS')) {
    return {color: '#00A1DE', textColor: '#FFFFFF'};
  }

  if (normalized.includes('LTD') || normalized.includes('LIMITED')) {
    return {color: '#EE352E', textColor: '#FFFFFF'};
  }

  if (normalized.startsWith('BM') || normalized.startsWith('QM') || normalized.startsWith('X') || normalized.startsWith('SIM')) {
    return {color: '#006B3F', textColor: '#FFFFFF'};
  }

  return {color: '#0039A6', textColor: '#FFFFFF'};
}

function resolveRouteColor(city: CityId, mode: ModeId, lineId: string, label: string | null, apiColor: string | null): string {
  if (city === 'new-york' && mode === 'bus') {
    return resolveNycBusAppearance(lineId, label).color;
  }

  const mapped = resolveMappedRouteAppearance(city, lineId, label);
  if (mapped) return mapped.color;
  if (apiColor) return apiColor;
  return lineColorFor(lineId);
}

function resolveRouteTextColor(city: CityId, mode: ModeId, lineId: string, label: string | null, apiTextColor: string | null): string {
  if (city === 'new-york' && mode === 'bus') {
    return resolveNycBusAppearance(lineId, label).textColor;
  }

  const mapped = resolveMappedRouteAppearance(city, lineId, label);
  if (mapped) return mapped.textColor;
  if (apiTextColor) return apiTextColor;
  return '#FFFFFF';
}

export function formatRoutePickerLabel(city: CityId, mode: ModeId, route: Route) {
  if (city === 'new-york' && mode === 'bus') {
    return route.label.replace(/-?SBS\b/gi, '+').replace(/\s+/g, '');
  }

  return route.label;
}

export function isNycBusBadge(city: CityId, mode: ModeId) {
  return city === 'new-york' && mode === 'bus';
}

export async function loadRoutesForStation(city: CityId, mode: ModeId, stopId: string): Promise<Route[]> {
  const response = await getTransitLines(city, toTransitUiMode(mode), stopId);
  return response.lines.map(line => ({
    id: line.id,
    label: line.label || line.id,
    color: resolveRouteColor(city, mode, line.id, line.label, line.color),
    textColor: resolveRouteTextColor(city, mode, line.id, line.label, line.textColor),
  }));
}

export async function loadGlobalLinesForCityMode(city: CityId, mode: ModeId): Promise<Route[]> {
  const response = await getGlobalTransitLines(city, toTransitUiMode(mode));
  return response.lines.map(line => ({
    id: line.id,
    label: line.label || line.id,
    color: resolveRouteColor(city, mode, line.id, line.label, line.color),
    textColor: resolveRouteTextColor(city, mode, line.id, line.label, line.textColor),
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

export function prepareRouteEntriesForPicker(city: CityId, mode: ModeId, routes: Route[]) {
  const deduped = dedupeRoutesForPicker(routes);
  if (city === 'new-york' && mode === 'train') {
    return buildNycTrainPickerEntries(deduped);
  }
  if (city === 'new-york' && mode === 'bus') {
    return sortRoutesForNycBusPicker(deduped).map(route => routeToPickerItem(route, city, mode));
  }
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

function getNycTrainGroupOrder() {
  const groups = [
    ['1', '2', '3'],
    ['A', 'C', 'E'],
    ['4', '5', '6', '6X'],
    ['N', 'Q', 'R', 'W'],
    ['B', 'D', 'F', 'M'],
    ['7', '7X'],
    ['G', 'J', 'Z', 'L', 'S', 'FS', 'GS', 'SI'],
  ];

  const order = new Map<string, number>();
  groups.forEach((labels, index) => {
    labels.forEach(label => order.set(label, index));
  });
  return order;
}

function getNycTrainBaseLabel(route: Route) {
  const label = normalizeRoutePickerLabel(route);
  if (label === 'FX') return 'F';
  if (label.endsWith('X') && /^\d/.test(label)) return label.slice(0, -1);
  return label;
}

function buildNycTrainPickerEntries(routes: Route[]) {
  const grouped = new Map<string, Route[]>();

  for (const route of routes) {
    const key = getNycTrainBaseLabel(route);
    const current = grouped.get(key) ?? [];
    current.push(route);
    grouped.set(key, current);
  }

  return [...grouped.entries()]
    .map(([key, variants]) => {
      const sortedVariants = [...variants].sort((left, right) => {
        const leftPriority = isExpressVariant(left) ? 1 : 0;
        const rightPriority = isExpressVariant(right) ? 1 : 0;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return naturalRouteLabelCompare(left.label, right.label);
      });
      const primary = sortedVariants[0];
      return {
        id: key,
        label: key,
        displayLabel: key,
        color: primary.color,
        textColor: primary.textColor,
        routes: sortedVariants,
      };
    })
    .sort((left, right) => {
      const leftGroup = getNycTrainGroupOrder().get(left.label.toUpperCase()) ?? 999;
      const rightGroup = getNycTrainGroupOrder().get(right.label.toUpperCase()) ?? 999;
      if (leftGroup !== rightGroup) return leftGroup - rightGroup;
      return naturalRouteLabelCompare(left.label, right.label);
    });
}

export function buildRouteGroups(city: CityId, mode: ModeId, routes: RoutePickerItem[]): RouteGroup[] {
  if (city === 'new-york' && mode === 'train') {
    return buildNycTrainRouteGroups(routes);
  }
  if (city === 'new-york' && mode === 'bus') {
    return buildNycBusRouteGroups(routes);
  }

  const groups: Array<{key: string; routes: RoutePickerItem[]}> = [];

  for (const route of routes) {
    const current = groups[groups.length - 1];
    if (!current || current.key !== route.color) {
      groups.push({key: route.color, routes: [route]});
      continue;
    }
    current.routes.push(route);
  }

  return groups;
}

function buildNycTrainRouteGroups(routes: RoutePickerItem[]): RouteGroup[] {
  const groups = [
    {key: '123', labels: new Set(['1', '2', '3'])},
    {key: 'ace', labels: new Set(['A', 'C', 'E'])},
    {key: '456', labels: new Set(['4', '5', '6', '6X'])},
    {key: 'nqrw', labels: new Set(['N', 'Q', 'R', 'W'])},
    {key: 'bdfm', labels: new Set(['B', 'D', 'F', 'M'])},
    {key: '7', labels: new Set(['7', '7X'])},
    {key: 'jz', labels: new Set(['J', 'Z'])},
    {key: 'ls', labels: new Set(['L', 'S', 'FS', 'GS'])},
    {key: 'other', labels: new Set(['G', 'SI'])},
  ];

  return groups
    .map(group => {
      const groupRoutes = routes.filter(route => group.labels.has(normalizeRoutePickerLabel(route)));
      return {
        key: group.key,
        routes: group.key === 'other'
          ? [...groupRoutes].sort((left, right) => (sortRoutesForPicker(left.routes.concat(right.routes)).length ? naturalRouteLabelCompare(left.label, right.label) : 0))
          : groupRoutes,
      };
    })
    .filter(group => group.routes.length > 0);
}

function normalizeBusLabel(route: {label: string}) {
  return normalizeRoutePickerLabel(route).replace(/\s+/g, '');
}

function getNycBusGroupKey(route: {label: string}) {
  const label = normalizeBusLabel(route);
  if (label.startsWith('BX')) return 'bronx';
  if (label.startsWith('B')) return 'brooklyn';
  if (label.startsWith('M')) return 'manhattan';
  if (label.startsWith('Q')) return 'queens';
  if (label.startsWith('S')) return 'staten-island';
  return 'other';
}

function getNycBusGroupTitle(key: string) {
  switch (key) {
    case 'bronx':
      return 'Bronx';
    case 'brooklyn':
      return 'Brooklyn';
    case 'manhattan':
      return 'Manhattan';
    case 'queens':
      return 'Queens';
    case 'staten-island':
      return 'Staten Island';
    default:
      return 'Other';
  }
}

function getNycBusGroupOrder(key: string) {
  switch (key) {
    case 'bronx':
      return 0;
    case 'brooklyn':
      return 1;
    case 'manhattan':
      return 2;
    case 'queens':
      return 3;
    case 'staten-island':
      return 4;
    default:
      return 5;
  }
}

function getBusRouteSortParts(route: {label: string}) {
  const label = normalizeBusLabel(route);
  const match = label.match(/^([A-Z]+)(\d+)?([A-Z]*)$/);
  if (!match) {
    return {prefix: label, number: Number.MAX_SAFE_INTEGER, suffix: ''};
  }

  return {
    prefix: match[1],
    number: match[2] ? Number(match[2]) : Number.MAX_SAFE_INTEGER,
    suffix: match[3] ?? '',
  };
}

function sortRoutesForNycBusPicker(routes: Route[]) {
  return [...routes].sort((left, right) => {
    const leftGroup = getNycBusGroupOrder(getNycBusGroupKey(left));
    const rightGroup = getNycBusGroupOrder(getNycBusGroupKey(right));
    if (leftGroup !== rightGroup) return leftGroup - rightGroup;

    const leftParts = getBusRouteSortParts(left);
    const rightParts = getBusRouteSortParts(right);

    const prefixCompare = naturalRouteLabelCompare(leftParts.prefix, rightParts.prefix);
    if (prefixCompare !== 0) return prefixCompare;

    if (leftParts.number !== rightParts.number) return leftParts.number - rightParts.number;

    const suffixCompare = naturalRouteLabelCompare(leftParts.suffix, rightParts.suffix);
    if (suffixCompare !== 0) return suffixCompare;

    return naturalRouteLabelCompare(left.label, right.label);
  });
}

function buildNycBusRouteGroups(routes: RoutePickerItem[]): RouteGroup[] {
  const grouped = new Map<string, RoutePickerItem[]>();

  for (const route of routes) {
    const key = getNycBusGroupKey(route);
    const current = grouped.get(key) ?? [];
    current.push(route);
    grouped.set(key, current);
  }

  return [...grouped.entries()]
    .sort((left, right) => getNycBusGroupOrder(left[0]) - getNycBusGroupOrder(right[0]))
    .map(([key, groupRoutes]) => ({
      key,
      title: getNycBusGroupTitle(key),
      routes: [...groupRoutes].sort((left, right) => {
        const leftParts = getBusRouteSortParts(left);
        const rightParts = getBusRouteSortParts(right);
        const prefixCompare = naturalRouteLabelCompare(leftParts.prefix, rightParts.prefix);
        if (prefixCompare !== 0) return prefixCompare;
        if (leftParts.number !== rightParts.number) return leftParts.number - rightParts.number;
        const suffixCompare = naturalRouteLabelCompare(leftParts.suffix, rightParts.suffix);
        if (suffixCompare !== 0) return suffixCompare;
        return naturalRouteLabelCompare(left.label, right.label);
      }),
    }))
    .filter(group => group.routes.length > 0);
}

export function isExpressVariant(route: {label: string}) {
  const label = normalizeRoutePickerLabel(route);
  return label.endsWith('X') || label === 'FX';
}

export function isExpressRouteBadge(city: CityId, mode: ModeId, route: RoutePickerItem) {
  if (city !== 'new-york' || mode !== 'train') return false;
  return route.routes.length === 1 && isExpressVariant(route.routes[0]);
}

function statusFromArrival(arrival: TransitArrival): Arrival['status'] {
  const raw = (arrival.status ?? '').toUpperCase();
  if (raw.includes('DELAY')) return 'DELAYS';
  return 'GOOD';
}

export async function loadArrivalForSelection(city: CityId, line: LinePick): Promise<Omit<Arrival, 'lineId'> | null> {
  if (!line.stationId.trim() || !line.routeId.trim()) return null;
  const response = await getTransitArrivals(city, toTransitUiMode(line.mode), line.stationId, [line.routeId]);
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
      direction: 'uptown',
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
  const allowedRoutes = station && station.lines.length > 0 ? routes.filter(route => station.lines.includes(route.id)) : routes;
  const routesLoaded = routes.length > 0;
  const routeMatch = allowedRoutes.find(item => item.id === line.routeId);
  const resolvedRouteId = routeMatch?.id ?? (routesLoaded ? (allowedRoutes[0]?.id ?? routes[0]?.id ?? line.routeId) : line.routeId);
  const displayFormat = normalizeDisplayFormat(line.displayFormat);

  return {
    ...line,
    mode: safeMode,
    stationId: resolvedStationId,
    routeId: resolvedRouteId,
    direction: line.direction === 'downtown' ? 'downtown' : 'uptown',
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
  if (value === 'direction' || value === 'custom' || value === 'destination') return value;
  if (legacyFormat === 'direction-single' || legacyFormat === 'both-single' || legacyFormat === 'direction-multi') {
    return 'direction';
  }
  return 'destination';
}

export function normalizeSecondaryContent(
  displayFormat: DisplayFormat,
  value: DisplayContent | undefined | null,
  legacyFormat?: string | null,
): DisplayContent {
  if (displayFormat !== 'two-line') return 'direction';
  if (value === 'direction' || value === 'custom' || value === 'destination') return value;
  if (legacyFormat === 'both-single') return 'destination';
  if (legacyFormat === 'both-single-flip') return 'direction';
  return 'direction';
}

export function resolveDisplayContent(
  content: DisplayContent,
  destinationLabel: string,
  directionLabel: string,
  customLabel: string,
) {
  if (content === 'direction') return directionLabel;
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
  let current = Math.max(1, Math.round(firstMinutes));
  for (let idx = 0; idx < safeCount; idx += 1) {
    times.push(`${current}m`);
    current += idx % 2 === 0 ? 2 : 3;
  }
  return times;
}
