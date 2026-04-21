import type {
  DirectionVariant,
  TransitRoutePickerItem,
  TransitRouteRecord,
  UiDirection,
} from '../../frontendTypes';

export const naturalRouteLabelCompare = (left: string, right: string) =>
  left.localeCompare(right, undefined, {numeric: true, sensitivity: 'base'});

export const normalizeToken = (value: string | null | undefined) => value?.trim().toUpperCase() ?? '';

export const normalizeRoutePickerLabel = (route: {label: string}) =>
  route.label.trim().toUpperCase();

export const defaultDirectionLabel = (
  direction: UiDirection,
  variant: DirectionVariant,
) => {
  if (variant === 'summary') {
    return direction === 'downtown' ? 'Downtown / South' : 'Uptown / North';
  }
  return direction === 'downtown' ? 'Downtown' : 'Uptown';
};

export const routeToPickerItem = (
  route: TransitRouteRecord,
  displayLabel: string,
): TransitRoutePickerItem => ({
  id: route.id,
  shortName: route.shortName,
  label: route.label,
  displayLabel,
  color: route.color,
  textColor: route.textColor,
  routes: [route],
});

export const compareDuplicateRouteCandidates = (
  left: TransitRouteRecord,
  right: TransitRouteRecord,
) => {
  const leftLabel = normalizeRoutePickerLabel(left);
  const rightLabel = normalizeRoutePickerLabel(right);
  const leftExact = left.id.toUpperCase() === leftLabel ? 0 : 1;
  const rightExact = right.id.toUpperCase() === rightLabel ? 0 : 1;
  if (leftExact !== rightExact) return leftExact - rightExact;
  if (left.id.length !== right.id.length) return left.id.length - right.id.length;
  return naturalRouteLabelCompare(left.id, right.id);
};

export const dedupeRoutesForPicker = (routes: TransitRouteRecord[]) => {
  const seen = new Map<string, TransitRouteRecord>();

  for (const route of routes) {
    const key = normalizeRoutePickerLabel(route);
    const existing = seen.get(key);
    if (!existing || compareDuplicateRouteCandidates(route, existing) < 0) {
      seen.set(key, route);
    }
  }

  return [...seen.values()];
};

export const serializeNorthSouthDirection = (direction: UiDirection) =>
  direction === 'uptown' ? 'N' : 'S';

export const deserializeNorthSouthDirection = (
  value: string | null | undefined,
  stopId?: string | null,
) => {
  const normalized = normalizeToken(value);
  if (
    normalized === 'S' ||
    normalized === 'SOUTHBOUND' ||
    (!normalized && normalizeToken(stopId).endsWith('S'))
  ) {
    return 'downtown' as const;
  }
  return 'uptown' as const;
};
