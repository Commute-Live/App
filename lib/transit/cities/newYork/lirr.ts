import type {DirectionVariant, TransitRouteRecord, UiDirection} from '../../frontendTypes';

export const getNewYorkLirrModeLabel = () => 'LIRR';

export const formatNewYorkLirrRoutePickerLabel = (
  routeId: string,
  routeLabel: string,
) => routeLabel.trim() || routeId.trim();

export const getNewYorkLirrLineLabel = (
  _routeId: string,
  routeLabel: string,
) => routeLabel.replace(/\s+Branch$/i, '').trim();

type LirrRouteRef =
  | string
  | {
      id?: string;
      label?: string;
      headsign0?: string | null;
      headsign1?: string | null;
    }
  | null
  | undefined;

const trimOptionalString = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
};

const getLirrDirectionTerm = (direction: UiDirection) =>
  direction === 'eastbound' ? 'Eastbound' : 'Westbound';

export const getNewYorkLirrHeadsign = (
  route: LirrRouteRef,
  direction: UiDirection,
) => {
  if (!route || typeof route === 'string') return null;
  return trimOptionalString(direction === 'eastbound' ? route.headsign0 : route.headsign1);
};

export const getNewYorkLirrDirectionLabel = (
  direction: UiDirection,
  route?: LirrRouteRef,
  variant: DirectionVariant = 'bound',
) => {
  const directionTerm = getLirrDirectionTerm(direction);
  const headsign = getNewYorkLirrHeadsign(route, direction);
  if (!headsign) return directionTerm;
  if (variant === 'toggle') return `${directionTerm}: ${headsign}`;
  if (variant === 'summary') return `${directionTerm}: ${headsign}`;
  return `${directionTerm}: ${headsign}`;
};
