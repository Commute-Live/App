import type {TransitRoutePickerItem, TransitRouteRecord} from '../../frontendTypes';
import {NJT_RAIL_APPEARANCE, routeToPickerItem, singleGroup, sortRoutesAlphabetically, trimLineSuffix} from './shared';

export const getNjtRailModeLabel = () => 'Rail';

export const formatNjtRailRoutePickerLabel = (
  routeId: string,
  routeLabel: string,
) => trimLineSuffix(routeLabel.trim() || routeId.trim());

export const getNjtRailLineLabel = (
  routeId: string,
  routeLabel: string,
) => formatNjtRailRoutePickerLabel(routeId, routeLabel);

export const getNjtRailRouteBadgeLabel = (
  routeId: string,
  routeLabel?: string | null,
  routeShortName?: string | null,
) => {
  const shortName = (routeShortName ?? '').trim().toUpperCase();
  if (shortName) return shortName;
  const label = (routeLabel ?? '').trim();
  if (label && !/^\d+$/.test(label)) return trimLineSuffix(label).toUpperCase().slice(0, 5);
  return routeId.trim().toUpperCase() || trimLineSuffix((routeLabel ?? routeId).trim()).toUpperCase().slice(0, 5);
};

export const getNjtRailDirectionLabel = (
  direction: string,
  headsign?: string | null,
): string => {
  if (headsign) return `To ${headsign}`;
  return direction === 'dir1' ? 'Direction 1' : 'Direction 0';
};

export const serializeNjtRailDirection = (direction: string) =>
  direction === 'dir1' ? '1' : '0';

export const deserializeNjtRailDirection = (value: string | null | undefined) => {
  const normalized = value?.trim() ?? '';
  return normalized === '1' || normalized === 'DIR1' ? 'dir1' as const : 'dir0' as const;
};

export const getNjtRailRouteBadgeAppearance = (_routeId: string) => NJT_RAIL_APPEARANCE;

export const prepareNjtRailRouteEntries = (
  routes: TransitRouteRecord[],
) => sortRoutesAlphabetically(routes).map(route =>
  routeToPickerItem(route, getNjtRailLineLabel(route.id, route.label)),
);

export const buildNjtRailRouteGroups = (
  routes: TransitRoutePickerItem[],
) => singleGroup('njt-rail', routes);
