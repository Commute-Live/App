import type {TransitRouteGroup, TransitRoutePickerItem, TransitRouteRecord} from '../../frontendTypes';

export const PHILADELPHIA_TROLLEY_ROUTE_LABELS: Record<string, string> = {
  G1: '15',
  T1: '10',
  T2: '11',
  T3: '13',
  T4: '34',
  T5: '36',
};

export const PHILADELPHIA_REGIONAL_RAIL_APPEARANCE = {
  color: '#45637A',
  textColor: '#FFFFFF',
} as const;

export const PHILADELPHIA_BADGE_APPEARANCES: Record<string, {color: string; textColor: string}> = {
  L: {color: '#0097D6', textColor: '#FFFFFF'},
  B: {color: '#F26100', textColor: '#FFFFFF'},
  T: {color: '#5A960A', textColor: '#FFFFFF'},
  T1: {color: '#5A960A', textColor: '#FFFFFF'},
  T2: {color: '#5A960A', textColor: '#FFFFFF'},
  T3: {color: '#5A960A', textColor: '#FFFFFF'},
  T4: {color: '#5A960A', textColor: '#FFFFFF'},
  T5: {color: '#5A960A', textColor: '#FFFFFF'},
  G: {color: '#FFD700', textColor: '#000000'},
  D: {color: '#DC2E6B', textColor: '#FFFFFF'},
  D1: {color: '#DC2E6B', textColor: '#FFFFFF'},
  D2: {color: '#DC2E6B', textColor: '#FFFFFF'},
  M: {color: '#5F249F', textColor: '#FFFFFF'},
} as const;

export const naturalRouteLabelCompare = (left: string, right: string) =>
  left.localeCompare(right, undefined, {numeric: true, sensitivity: 'base'});

export const compareRouteSortOrder = (
  left: Pick<TransitRouteRecord, 'sortOrder' | 'label' | 'id'>,
  right: Pick<TransitRouteRecord, 'sortOrder' | 'label' | 'id'>,
) => {
  const leftSort = left.sortOrder;
  const rightSort = right.sortOrder;
  if (leftSort !== null && rightSort !== null && leftSort !== rightSort) {
    return leftSort - rightSort;
  }
  if (leftSort !== null && rightSort === null) return -1;
  if (leftSort === null && rightSort !== null) return 1;

  const labelCompare = naturalRouteLabelCompare(left.label, right.label);
  if (labelCompare !== 0) return labelCompare;
  return naturalRouteLabelCompare(left.id, right.id);
};

export const normalizeToken = (value: string | null | undefined) => value?.trim().toUpperCase() ?? '';

const compactPhiladelphiaRouteId = (value: string) =>
  normalizeToken(value).replace(/\s+/g, '');

export const getPhiladelphiaSurfaceBadgeLabel = (routeId: string) => {
  const normalized = compactPhiladelphiaRouteId(routeId);
  if (!normalized) return '';

  if (normalized === 'G1') return 'G';
  if (normalized === 'TBUS') return 'T';
  if (normalized === 'T5BUS') return 'T5';
  if (normalized === 'D1BUS') return 'D1';
  if (normalized === 'D2BUS') return 'D2';
  if (normalized === 'M1BUS' || normalized === 'M1') return 'M';
  if (normalized === 'L1' || normalized === 'L1OWL') return 'L';
  if (normalized === 'B1' || normalized === 'B2' || normalized === 'B3' || normalized === 'B1OWL') return 'B';
  if (/^T[1-5]$/.test(normalized)) return normalized;
  if (/^D[12]$/.test(normalized)) return normalized;

  return routeId.trim().toUpperCase();
};

export const getPhiladelphiaRouteBadgeAppearance = (
  mode: 'train' | 'bus' | 'trolley',
  routeId: string,
) => {
  if (mode === 'train') return PHILADELPHIA_REGIONAL_RAIL_APPEARANCE;
  const badgeLabel = getPhiladelphiaSurfaceBadgeLabel(routeId);
  return PHILADELPHIA_BADGE_APPEARANCES[badgeLabel] ?? null;
};

export const trimLineSuffix = (value: string) => value.replace(/\s+Line$/i, '').trim();

export const extractRouteNumber = (value: string | null | undefined) =>
  value?.match(/\bRoute\s+(\d+)\b/i)?.[1] ?? null;

export const formatSurfaceBridgeLabel = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bBUS\b/gi, 'Bus');

export const sortRoutesAlphabetically = (routes: TransitRouteRecord[]) =>
  [...routes].sort((left, right) => {
    const labelCompare = naturalRouteLabelCompare(left.label, right.label);
    if (labelCompare !== 0) return labelCompare;
    return naturalRouteLabelCompare(left.id, right.id);
  });

export const routeToPickerItem = (
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

export const singleGroup = (key: string, routes: TransitRoutePickerItem[]): TransitRouteGroup[] =>
  routes.length > 0 ? [{key, routes}] : [];
