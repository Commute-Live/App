import type {DirectionVariant, UiDirection} from '../../frontendTypes';

export const getNewYorkLirrModeLabel = () => 'LIRR';

const MTA_LIRR_LINE_LABELS: Record<string, string> = {
  '1': 'Babylon Branch',
  '2': 'Hempstead Branch',
  '3': 'Oyster Bay Branch',
  '4': 'Ronkonkoma Branch',
  '5': 'Montauk Branch',
  '6': 'Long Beach Branch',
  '7': 'Far Rockaway Branch',
  '8': 'West Hempstead Branch',
  '9': 'Port Washington Branch',
  '10': 'Port Jefferson Branch',
  '12': 'City Terminal Zone',
  '13': 'Greenport Service',
};

const normalizeToken = (value: string | null | undefined) => value?.trim().toUpperCase() ?? '';

const resolveNewYorkLirrLabel = (routeId: string, routeLabel: string) => {
  const trimmedLabel = routeLabel.trim();
  if (trimmedLabel.length > 0 && normalizeToken(trimmedLabel) !== normalizeToken(routeId)) {
    return trimmedLabel;
  }
  return MTA_LIRR_LINE_LABELS[normalizeToken(routeId)] ?? trimmedLabel ?? routeId.trim();
};

export const formatNewYorkLirrRoutePickerLabel = (
  routeId: string,
  routeLabel: string,
) => resolveNewYorkLirrLabel(routeId, routeLabel);

export const getNewYorkLirrLineLabel = (
  routeId: string,
  routeLabel: string,
) => resolveNewYorkLirrLabel(routeId, routeLabel).replace(/\s+Branch$/i, '').trim();

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
