import type {
  DirectionVariant,
  ModeId,
  TransitRouteGroup,
  TransitRoutePickerItem,
  TransitRouteRecord,
  UiDirection,
} from '../frontendTypes';

type ChicagoMode = Extract<ModeId, 'train' | 'bus'>;
type ChicagoDirection = Extract<UiDirection, 'uptown' | 'downtown'>;

type DirectionCopy = Record<ChicagoDirection, Record<DirectionVariant, string>>;

const CTA_TRAIN_DIRECTION_COPY: Record<string, DirectionCopy> = {
  BLUE: {
    uptown: {toggle: "O'Hare", bound: "O'Hare-bound", summary: "O'Hare"},
    downtown: {toggle: 'Forest Park', bound: 'Forest Park-bound', summary: 'Forest Park'},
  },
  RED: {
    uptown: {toggle: 'Howard', bound: 'Howard-bound', summary: 'Howard'},
    downtown: {toggle: '95th', bound: '95th-bound', summary: '95th'},
  },
  BRN: {
    uptown: {toggle: 'Kimball', bound: 'Kimball-bound', summary: 'Kimball'},
    downtown: {toggle: 'Loop', bound: 'Loop-bound', summary: 'Loop'},
  },
  G: {
    uptown: {toggle: 'Harlem/Lake', bound: 'Harlem/Lake-bound', summary: 'Harlem/Lake'},
    downtown: {
      toggle: 'Ashland/63rd or Cottage Grove',
      bound: 'Ashland/63rd or Cottage Grove',
      summary: 'Ashland/63rd or Cottage Grove',
    },
  },
  ORG: {
    uptown: {toggle: 'Loop', bound: 'Loop-bound', summary: 'Loop'},
    downtown: {toggle: 'Midway', bound: 'Midway-bound', summary: 'Midway'},
  },
  P: {
    uptown: {toggle: 'Linden', bound: 'Linden-bound', summary: 'Linden'},
    downtown: {toggle: 'Loop', bound: 'Loop-bound', summary: 'Loop'},
  },
  PINK: {
    uptown: {toggle: 'Loop', bound: 'Loop-bound', summary: 'Loop'},
    downtown: {toggle: '54th/Cermak', bound: '54th/Cermak-bound', summary: '54th/Cermak'},
  },
  Y: {
    uptown: {toggle: 'Skokie', bound: 'Skokie-bound', summary: 'Skokie'},
    downtown: {toggle: 'Howard', bound: 'Howard-bound', summary: 'Howard'},
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
  if (mode !== 'train') return null;
  if (direction !== 'uptown' && direction !== 'downtown') return null;
  const copy = CTA_TRAIN_DIRECTION_COPY[normalizeToken(routeId)];
  if (!copy) return null;
  return copy[direction][variant];
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
