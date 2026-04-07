import type {
  DirectionVariant,
  ModeId,
  TransitRouteGroup,
  TransitRoutePickerItem,
  TransitRouteRecord,
  UiDirection,
} from '../frontendTypes';

type BostonMode = Extract<ModeId, 'train' | 'bus' | 'commuter-rail'>;

const BOSTON_SUBWAY_BADGE_LABELS: Record<string, string> = {
  RED: 'RED',
  ORANGE: 'ORG',
  BLUE: 'BLU',
  GREEN: 'GRN',
  'GREEN-B': 'B',
  'GREEN-C': 'C',
  'GREEN-D': 'D',
  'GREEN-E': 'E',
  MATTAPAN: 'MAT',
};

const BOSTON_COMMUTER_RAIL_BADGE_LABELS: Record<string, string> = {
  CAPEFLYER: 'CAPE',
  'CR-FAIRMOUNT': 'FAIR',
  'CR-FITCHBURG': 'FITCH',
  'CR-FOXBORO': 'FOXB',
  'CR-FRANKLIN': 'FRAN',
  'CR-GREENBUSH': 'GRNB',
  'CR-HAVERHILL': 'HAVE',
  'CR-KINGSTON': 'KING',
  'CR-LOWELL': 'LOWE',
  'CR-NEEDHAM': 'NEED',
  'CR-NEWBEDFORD': 'NBED',
  'CR-NEWBURYPORT': 'NBPT',
  'CR-PROVIDENCE': 'PROV',
  'CR-WORCESTER': 'WORC',
};

const BOSTON_TRAIN_ORDER = ['RED', 'ORANGE', 'BLUE', 'GREEN-B', 'GREEN-C', 'GREEN-D', 'GREEN-E', 'MATTAPAN'];
const BOSTON_GREEN_BRANCH_IDS = new Set(['GREEN-B', 'GREEN-C', 'GREEN-D', 'GREEN-E']);
const BOSTON_BUS_APPEARANCE = {color: '#0F4CBA', textColor: '#FFFFFF'};

const naturalRouteLabelCompare = (left: string, right: string) =>
  left.localeCompare(right, undefined, {numeric: true, sensitivity: 'base'});

const normalizeToken = (value: string | null | undefined) => value?.trim().toUpperCase() ?? '';

const trimLineSuffix = (value: string) => value.replace(/\s+Line$/i, '').trim();

const stripBostonRoutePrefix = (value: string) => value.replace(/^CR-/i, '').trim();

const compactBostonCommuterRailLabel = (value: string) =>
  value
    .replace(/\s+Line$/i, '')
    .replace(/\s+Event Service$/i, '')
    .trim();

const routeToPickerItem = (
  mode: BostonMode,
  route: TransitRouteRecord,
  displayLabel: string,
): TransitRoutePickerItem => {
  const appearance =
    mode === 'bus'
      ? BOSTON_BUS_APPEARANCE
      : {color: route.color, textColor: route.textColor ?? '#FFFFFF'};

  return {
    id: route.id,
    shortName: route.shortName,
    label: route.label,
    displayLabel,
    color: appearance.color,
    textColor: appearance.textColor,
    routes: [route],
  };
};

const getBostonTrainOrder = (route: TransitRouteRecord) => {
  const normalized = normalizeToken(route.id);
  const index = BOSTON_TRAIN_ORDER.indexOf(normalized);
  return index === -1 ? 999 : index;
};

const sortBostonTrainRoutes = (routes: TransitRouteRecord[]) =>
  [...routes].sort((left, right) => {
    const leftOrder = getBostonTrainOrder(left);
    const rightOrder = getBostonTrainOrder(right);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return naturalRouteLabelCompare(left.label, right.label);
  });

const sortRoutesAlphabetically = (routes: TransitRouteRecord[]) =>
  [...routes].sort((left, right) => {
    const labelCompare = naturalRouteLabelCompare(left.label, right.label);
    if (labelCompare !== 0) return labelCompare;
    return naturalRouteLabelCompare(left.id, right.id);
  });

const getBostonBusGroupKey = (route: TransitRouteRecord | TransitRoutePickerItem) => {
  const displayLabel = 'displayLabel' in route ? route.displayLabel : null;
  const normalized = normalizeToken(route.shortName ?? displayLabel ?? route.label ?? route.id);

  if (normalized.startsWith('SL')) return 'silver-line';
  if (normalized.startsWith('CT')) return 'crosstown';

  const numberMatch = normalized.match(/^(\d{1,3})/);
  const routeNumber = numberMatch ? Number(numberMatch[1]) : null;

  if (routeNumber === null) return 'other';
  if (routeNumber >= 500) return 'express';
  if (routeNumber >= 400) return 'north-shore';
  if (routeNumber >= 300) return 'northwest';
  if (routeNumber >= 210) return 'quincy';
  return 'local';
};

const getBostonBusGroupTitle = (key: string) => {
  switch (key) {
    case 'silver-line':
      return 'Silver Line';
    case 'crosstown':
      return 'Crosstown';
    case 'local':
      return 'Local routes';
    case 'quincy':
      return 'Quincy area';
    case 'northwest':
      return 'Northwest suburbs';
    case 'north-shore':
      return 'North Shore';
    case 'express':
      return 'Express';
    default:
      return 'Other';
  }
};

const getBostonBusGroupOrder = (key: string) => {
  switch (key) {
    case 'silver-line':
      return 0;
    case 'crosstown':
      return 1;
    case 'local':
      return 2;
    case 'quincy':
      return 3;
    case 'northwest':
      return 4;
    case 'north-shore':
      return 5;
    case 'express':
      return 6;
    default:
      return 7;
  }
};

export const isBostonMode = (mode: ModeId): mode is BostonMode =>
  mode === 'train' || mode === 'bus' || mode === 'commuter-rail';

export const getBostonModeLabel = (mode: BostonMode) => {
  if (mode === 'train') return 'T';
  if (mode === 'commuter-rail') return 'Commuter Rail';
  return 'Bus';
};

export const formatBostonRoutePickerLabel = (
  mode: BostonMode,
  routeId: string,
  routeLabel: string,
) => {
  if (mode === 'train') {
    return trimLineSuffix(routeLabel).replace(/^Green Line\s+/i, 'Green ');
  }

  if (mode === 'commuter-rail') {
    const sourceLabel = !routeLabel || normalizeToken(routeLabel) === normalizeToken(routeId)
      ? stripBostonRoutePrefix(routeId)
      : routeLabel;
    return compactBostonCommuterRailLabel(sourceLabel);
  }

  return routeLabel.trim();
};

export const getBostonLineLabel = (
  mode: BostonMode,
  routeId: string,
  routeLabel: string,
) => formatBostonRoutePickerLabel(mode, routeId, routeLabel);

export const getBostonRouteBadgeLabel = (
  mode: BostonMode,
  routeId: string,
  routeLabel?: string | null,
  routeShortName?: string | null,
) => {
  const normalizedId = normalizeToken(routeId);
  const safeLabel = (routeShortName ?? routeLabel ?? routeId).trim();

  if (mode === 'train') {
    return (
      BOSTON_SUBWAY_BADGE_LABELS[normalizedId] ??
      BOSTON_SUBWAY_BADGE_LABELS[normalizeToken(trimLineSuffix(safeLabel))] ??
      trimLineSuffix(safeLabel).toUpperCase().slice(0, 4)
    );
  }

  if (mode === 'commuter-rail') {
    return (
      BOSTON_COMMUTER_RAIL_BADGE_LABELS[normalizedId] ??
      BOSTON_COMMUTER_RAIL_BADGE_LABELS[normalizeToken(stripBostonRoutePrefix(routeId))] ??
      stripBostonRoutePrefix(routeId).toUpperCase().slice(0, 4)
    );
  }

  return safeLabel.toUpperCase().slice(0, 4);
};

export const getBostonDirectionLabel = (
  _mode: BostonMode,
  direction: UiDirection,
  _variant: DirectionVariant = 'bound',
) => (direction === 'uptown' || direction === 'outbound' ? 'Outbound' : 'Inbound');

type BostonRouteRef =
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

export const getBostonRouteHeadsign = (
  route: BostonRouteRef,
  direction: UiDirection,
): string | null => {
  if (!route || typeof route === 'string') return null;
  return trimOptionalString(
    direction === 'uptown' || direction === 'outbound' ? route.headsign0 : route.headsign1,
  );
};

export const getBostonFullDirectionLabel = (
  mode: BostonMode,
  direction: UiDirection,
  route?: BostonRouteRef,
  variant: DirectionVariant = 'bound',
): string => {
  const baseTerm = direction === 'uptown' || direction === 'outbound' ? 'Outbound' : 'Inbound';
  const headsign = getBostonRouteHeadsign(route, direction);
  if (!headsign) return baseTerm;
  if (variant === 'toggle' || variant === 'summary') return `${baseTerm}: ${headsign}`;
  return `${baseTerm}: ${headsign}`;
};

export const serializeBostonDirection = (direction: UiDirection) =>
  direction === 'uptown' || direction === 'outbound' ? '0' : '1';

export const deserializeBostonDirection = (
  value: string | null | undefined,
): UiDirection => {
  const normalized = normalizeToken(value);
  return normalized === '1' || normalized === 'INBOUND' ? 'inbound' : 'outbound';
};

export const prepareBostonRouteEntries = (
  mode: BostonMode,
  routes: TransitRouteRecord[],
): TransitRoutePickerItem[] | null => {
  if (mode === 'train') {
    return sortBostonTrainRoutes(routes).map(route =>
      routeToPickerItem(mode, route, getBostonLineLabel(mode, route.id, route.label)),
    );
  }

  if (mode === 'bus' || mode === 'commuter-rail') {
    const sortedRoutes = sortRoutesAlphabetically(routes);
    return sortedRoutes.map(route =>
      routeToPickerItem(mode, route, getBostonLineLabel(mode, route.id, route.label)),
    );
  }

  return null;
};

export const buildBostonRouteGroups = (
  mode: BostonMode,
  routes: TransitRoutePickerItem[],
): TransitRouteGroup[] | null => {
  if (mode === 'train') {
    const rapidTransitRoutes = routes.filter(route => !BOSTON_GREEN_BRANCH_IDS.has(normalizeToken(route.id)));
    const greenBranchRoutes = routes.filter(route => BOSTON_GREEN_BRANCH_IDS.has(normalizeToken(route.id)));

    return [
      {key: 'boston-train-main', title: 'Subway lines', routes: rapidTransitRoutes},
      {key: 'boston-train-green', title: 'Green Line branches', routes: greenBranchRoutes},
    ].filter(group => group.routes.length > 0);
  }

  if (mode === 'bus') {
    const grouped = new Map<string, TransitRoutePickerItem[]>();

    for (const route of routes) {
      const key = getBostonBusGroupKey(route);
      const current = grouped.get(key) ?? [];
      current.push(route);
      grouped.set(key, current);
    }

    return [...grouped.entries()]
      .sort((left, right) => getBostonBusGroupOrder(left[0]) - getBostonBusGroupOrder(right[0]))
      .map(([key, groupRoutes]) => ({
        key,
        title: getBostonBusGroupTitle(key),
        routes: groupRoutes,
      }))
      .filter(group => group.routes.length > 0);
  }

  if (mode === 'commuter-rail') {
    return routes.length > 0 ? [{key: 'boston-commuter-rail', title: 'Commuter rail lines', routes}] : [];
  }

  return null;
};
