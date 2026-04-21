import type {
  DirectionVariant,
  TransitRouteGroup,
  TransitRoutePickerItem,
  TransitRouteRecord,
  UiDirection,
} from '../../frontendTypes';
import {
  compareDuplicateRouteCandidates,
  defaultDirectionLabel,
  naturalRouteLabelCompare,
} from './shared';

const normalizeSubwayRouteToken = (
  route: Pick<TransitRouteRecord, 'id' | 'label' | 'shortName'>,
) => (route.id.trim() || route.shortName?.trim() || route.label.trim()).toUpperCase();

const NEW_YORK_SUBWAY_GROUPS = [
  ['1', '2', '3'],
  ['4', '5', '6', '7'],
  ['A', 'C', 'E'],
  ['N', 'Q', 'R', 'W'],
  ['B', 'D', 'F', 'M'],
  ['L', 'G', 'J', 'Z'],
] as const;

const NEW_YORK_SUBWAY_GROUP_INDEX = new Map<string, {groupIndex: number; lineIndex: number}>(
  NEW_YORK_SUBWAY_GROUPS.flatMap((group, groupIndex) =>
    group.map((lineId, lineIndex) => [lineId, {groupIndex, lineIndex}] as const),
  ),
);

const normalizeSubwayBaseToken = (value: string) =>
  /^[0-9A-Z]+X$/.test(value) ? value.slice(0, -1) : value;

const compareSubwayVariantPriority = (
  left: TransitRouteRecord,
  right: TransitRouteRecord,
  baseToken: string,
) => {
  const leftToken = normalizeSubwayRouteToken(left);
  const rightToken = normalizeSubwayRouteToken(right);
  const leftExact = leftToken === baseToken ? 0 : 1;
  const rightExact = rightToken === baseToken ? 0 : 1;

  if (leftExact !== rightExact) return leftExact - rightExact;

  const leftOrder = left.sortOrder;
  const rightOrder = right.sortOrder;
  if (
    leftOrder !== null &&
    leftOrder !== undefined &&
    rightOrder !== null &&
    rightOrder !== undefined &&
    leftOrder !== rightOrder
  ) {
    return leftOrder - rightOrder;
  }

  return compareDuplicateRouteCandidates(left, right);
};

const compareSubwayPickerItems = (
  left: TransitRoutePickerItem,
  right: TransitRoutePickerItem,
) => {
  const leftCanonical = NEW_YORK_SUBWAY_GROUP_INDEX.get(left.id);
  const rightCanonical = NEW_YORK_SUBWAY_GROUP_INDEX.get(right.id);

  if (leftCanonical && rightCanonical) {
    if (leftCanonical.groupIndex !== rightCanonical.groupIndex) {
      return leftCanonical.groupIndex - rightCanonical.groupIndex;
    }
    if (leftCanonical.lineIndex !== rightCanonical.lineIndex) {
      return leftCanonical.lineIndex - rightCanonical.lineIndex;
    }
  } else if (leftCanonical || rightCanonical) {
    return leftCanonical ? -1 : 1;
  }

  return naturalRouteLabelCompare(left.label, right.label);
};

export const isNewYorkSubwayExpressVariant = (
  route: {id?: string; label: string; shortName?: string | null},
) => {
  const label = (route.id?.trim() || route.shortName?.trim() || route.label.trim()).toUpperCase();
  return label.endsWith('X');
};

export const getNewYorkSubwayDirectionLabel = (
  direction: UiDirection,
  variant: DirectionVariant = 'bound',
) => defaultDirectionLabel(direction, variant);

export const formatNewYorkSubwayRoutePickerLabel = (
  routeId: string,
  routeLabel: string,
) => routeLabel.trim() || routeId.trim();

export const getNewYorkSubwayLineLabel = (
  routeId: string,
  routeLabel: string,
) => formatNewYorkSubwayRoutePickerLabel(routeId, routeLabel);

export const prepareNewYorkSubwayRouteEntries = (
  routes: TransitRouteRecord[],
): TransitRoutePickerItem[] => {
  const groupedRoutes = new Map<string, TransitRouteRecord[]>();

  for (const route of routes) {
    const routeToken = normalizeSubwayRouteToken(route);
    const baseToken = normalizeSubwayBaseToken(routeToken);
    const existing = groupedRoutes.get(baseToken);
    if (existing) existing.push(route);
    else groupedRoutes.set(baseToken, [route]);
  }

  return [...groupedRoutes.entries()]
    .map(([baseToken, variants]) => {
      const sortedVariants = [...variants].sort((left, right) =>
        compareSubwayVariantPriority(left, right, baseToken),
      );
      const primary = sortedVariants[0];

      return {
        id: baseToken,
        shortName: primary?.shortName?.trim() || baseToken,
        label: baseToken,
        displayLabel: baseToken,
        color: primary?.color ?? '#808183',
        textColor: primary?.textColor,
        routes: sortedVariants,
      };
    })
    .sort(compareSubwayPickerItems);
};

export const buildNewYorkSubwayRouteGroups = (
  routes: TransitRoutePickerItem[],
): TransitRouteGroup[] => {
  if (routes.length === 0) return [];

  const routeMap = new Map(routes.map(route => [route.id, route] as const));
  const consumed = new Set<string>();
  const groups: TransitRouteGroup[] = [];

  NEW_YORK_SUBWAY_GROUPS.forEach((lineIds, index) => {
    const groupRoutes = lineIds
      .map(lineId => routeMap.get(lineId))
      .filter((route): route is TransitRoutePickerItem => route !== undefined);

    if (groupRoutes.length === 0) return;

    groupRoutes.forEach(route => consumed.add(route.id));
    groups.push({key: `subway-group-${index}`, routes: groupRoutes});
  });

  const remainingRoutes = routes.filter(route => !consumed.has(route.id));
  if (remainingRoutes.length > 0) {
    groups.push({key: 'subway-group-extra', routes: remainingRoutes});
  }

  return groups;
};

export const isNewYorkSubwayExpressRouteBadge = (
  route: TransitRoutePickerItem,
) => route.routes.length === 1 && isNewYorkSubwayExpressVariant(route.routes[0]);
