import type {TransitRoutePickerItem, TransitRouteRecord} from '../../frontendTypes';
import {NJT_BUS_APPEARANCE, naturalRouteLabelCompare, routeToPickerItem, singleGroup} from './shared';

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

const sortNjtBusRoutes = (routes: TransitRouteRecord[]) =>
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

export const getNjtBusModeLabel = () => 'Bus';

export const formatNjtBusRoutePickerLabel = (
  routeId: string,
  routeLabel: string,
) => routeId.trim() || routeLabel.trim();

export const getNjtBusLineLabel = (
  routeId: string,
  routeLabel: string,
) => routeLabel.trim() || routeId.trim();

export const getNjtBusRouteBadgeLabel = (
  routeId: string,
  routeLabel?: string | null,
) => routeId.trim().toUpperCase() || (routeLabel ?? routeId).trim().toUpperCase().slice(0, 4);

export const getNjtBusDirectionLabel = (
  direction: string,
  headsign?: string | null,
): string => {
  if (headsign) return `To ${headsign}`;
  return direction === 'dir1' ? 'Direction 1' : 'Direction 0';
};

export const serializeNjtBusDirection = (direction: string) =>
  direction === 'dir1' ? '1' : '0';

export const deserializeNjtBusDirection = (value: string | null | undefined) => {
  const normalized = value?.trim() ?? '';
  return normalized === '1' || normalized === 'DIR1' ? 'dir1' as const : 'dir0' as const;
};

export const getNjtBusRouteBadgeAppearance = (_routeId: string) => NJT_BUS_APPEARANCE;

export const prepareNjtBusRouteEntries = (
  routes: TransitRouteRecord[],
) => sortNjtBusRoutes(routes).map(route =>
  routeToPickerItem(route, formatNjtBusRoutePickerLabel(route.id, route.label)),
);

export const buildNjtBusRouteGroups = (
  routes: TransitRoutePickerItem[],
) => singleGroup('njt-bus', routes);
