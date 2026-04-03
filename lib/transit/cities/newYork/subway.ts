import type {
  DirectionVariant,
  TransitRouteGroup,
  TransitRoutePickerItem,
  TransitRouteRecord,
  UiDirection,
} from '../../frontendTypes';
import {
  defaultDirectionLabel,
  naturalRouteLabelCompare,
  normalizeRoutePickerLabel,
} from './shared';

const getSubwayGroupOrder = () => {
  const groups = [
    ['1', '2', '3'],
    ['A', 'C', 'E'],
    ['4', '5', '6', '6X'],
    ['N', 'Q', 'R', 'W'],
    ['B', 'D', 'F', 'M'],
    ['7', '7X'],
    ['G', 'J', 'Z', 'L', 'S', 'FS', 'GS', 'SI'],
  ];

  const order = new Map<string, number>();
  groups.forEach((labels, index) => {
    labels.forEach(label => order.set(label, index));
  });
  return order;
};

const getSubwayBaseLabel = (route: TransitRouteRecord) => {
  const label = normalizeRoutePickerLabel(route);
  if (label === 'FX') return 'F';
  if (label.endsWith('X') && /^\d/.test(label)) return label.slice(0, -1);
  return label;
};

export const isNewYorkSubwayExpressVariant = (route: {label: string}) => {
  const label = normalizeRoutePickerLabel(route);
  return label.endsWith('X') || label === 'FX';
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
  const grouped = new Map<string, TransitRouteRecord[]>();

  for (const route of routes) {
    const key = getSubwayBaseLabel(route);
    const current = grouped.get(key) ?? [];
    current.push(route);
    grouped.set(key, current);
  }

  const groupOrder = getSubwayGroupOrder();

  return [...grouped.entries()]
    .map(([key, variants]) => {
      const sortedVariants = [...variants].sort((left, right) => {
        const leftPriority = isNewYorkSubwayExpressVariant(left) ? 1 : 0;
        const rightPriority = isNewYorkSubwayExpressVariant(right) ? 1 : 0;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return naturalRouteLabelCompare(left.label, right.label);
      });
      const primary = sortedVariants[0];
      return {
        id: key,
        label: key,
        displayLabel: key,
        color: primary.color,
        textColor: primary.textColor,
        routes: sortedVariants,
      };
    })
    .sort((left, right) => {
      const leftGroup = groupOrder.get(left.label.toUpperCase()) ?? 999;
      const rightGroup = groupOrder.get(right.label.toUpperCase()) ?? 999;
      if (leftGroup !== rightGroup) return leftGroup - rightGroup;
      return naturalRouteLabelCompare(left.label, right.label);
    });
};

export const buildNewYorkSubwayRouteGroups = (
  routes: TransitRoutePickerItem[],
): TransitRouteGroup[] => {
  const rows = [
    {key: 'row-1', labels: ['1', '2', '3']},
    {key: 'row-2', labels: ['4', '5', '6', '6X', '7', '7X']},
    {key: 'row-3', labels: ['A', 'C', 'E']},
    {key: 'row-4', labels: ['N', 'Q', 'R', 'W']},
    {key: 'row-5', labels: ['B', 'D', 'F', 'M']},
    {key: 'row-6', labels: ['L', 'G', 'J', 'Z', 'S', 'FS', 'GS', 'SI']},
  ];

  return rows
    .map(row => {
      const order = new Map(row.labels.map((label, index) => [label, index]));
      const rowRoutes = routes.filter(route => order.has(normalizeRoutePickerLabel(route)));
      return {
        key: row.key,
        routes: [...rowRoutes].sort((left, right) => {
          const leftOrder = order.get(normalizeRoutePickerLabel(left)) ?? 999;
          const rightOrder = order.get(normalizeRoutePickerLabel(right)) ?? 999;
          if (leftOrder !== rightOrder) return leftOrder - rightOrder;
          return naturalRouteLabelCompare(left.label, right.label);
        }),
      };
    })
    .filter(group => group.routes.length > 0);
};

export const isNewYorkSubwayExpressRouteBadge = (
  route: TransitRoutePickerItem,
) => route.routes.length === 1 && isNewYorkSubwayExpressVariant(route.routes[0]);
