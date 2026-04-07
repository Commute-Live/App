import type {DirectionVariant, TransitRoutePickerItem, TransitRouteRecord, UiDirection} from '../../frontendTypes';
import {routeToPickerItem, singleGroup, sortRoutesAlphabetically, trimLineSuffix} from './shared';

export const getPhiladelphiaRailModeLabel = () => 'Regional Rail';

export const formatPhiladelphiaRailRoutePickerLabel = (
  routeId: string,
  routeLabel: string,
) => trimLineSuffix(routeLabel.trim() || routeId.trim());

export const getPhiladelphiaRailLineLabel = (
  routeId: string,
  routeLabel: string,
) => formatPhiladelphiaRailRoutePickerLabel(routeId, routeLabel);

export const getPhiladelphiaRailRouteBadgeLabel = (
  routeId: string,
  routeLabel?: string | null,
) => routeId.trim().toUpperCase() || trimLineSuffix((routeLabel ?? routeId).trim()).toUpperCase().slice(0, 4);

export const getPhiladelphiaRailDirectionLabel = (
  direction: UiDirection,
  variant: DirectionVariant = 'bound',
  terminal?: string | null,
) => {
  const base = direction === 'southbound' ? 'Outbound' : 'Inbound';
  if (!terminal) return base;
  return variant === 'summary' ? `${base} · ${terminal}` : `${base}: ${terminal}`;
};

export const serializePhiladelphiaRailDirection = (direction: UiDirection) =>
  direction === 'southbound' || direction === 'outbound' || direction === 'downtown' ? 'S' : 'N';

export const deserializePhiladelphiaRailDirection = (
  value: string | null | undefined,
  stopId?: string | null,
) => {
  const normalized = value?.trim().toUpperCase() ?? '';
  if (
    normalized === 'S' ||
    normalized === 'SOUTHBOUND' ||
    normalized === 'OUTBOUND' ||
    normalized === 'DOWNTOWN' ||
    (!normalized && (stopId?.trim().toUpperCase() ?? '').endsWith('S'))
  ) {
    return 'southbound' as const;
  }
  if (normalized === 'INBOUND') {
    return 'northbound' as const;
  }
  return 'northbound' as const;
};

export const preparePhiladelphiaRailRouteEntries = (
  routes: TransitRouteRecord[],
) => sortRoutesAlphabetically(routes).map(route =>
  routeToPickerItem(route, getPhiladelphiaRailLineLabel(route.id, route.label)),
);

export const buildPhiladelphiaRailRouteGroups = (
  routes: TransitRoutePickerItem[],
) => singleGroup('septa-rail', routes);
