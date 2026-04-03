import type {TransitRoutePickerItem, TransitRouteRecord, UiDirection} from '../../frontendTypes';
import {
  compareRouteSortOrder,
  extractRouteNumber,
  formatSurfaceBridgeLabel,
  PHILADELPHIA_TROLLEY_ROUTE_LABELS,
  normalizeToken,
  routeToPickerItem,
  singleGroup,
} from './shared';

const resolvePhiladelphiaTrolleyLabel = (routeId: string, routeLabel: string) => {
  const routeNumber = extractRouteNumber(routeLabel);
  if (routeNumber) return routeNumber;

  const normalizedId = normalizeToken(routeId);
  const mapped = PHILADELPHIA_TROLLEY_ROUTE_LABELS[normalizedId];
  if (mapped) return mapped;

  if (normalizedId.includes('BUS')) {
    return formatSurfaceBridgeLabel(routeId);
  }

  return routeLabel.trim() || routeId.trim();
};

const sortPhiladelphiaTrolleyRoutes = (routes: TransitRouteRecord[]) =>
  [...routes].sort(compareRouteSortOrder);

export const getPhiladelphiaTrolleyModeLabel = () => 'Trolley';

export const formatPhiladelphiaTrolleyRoutePickerLabel = (
  routeId: string,
  routeLabel: string,
) => resolvePhiladelphiaTrolleyLabel(routeId, routeLabel);

export const getPhiladelphiaTrolleyLineLabel = (
  routeId: string,
  routeLabel: string,
) => resolvePhiladelphiaTrolleyLabel(routeId, routeLabel);

export const getPhiladelphiaTrolleyRouteBadgeLabel = (
  routeId: string,
  routeLabel?: string | null,
) => resolvePhiladelphiaTrolleyLabel(routeId, (routeLabel ?? routeId).trim());

export const getPhiladelphiaTrolleyDirectionLabel = (
  direction: UiDirection,
  headsign?: string | null,
): string => {
  if (headsign) return `To ${headsign}`;
  return direction === 'dir1' ? 'Direction 1' : 'Direction 0';
};

export const serializePhiladelphiaTrolleyDirection = (direction: UiDirection) =>
  direction === 'dir1' || direction === 'downtown' ? '1' : '0';

export const deserializePhiladelphiaTrolleyDirection = (value: string | null | undefined) => {
  const normalized = value?.trim().toUpperCase() ?? '';
  return normalized === '1' || normalized === 'DIR1' || normalized === 'DOWNTOWN'
    ? 'dir1' as const
    : 'dir0' as const;
};

export const preparePhiladelphiaTrolleyRouteEntries = (
  routes: TransitRouteRecord[],
) => sortPhiladelphiaTrolleyRoutes(routes).map(route =>
  routeToPickerItem(route, formatPhiladelphiaTrolleyRoutePickerLabel(route.id, route.label)),
);

export const buildPhiladelphiaTrolleyRouteGroups = (
  routes: TransitRoutePickerItem[],
) => singleGroup('septa-trolley', routes);
