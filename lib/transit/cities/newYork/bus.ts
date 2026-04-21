import type {
  DirectionVariant,
  TransitRouteAppearance,
  TransitRouteGroup,
  TransitRoutePickerItem,
  TransitRouteRecord,
  UiDirection,
} from '../../frontendTypes';
import {
  naturalRouteLabelCompare,
  normalizeRoutePickerLabel,
  routeToPickerItem,
} from './shared';

export const resolveNewYorkBusAppearance = (
  lineId: string,
  label?: string | null,
): TransitRouteAppearance => {
  const normalized = `${lineId} ${label ?? ''}`.toUpperCase();

  if (normalized.includes('SBS') || normalized.includes('SELECT BUS')) {
    return {color: '#00A1DE', textColor: '#FFFFFF'};
  }

  if (normalized.includes('LTD') || normalized.includes('LIMITED')) {
    return {color: '#EE352E', textColor: '#FFFFFF'};
  }

  if (
    normalized.startsWith('BM') ||
    normalized.startsWith('QM') ||
    normalized.startsWith('X') ||
    normalized.startsWith('SIM')
  ) {
    return {color: '#006B3F', textColor: '#FFFFFF'};
  }

  return {color: '#0039A6', textColor: '#FFFFFF'};
};

export const formatNewYorkBusRoutePickerLabel = (
  routeId: string,
  routeLabel: string,
) => {
  const normalizedRouteId = routeId.trim();
  if (normalizedRouteId.length > 0) {
    return normalizedRouteId.replace(/-?SBS\b/gi, '+').replace(/\s+/g, '');
  }
  return routeLabel.replace(/-?SBS\b/gi, '+').replace(/\s+/g, '');
};

type BusRouteRef =
  | string
  | {
      id?: string;
      label?: string;
      headsign0?: string | null;
      headsign1?: string | null;
    }
  | null
  | undefined;

const trimOptionalString = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeBusHeadsign = (value: string | null | undefined) => {
  const trimmed = trimOptionalString(value);
  if (!trimmed) return null;
  return trimmed
    .replace(/\s+/g, ' ')
    .trim();
};

export const getNewYorkBusHeadsign = (
  route: BusRouteRef,
  direction: UiDirection,
) => {
  if (!route || typeof route === 'string') return null;
  return normalizeBusHeadsign(direction === 'dir1' ? route.headsign1 : route.headsign0);
};

export const getNewYorkBusDirectionLabel = (
  _direction: UiDirection,
  route?: BusRouteRef,
  variant: DirectionVariant = 'bound',
) => {
  const headsign = getNewYorkBusHeadsign(route, _direction);
  if (!headsign) return null;
  if (variant === 'summary') return `To ${headsign}`;
  return `To ${headsign}`;
};

const normalizeBusLabel = (route: {id?: string | null; shortName?: string | null; label: string}) => {
  const routeCode = route.id?.trim() || route.shortName?.trim() || route.label.trim();
  return normalizeRoutePickerLabel({label: routeCode}).replace(/\s+/g, '');
};

const getBusGroupKey = (route: {id?: string | null; shortName?: string | null; label: string}) => {
  const label = normalizeBusLabel(route);
  if (label.startsWith('BX')) return 'bronx';
  if (label.startsWith('B')) return 'brooklyn';
  if (label.startsWith('M')) return 'manhattan';
  if (label.startsWith('Q')) return 'queens';
  if (label.startsWith('S')) return 'staten-island';
  return 'other';
};

const getBusGroupTitle = (key: string) => {
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
};

const getBusGroupOrder = (key: string) => {
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
};

const getBusRouteSortParts = (route: {id?: string | null; shortName?: string | null; label: string}) => {
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
};

const sortRoutesForBusPicker = (routes: TransitRouteRecord[]) =>
  [...routes].sort((left, right) => {
    const leftGroup = getBusGroupOrder(getBusGroupKey(left));
    const rightGroup = getBusGroupOrder(getBusGroupKey(right));
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

export const prepareNewYorkBusRouteEntries = (
  routes: TransitRouteRecord[],
) => sortRoutesForBusPicker(routes).map(route =>
  routeToPickerItem(route, formatNewYorkBusRoutePickerLabel(route.id, route.label)),
);

export const buildNewYorkBusRouteGroups = (
  routes: TransitRoutePickerItem[],
): TransitRouteGroup[] => {
  const grouped = new Map<string, TransitRoutePickerItem[]>();

  for (const route of routes) {
    const key = getBusGroupKey(route);
    const current = grouped.get(key) ?? [];
    current.push(route);
    grouped.set(key, current);
  }

  return [...grouped.entries()]
    .sort((left, right) => getBusGroupOrder(left[0]) - getBusGroupOrder(right[0]))
    .map(([key, groupRoutes]) => ({
      key,
      title: getBusGroupTitle(key),
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
};
