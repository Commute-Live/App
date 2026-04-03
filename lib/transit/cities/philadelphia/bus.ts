import type {TransitRoutePickerItem, TransitRouteRecord} from '../../frontendTypes';
import {naturalRouteLabelCompare, routeToPickerItem, singleGroup} from './shared';

const normalizeBusSortLabel = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '');

const busSortParts = (value: string) => {
  const normalized = normalizeBusSortLabel(value);
  const match = normalized.match(/^([A-Z]+)?(\d+)?([A-Z]*)$/);
  if (!match) {
    return {prefix: normalized, number: Number.MAX_SAFE_INTEGER, suffix: ''};
  }
  return {
    prefix: match[1] ?? '',
    number: match[2] ? Number(match[2]) : Number.MAX_SAFE_INTEGER,
    suffix: match[3] ?? '',
  };
};

const sortPhiladelphiaBusRoutes = (routes: TransitRouteRecord[]) =>
  [...routes].sort((left, right) => {
    const leftParts = busSortParts(left.id);
    const rightParts = busSortParts(right.id);
    const prefixCompare = naturalRouteLabelCompare(leftParts.prefix, rightParts.prefix);
    if (prefixCompare !== 0) return prefixCompare;
    if (leftParts.number !== rightParts.number) return leftParts.number - rightParts.number;
    const suffixCompare = naturalRouteLabelCompare(leftParts.suffix, rightParts.suffix);
    if (suffixCompare !== 0) return suffixCompare;
    return naturalRouteLabelCompare(left.label, right.label);
  });

export const getPhiladelphiaBusModeLabel = () => 'Bus';

export const formatPhiladelphiaBusRoutePickerLabel = (
  routeId: string,
  routeLabel: string,
) => routeId.trim() || routeLabel.trim();

export const getPhiladelphiaBusLineLabel = (
  routeId: string,
  routeLabel: string,
) => routeLabel.trim() || routeId.trim();

export const getPhiladelphiaBusRouteBadgeLabel = (
  routeId: string,
  routeLabel?: string | null,
) => routeId.trim().toUpperCase() || (routeLabel ?? routeId).trim().toUpperCase().slice(0, 4);

export const getPhiladelphiaBusDirectionLabel = (
  direction: string,
  headsign?: string | null,
): string => {
  if (headsign) return `To ${headsign}`;
  return direction === 'dir1' ? 'Direction 1' : 'Direction 0';
};

export const serializePhiladelphiaBusDirection = (direction: string) =>
  direction === 'dir1' || direction === 'downtown' ? '1' : '0';

export const deserializePhiladelphiaBusDirection = (value: string | null | undefined) => {
  const normalized = value?.trim().toUpperCase() ?? '';
  return normalized === '1' || normalized === 'DIR1' || normalized === 'DOWNTOWN'
    ? 'dir1' as const
    : 'dir0' as const;
};

export const preparePhiladelphiaBusRouteEntries = (
  routes: TransitRouteRecord[],
) => sortPhiladelphiaBusRoutes(routes).map(route =>
  routeToPickerItem(route, formatPhiladelphiaBusRoutePickerLabel(route.id, route.label)),
);

export const buildPhiladelphiaBusRouteGroups = (
  routes: TransitRoutePickerItem[],
) => singleGroup('septa-bus', routes);
