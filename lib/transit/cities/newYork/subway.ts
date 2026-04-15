import type {
  DirectionVariant,
  TransitRouteGroup,
  TransitRoutePickerItem,
  TransitRouteRecord,
  UiDirection,
} from '../../frontendTypes';
import {defaultDirectionLabel, naturalRouteLabelCompare} from './shared';

const normalizeSubwayRouteToken = (
  route: Pick<TransitRouteRecord, 'id' | 'label' | 'shortName'>,
) => (route.id.trim() || route.shortName?.trim() || route.label.trim()).toUpperCase();

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
  return routes
    .map(route => {
      const label = normalizeSubwayRouteToken(route);
      return {
        id: route.id,
        shortName: route.shortName,
        label,
        displayLabel: label,
        color: route.color,
        textColor: route.textColor,
        routes: [route],
      };
    })
    .sort((left, right) => {
      const leftOrder = left.routes[0]?.sortOrder;
      const rightOrder = right.routes[0]?.sortOrder;
      if (leftOrder !== null && leftOrder !== undefined && rightOrder !== null && rightOrder !== undefined && leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return naturalRouteLabelCompare(left.label, right.label);
    });
};

export const buildNewYorkSubwayRouteGroups = (
  routes: TransitRoutePickerItem[],
): TransitRouteGroup[] => {
  return routes.length > 0 ? [{key: 'api-lines', routes}] : [];
};

export const isNewYorkSubwayExpressRouteBadge = (
  route: TransitRoutePickerItem,
) => route.routes.length === 1 && isNewYorkSubwayExpressVariant(route.routes[0]);
