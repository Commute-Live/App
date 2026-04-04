import type {TransitRouteGroup, TransitRoutePickerItem, TransitRouteRecord} from '../../frontendTypes';

export const NJT_RAIL_APPEARANCE = {
  color: '#0039A6',
  textColor: '#FFFFFF',
} as const;

export const NJT_BUS_APPEARANCE = {
  color: '#0039A6',
  textColor: '#FFFFFF',
} as const;

export const naturalRouteLabelCompare = (left: string, right: string) =>
  left.localeCompare(right, undefined, {numeric: true, sensitivity: 'base'});

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

export const trimLineSuffix = (value: string) => value.replace(/\s+Line$/i, '').trim();
