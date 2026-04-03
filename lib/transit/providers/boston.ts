import type {
  DirectionVariant,
  ModeId,
  TransitRouteGroup,
  TransitRoutePickerItem,
  TransitRouteRecord,
  UiDirection,
} from '../frontendTypes';

type BostonMode = Extract<ModeId, 'train' | 'bus' | 'commuter-rail' | 'ferry'>;

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

const BOSTON_FERRY_BADGE_LABELS: Record<string, string> = {
  'BOAT-EASTBOSTON': 'EB',
  'BOAT-F1': 'F1',
  'BOAT-F4': 'F4',
  'BOAT-F6': 'F6',
  'BOAT-F7': 'F7',
  'BOAT-F8': 'F8',
  'BOAT-LYNN': 'LYNN',
};

const BOSTON_TRAIN_ORDER = ['RED', 'ORANGE', 'BLUE', 'GREEN-B', 'GREEN-C', 'GREEN-D', 'GREEN-E', 'MATTAPAN'];

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

const compactBostonFerryLabel = (routeId: string, label: string) => {
  const normalizedId = normalizeToken(routeId);
  if (normalizedId === 'BOAT-EASTBOSTON') return 'East Boston';
  if (normalizedId === 'BOAT-LYNN') return 'Lynn';
  if (/^BOAT-F\d+$/i.test(normalizedId)) return normalizedId.replace(/^BOAT-/i, '');
  return label.trim();
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

export const isBostonMode = (mode: ModeId): mode is BostonMode =>
  mode === 'train' || mode === 'bus' || mode === 'commuter-rail' || mode === 'ferry';

export const getBostonModeLabel = (mode: BostonMode) => {
  if (mode === 'train') return 'T';
  if (mode === 'commuter-rail') return 'Commuter Rail';
  if (mode === 'ferry') return 'Ferry';
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

  if (mode === 'ferry') {
    const sourceLabel = !routeLabel || normalizeToken(routeLabel) === normalizeToken(routeId)
      ? routeId
      : routeLabel;
    return compactBostonFerryLabel(routeId, sourceLabel);
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
) => {
  const normalizedId = normalizeToken(routeId);
  const safeLabel = (routeLabel ?? routeId).trim();

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

  if (mode === 'ferry') {
    return BOSTON_FERRY_BADGE_LABELS[normalizedId] ?? compactBostonFerryLabel(routeId, safeLabel).toUpperCase().slice(0, 5);
  }

  return safeLabel.toUpperCase().slice(0, 4);
};

export const getBostonDirectionLabel = (
  _mode: BostonMode,
  direction: UiDirection,
  _variant: DirectionVariant = 'bound',
) => (direction === 'uptown' ? 'Outbound' : 'Inbound');

export const serializeBostonDirection = (direction: UiDirection) =>
  direction === 'uptown' ? '0' : '1';

export const deserializeBostonDirection = (
  value: string | null | undefined,
): UiDirection => {
  const normalized = normalizeToken(value);
  return normalized === '1' || normalized === 'INBOUND' ? 'downtown' : 'uptown';
};

export const prepareBostonRouteEntries = (
  mode: BostonMode,
  routes: TransitRouteRecord[],
): TransitRoutePickerItem[] | null => {
  if (mode === 'train') {
    return sortBostonTrainRoutes(routes).map(route =>
      routeToPickerItem(route, getBostonLineLabel(mode, route.id, route.label)),
    );
  }

  if (mode === 'commuter-rail' || mode === 'ferry') {
    return sortRoutesAlphabetically(routes).map(route =>
      routeToPickerItem(route, getBostonLineLabel(mode, route.id, route.label)),
    );
  }

  return null;
};

export const buildBostonRouteGroups = (
  mode: BostonMode,
  routes: TransitRoutePickerItem[],
): TransitRouteGroup[] | null => {
  if (mode !== 'train' && mode !== 'commuter-rail' && mode !== 'ferry') return null;
  return routes.length > 0 ? [{key: `boston-${mode}`, routes}] : [];
};
