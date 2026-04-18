import type {
  DirectionVariant,
  ModeId,
  TransitRouteGroup,
  TransitRoutePickerItem,
  TransitRouteRecord,
  UiDirection,
} from '../frontendTypes';

type ChicagoMode = Extract<ModeId, 'train' | 'bus'>;

const CHICAGO_TRAIN_ORDER = ['RED', 'BLUE', 'BRN', 'BROWN', 'G', 'GREEN', 'ORG', 'ORANGE', 'PINK', 'P', 'PURPLE', 'Y', 'YELLOW'];

const CTA_TRAIN_LINE_NAMES: Record<string, string> = {
  RED: 'Red Line',
  BLUE: 'Blue Line',
  BRN: 'Brown Line',
  BROWN: 'Brown Line',
  G: 'Green Line',
  GREEN: 'Green Line',
  ORG: 'Orange Line',
  ORANGE: 'Orange Line',
  PINK: 'Pink Line',
  P: 'Purple Line',
  PURPLE: 'Purple Line',
  Y: 'Yellow Line',
  YELLOW: 'Yellow Line',
};

const naturalRouteLabelCompare = (left: string, right: string) =>
  left.localeCompare(right, undefined, {numeric: true, sensitivity: 'base'});

const normalizeToken = (value: string | null | undefined) => value?.trim().toUpperCase() ?? '';

const trimLineSuffix = (value: string) => value.replace(/\s+Line$/i, '').trim();

const getChicagoTrainLineName = (routeId: string, routeLabel: string) => {
  const safeLabel = routeLabel.trim();
  if (/\s+Line$/i.test(safeLabel)) return safeLabel;
  return CTA_TRAIN_LINE_NAMES[normalizeToken(routeId)] ?? CTA_TRAIN_LINE_NAMES[normalizeToken(safeLabel)] ?? safeLabel;
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

const getChicagoTrainOrder = (route: TransitRouteRecord) => {
  const normalizedId = normalizeToken(route.id);
  const normalizedLabel = trimLineSuffix(route.label).toUpperCase();
  const idIndex = CHICAGO_TRAIN_ORDER.indexOf(normalizedId);
  if (idIndex !== -1) return idIndex;
  const labelIndex = CHICAGO_TRAIN_ORDER.indexOf(normalizedLabel);
  if (labelIndex !== -1) return labelIndex;
  return 999;
};

const sortChicagoTrainRoutes = (routes: TransitRouteRecord[]) =>
  [...routes].sort((left, right) => {
    const leftOrder = getChicagoTrainOrder(left);
    const rightOrder = getChicagoTrainOrder(right);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return naturalRouteLabelCompare(left.label, right.label);
  });

export const isChicagoMode = (mode: ModeId): mode is ChicagoMode =>
  mode === 'train' || mode === 'bus';

export const getChicagoModeLabel = (mode: ChicagoMode) => {
  if (mode === 'train') return 'L';
  return 'Bus';
};

export const formatChicagoRoutePickerLabel = (
  mode: ChicagoMode,
  _routeId: string,
  routeLabel: string,
) => {
  if (mode === 'train') return getChicagoTrainLineName(_routeId, routeLabel);
  return routeLabel.trim();
};

export const getChicagoLineLabel = (
  mode: ChicagoMode,
  routeId: string,
  routeLabel: string,
) => formatChicagoRoutePickerLabel(mode, routeId, routeLabel);

export const getChicagoRouteBadgeLabel = (
  mode: ChicagoMode,
  routeId: string,
  routeLabel?: string | null,
) => {
  const normalizedId = normalizeToken(routeId);
  const safeLabel = (routeLabel ?? routeId).trim();
  if (mode !== 'train') return normalizedId.slice(0, 5) || safeLabel.toUpperCase().slice(0, 5);
  return normalizedId.slice(0, 4) || trimLineSuffix(safeLabel).toUpperCase().slice(0, 4);
};

export const getChicagoDirectionLabel = (
  mode: ChicagoMode,
  _direction: UiDirection,
  _routeId?: string | null,
  _variant: DirectionVariant = 'bound',
) => {
  if (mode === 'bus') return null;
  return null;
};

export const serializeChicagoDirection = (
  mode: ChicagoMode,
  direction: UiDirection,
) => {
  if (mode === 'bus') return direction === 'dir1' ? '1' : '0';
  if (direction === 'dir1') return '5';
  return '1';
};

export const deserializeChicagoDirection = (
  mode: ChicagoMode,
  value: string | null | undefined,
): UiDirection | null => {
  if (mode === 'bus') {
    const normalized = normalizeToken(value);
    if (normalized === '1' || normalized === 'DIR1') return 'dir1';
    return 'dir0';
  }

  const normalized = normalizeToken(value);
  if (normalized === '5' || normalized === 'S' || normalized === 'DIR1') return 'dir1';
  if (normalized === '1' || normalized === 'N' || normalized === 'DIR0') return 'dir0';
  return 'dir0';
};

export const prepareChicagoRouteEntries = (
  mode: ChicagoMode,
  routes: TransitRouteRecord[],
): TransitRoutePickerItem[] | null => {
  if (mode !== 'train') return null;
  return sortChicagoTrainRoutes(routes).map(route =>
    routeToPickerItem(
      {...route, label: getChicagoLineLabel(mode, route.id, route.label)},
      getChicagoLineLabel(mode, route.id, route.label),
    ),
  );
};

export const buildChicagoRouteGroups = (
  mode: ChicagoMode,
  routes: TransitRoutePickerItem[],
): TransitRouteGroup[] | null => {
  if (mode !== 'train') return null;
  return routes.length > 0 ? [{key: 'cta-train', routes}] : [];
};
