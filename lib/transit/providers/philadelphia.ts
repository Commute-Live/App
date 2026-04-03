import type {
  DirectionVariant,
  ModeId,
  TransitRouteGroup,
  TransitRoutePickerItem,
  TransitRouteRecord,
  UiDirection,
} from '../frontendTypes';

type PhiladelphiaMode = Extract<ModeId, 'train' | 'bus' | 'trolley'>;

const SEPTA_TROLLEY_ROUTE_LABELS: Record<string, string> = {
  D1: '101',
  D2: '102',
  G1: '15',
  T1: '10',
  T2: '11',
  T3: '13',
  T4: '34',
  T5: '36',
  'T BUS': 'T Bus',
  'T5 BUS': '36 Bus',
};

const PHILLY_TROLLEY_ORDER = ['T1', 'T2', 'T3', 'G1', 'T4', 'T5', 'D1', 'D2', 'T BUS', 'T5 BUS'];

const naturalRouteLabelCompare = (left: string, right: string) =>
  left.localeCompare(right, undefined, {numeric: true, sensitivity: 'base'});

const normalizeToken = (value: string | null | undefined) => value?.trim().toUpperCase() ?? '';

const trimLineSuffix = (value: string) => value.replace(/\s+Line$/i, '').trim();

const compactSeptaRailLabel = (routeLabel: string) => trimLineSuffix(routeLabel).trim();

const resolveSeptaTrolleyLabel = (routeId: string, routeLabel: string) => {
  const mapped = SEPTA_TROLLEY_ROUTE_LABELS[normalizeToken(routeId)];
  if (mapped) return mapped;
  const routeNumber = routeLabel.match(/^Route\s+(\d+)/i)?.[1];
  return routeNumber ?? routeLabel.trim();
};

const routeToPickerItem = (
  route: TransitRouteRecord,
  displayLabel: string,
): TransitRoutePickerItem => ({
  id: route.id,
  label: route.label,
  displayLabel,
  color: route.color,
  textColor: route.textColor,
  routes: [route],
});

const sortRoutesAlphabetically = (routes: TransitRouteRecord[]) =>
  [...routes].sort((left, right) => {
    const labelCompare = naturalRouteLabelCompare(left.label, right.label);
    if (labelCompare !== 0) return labelCompare;
    return naturalRouteLabelCompare(left.id, right.id);
  });

const getPhillyTrolleyOrder = (route: TransitRouteRecord) => {
  const index = PHILLY_TROLLEY_ORDER.indexOf(normalizeToken(route.id));
  return index === -1 ? 999 : index;
};

const sortPhiladelphiaTrolleyRoutes = (routes: TransitRouteRecord[]) =>
  [...routes].sort((left, right) => {
    const leftOrder = getPhillyTrolleyOrder(left);
    const rightOrder = getPhillyTrolleyOrder(right);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return naturalRouteLabelCompare(left.label, right.label);
  });

export const isPhiladelphiaMode = (mode: ModeId): mode is PhiladelphiaMode =>
  mode === 'train' || mode === 'bus' || mode === 'trolley';

export const getPhiladelphiaModeLabel = (mode: PhiladelphiaMode) => {
  if (mode === 'train') return 'Regional Rail';
  if (mode === 'trolley') return 'Trolley';
  return 'Bus';
};

export const formatPhiladelphiaRoutePickerLabel = (
  mode: PhiladelphiaMode,
  routeId: string,
  routeLabel: string,
) => {
  if (mode === 'train') return compactSeptaRailLabel(routeLabel);
  if (mode === 'trolley') return resolveSeptaTrolleyLabel(routeId, routeLabel);
  return routeLabel.trim();
};

export const getPhiladelphiaLineLabel = (
  mode: PhiladelphiaMode,
  routeId: string,
  routeLabel: string,
) => formatPhiladelphiaRoutePickerLabel(mode, routeId, routeLabel);

export const getPhiladelphiaRouteBadgeLabel = (
  mode: PhiladelphiaMode,
  routeId: string,
  routeLabel?: string | null,
) => {
  const normalizedId = normalizeToken(routeId);
  const safeLabel = (routeLabel ?? routeId).trim();
  if (mode === 'train') {
    return normalizedId || compactSeptaRailLabel(safeLabel).toUpperCase().slice(0, 4);
  }
  if (mode === 'trolley') {
    return resolveSeptaTrolleyLabel(routeId, safeLabel);
  }
  return safeLabel.toUpperCase().slice(0, 4);
};

export const getPhiladelphiaDirectionLabel = (
  mode: PhiladelphiaMode,
  direction: UiDirection,
  _variant: DirectionVariant = 'bound',
) => {
  if (mode === 'train') {
    return direction === 'uptown' ? 'Northbound' : 'Southbound';
  }
  if (mode === 'bus' || mode === 'trolley') {
    return direction === 'uptown' ? 'Outbound' : 'Inbound';
  }
  return null;
};

export const serializePhiladelphiaDirection = (
  mode: PhiladelphiaMode,
  direction: UiDirection,
) => {
  if (mode !== 'bus' && mode !== 'trolley') return null;
  return direction === 'uptown' ? '0' : '1';
};

export const deserializePhiladelphiaDirection = (
  mode: PhiladelphiaMode,
  value: string | null | undefined,
  stopId?: string | null,
): UiDirection | null => {
  if (mode === 'bus' || mode === 'trolley') {
    return normalizeToken(value) === '1' ? 'downtown' : 'uptown';
  }

  const normalized = normalizeToken(value);
  if (normalized === 'S' || normalized === 'SOUTHBOUND' || (!normalized && normalizeToken(stopId).endsWith('S'))) {
    return 'downtown';
  }
  return 'uptown';
};

export const preparePhiladelphiaRouteEntries = (
  mode: PhiladelphiaMode,
  routes: TransitRouteRecord[],
): TransitRoutePickerItem[] | null => {
  if (mode === 'train') {
    return sortRoutesAlphabetically(routes).map(route =>
      routeToPickerItem(route, getPhiladelphiaLineLabel(mode, route.id, route.label)),
    );
  }

  if (mode === 'trolley') {
    return sortPhiladelphiaTrolleyRoutes(routes).map(route =>
      routeToPickerItem(route, getPhiladelphiaLineLabel(mode, route.id, route.label)),
    );
  }

  return null;
};

export const buildPhiladelphiaRouteGroups = (
  mode: PhiladelphiaMode,
  routes: TransitRoutePickerItem[],
): TransitRouteGroup[] | null => {
  if (mode === 'train') return routes.length > 0 ? [{key: 'septa-rail', routes}] : [];
  if (mode === 'trolley') return routes.length > 0 ? [{key: 'septa-trolley', routes}] : [];
  return null;
};
