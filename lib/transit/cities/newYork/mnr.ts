import type {DirectionVariant, UiDirection} from '../../frontendTypes';

const MTA_MNR_LINE_LABELS: Record<string, string> = {
  '1': 'Hudson',
  '2': 'Harlem',
  '3': 'New Haven',
  '4': 'New Canaan',
  '5': 'Danbury',
  '6': 'Waterbury',
};

const normalizeToken = (value: string | null | undefined) => value?.trim().toUpperCase() ?? '';

export const getNewYorkMnrModeLabel = () => 'Metro-North';

export const formatNewYorkMnrRoutePickerLabel = (
  routeId: string,
  routeLabel: string,
) => routeLabel.trim() || routeId.trim();

export const getNewYorkMnrLineLabel = (
  routeId: string,
  routeLabel: string,
) => MTA_MNR_LINE_LABELS[normalizeToken(routeId)] ?? routeLabel.trim();

type MnrRouteRef =
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

const getMnrDirectionTerm = (direction: UiDirection) =>
  direction === 'inbound' ? 'Inbound' : 'Outbound';

export const getNewYorkMnrHeadsign = (
  route: MnrRouteRef,
  direction: UiDirection,
) => {
  if (!route || typeof route === 'string') return null;
  return trimOptionalString(direction === 'inbound' ? route.headsign1 : route.headsign0);
};

export const getNewYorkMnrDirectionLabel = (
  direction: UiDirection,
  route?: MnrRouteRef,
  variant: DirectionVariant = 'bound',
) => {
  const directionTerm = getMnrDirectionTerm(direction);
  const headsign = getNewYorkMnrHeadsign(route, direction);
  if (!headsign) return directionTerm;
  if (variant === 'summary') return `${directionTerm}: ${headsign}`;
  return `${directionTerm}: ${headsign}`;
};
