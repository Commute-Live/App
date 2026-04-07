import type {
  DirectionVariant,
  ModeId,
  TransitRouteGroup,
  TransitRoutePickerItem,
  TransitRouteRecord,
  UiDirection,
} from '../frontendTypes';

type ChicagoMode = Extract<ModeId, 'train' | 'bus'>;
type ChicagoDirection = Extract<UiDirection, 'dir0' | 'dir1'>;

type DirectionCopy = Record<ChicagoDirection, Record<DirectionVariant, string>>;

const CTA_TRAIN_DIRECTION_COPY: Record<string, DirectionCopy> = {
  BLUE: {
    dir0: {toggle: "O'Hare", bound: "O'Hare-bound", summary: "O'Hare"},
    dir1: {toggle: 'Forest Park', bound: 'Forest Park-bound', summary: 'Forest Park'},
  },
  RED: {
    dir0: {toggle: 'Howard', bound: 'Howard-bound', summary: 'Howard'},
    dir1: {toggle: '95th', bound: '95th-bound', summary: '95th'},
  },
  BRN: {
    dir0: {toggle: 'Kimball', bound: 'Kimball-bound', summary: 'Kimball'},
    dir1: {toggle: 'Loop', bound: 'Loop-bound', summary: 'Loop'},
  },
  G: {
    dir0: {toggle: 'Harlem/Lake', bound: 'Harlem/Lake-bound', summary: 'Harlem/Lake'},
    dir1: {
      toggle: 'Ashland/63rd or Cottage Grove',
      bound: 'Ashland/63rd or Cottage Grove',
      summary: 'Ashland/63rd or Cottage Grove',
    },
  },
  ORG: {
    dir0: {toggle: 'Loop', bound: 'Loop-bound', summary: 'Loop'},
    dir1: {toggle: 'Midway', bound: 'Midway-bound', summary: 'Midway'},
  },
  P: {
    dir0: {toggle: 'Linden', bound: 'Linden-bound', summary: 'Linden'},
    dir1: {toggle: 'Loop', bound: 'Loop-bound', summary: 'Loop'},
  },
  PINK: {
    dir0: {toggle: 'Loop', bound: 'Loop-bound', summary: 'Loop'},
    dir1: {toggle: '54th/Cermak', bound: '54th/Cermak-bound', summary: '54th/Cermak'},
  },
  Y: {
    dir0: {toggle: 'Skokie', bound: 'Skokie-bound', summary: 'Skokie'},
    dir1: {toggle: 'Howard', bound: 'Howard-bound', summary: 'Howard'},
  },
};

const CHICAGO_TRAIN_ORDER = ['RED', 'BLUE', 'BRN', 'BROWN', 'G', 'GREEN', 'ORG', 'ORANGE', 'PINK', 'P', 'PURPLE', 'Y', 'YELLOW'];

const naturalRouteLabelCompare = (left: string, right: string) =>
  left.localeCompare(right, undefined, {numeric: true, sensitivity: 'base'});

const normalizeToken = (value: string | null | undefined) => value?.trim().toUpperCase() ?? '';

const trimLineSuffix = (value: string) => value.replace(/\s+Line$/i, '').trim();

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
  if (mode === 'train') return trimLineSuffix(routeLabel);
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
  if (mode !== 'train') return safeLabel.toUpperCase().slice(0, 4);
  return normalizedId.slice(0, 4) || trimLineSuffix(safeLabel).toUpperCase().slice(0, 4);
};

export const getChicagoDirectionLabel = (
  mode: ChicagoMode,
  direction: UiDirection,
  routeId?: string | null,
  variant: DirectionVariant = 'bound',
) => {
  if (mode === 'bus') return 'To destination';
  if (direction !== 'dir0' && direction !== 'dir1') return null;
  const copy = CTA_TRAIN_DIRECTION_COPY[normalizeToken(routeId)];
  if (!copy) return null;
  return copy[direction][variant];
};

export const serializeChicagoDirection = (
  mode: ChicagoMode,
  direction: UiDirection,
) => {
  if (mode === 'bus') return '';
  if (direction === 'dir1') return '5';
  return '1';
};

export const deserializeChicagoDirection = (
  mode: ChicagoMode,
  value: string | null | undefined,
): UiDirection | null => {
  if (mode === 'bus') return 'dir0';

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
    routeToPickerItem(route, getChicagoLineLabel(mode, route.id, route.label)),
  );
};

export const buildChicagoRouteGroups = (
  mode: ChicagoMode,
  routes: TransitRoutePickerItem[],
): TransitRouteGroup[] | null => {
  if (mode !== 'train') return null;
  return routes.length > 0 ? [{key: 'cta-train', routes}] : [];
};
