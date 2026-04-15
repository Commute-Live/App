import type {ModeId, TransitRoutePickerItem, TransitRouteRecord, UiDirection} from '../../frontendTypes';
import type {TransitCityModule} from '../types';
import {
  buildNewYorkBusRouteGroups,
  formatNewYorkBusRoutePickerLabel,
  getNewYorkBusDirectionLabel,
  getNewYorkBusHeadsign,
  prepareNewYorkBusRouteEntries,
  resolveNewYorkBusAppearance,
} from './bus';
import {
  getNewYorkLirrDirectionLabel,
  getNewYorkLirrHeadsign,
  getNewYorkLirrLineLabel,
  getNewYorkLirrModeLabel,
  formatNewYorkLirrRoutePickerLabel,
} from './lirr';
import {
  getNewYorkMnrDirectionLabel,
  getNewYorkMnrHeadsign,
  getNewYorkMnrLineLabel,
  getNewYorkMnrModeLabel,
  formatNewYorkMnrRoutePickerLabel,
} from './mnr';
import {
  deserializeNorthSouthDirection,
  dedupeRoutesForPicker,
  serializeNorthSouthDirection,
} from './shared';
import {
  buildNewYorkSubwayRouteGroups,
  formatNewYorkSubwayRoutePickerLabel,
  getNewYorkSubwayDirectionLabel,
  getNewYorkSubwayLineLabel,
  isNewYorkSubwayExpressRouteBadge,
  isNewYorkSubwayExpressVariant,
  prepareNewYorkSubwayRouteEntries,
} from './subway';

export type NewYorkMode = Extract<ModeId, 'train' | 'bus' | 'lirr' | 'mnr'>;

export const isNewYorkMode = (mode: ModeId): mode is NewYorkMode =>
  mode === 'train' || mode === 'bus' || mode === 'lirr' || mode === 'mnr';

export const getNewYorkModeLabel = (mode: NewYorkMode) => {
  if (mode === 'train') return 'Subway';
  if (mode === 'bus') return 'Bus';
  if (mode === 'lirr') return getNewYorkLirrModeLabel();
  return getNewYorkMnrModeLabel();
};

export const formatNewYorkRoutePickerLabel = (
  mode: NewYorkMode,
  routeId: string,
  routeLabel: string,
) => {
  if (mode === 'train') return formatNewYorkSubwayRoutePickerLabel(routeId, routeLabel);
  if (mode === 'bus') return formatNewYorkBusRoutePickerLabel(routeId, routeLabel);
  if (mode === 'lirr') return formatNewYorkLirrRoutePickerLabel(routeId, routeLabel);
  return formatNewYorkMnrRoutePickerLabel(routeId, routeLabel);
};

export const getNewYorkLineLabel = (
  mode: NewYorkMode,
  routeId: string,
  routeLabel: string,
) => {
  if (mode === 'train') return getNewYorkSubwayLineLabel(routeId, routeLabel);
  if (mode === 'bus') return formatNewYorkBusRoutePickerLabel(routeId, routeLabel);
  if (mode === 'lirr') return getNewYorkLirrLineLabel(routeId, routeLabel);
  return getNewYorkMnrLineLabel(routeId, routeLabel);
};

export const getNewYorkDirectionLabel = (
  mode: NewYorkMode,
  direction: UiDirection,
  route?: TransitRouteRecord | string,
  variant: 'toggle' | 'bound' | 'summary' = 'bound',
) => {
  if (mode === 'train') return getNewYorkSubwayDirectionLabel(direction, variant);
  if (mode === 'bus') return getNewYorkBusDirectionLabel(direction, route, variant);
  if (mode === 'lirr') return getNewYorkLirrDirectionLabel(direction, variant);
  if (mode === 'mnr') return getNewYorkMnrDirectionLabel(direction, variant);
  return null;
};

const serializeNewYorkBusDirection = (direction: UiDirection) =>
  direction === 'dir1' ? '1' : '0';

const serializeNewYorkLirrDirection = (direction: UiDirection) =>
  direction === 'eastbound' ? '0' : '1';

const serializeNewYorkMnrDirection = (direction: UiDirection) =>
  direction === 'inbound' ? '1' : '0';

export const serializeNewYorkDirection = (mode: NewYorkMode, direction: UiDirection) => {
  if (mode === 'train') return serializeNorthSouthDirection(direction);
  if (mode === 'bus') return serializeNewYorkBusDirection(direction);
  if (mode === 'lirr') return serializeNewYorkLirrDirection(direction);
  return serializeNewYorkMnrDirection(direction);
};

const deserializeNewYorkBusDirection = (value: string | null | undefined) => {
  const normalized = value?.trim().toUpperCase() ?? '';
  if (normalized === '1' || normalized === 'DIR1') return 'dir1' as const;
  return 'dir0' as const;
};

const deserializeNewYorkLirrDirection = (value: string | null | undefined) => {
  const normalized = value?.trim().toUpperCase() ?? '';
  if (normalized === '1' || normalized === 'W' || normalized === 'WESTBOUND') return 'westbound' as const;
  if (normalized === '0' || normalized === 'E' || normalized === 'EASTBOUND') return 'eastbound' as const;
  return 'westbound' as const;
};

const deserializeNewYorkMnrDirection = (value: string | null | undefined) => {
  const normalized = value?.trim().toUpperCase() ?? '';
  if (normalized === '1' || normalized === 'INBOUND') return 'inbound' as const;
  if (normalized === '0' || normalized === 'OUTBOUND') return 'outbound' as const;
  return 'outbound' as const;
};

export const deserializeNewYorkDirection = (
  mode: NewYorkMode,
  value: string | null | undefined,
  stopId?: string | null,
) => {
  if (mode === 'train') return deserializeNorthSouthDirection(value, stopId);
  if (mode === 'bus') return deserializeNewYorkBusDirection(value);
  if (mode === 'lirr') return deserializeNewYorkLirrDirection(value);
  return deserializeNewYorkMnrDirection(value);
};

export const normalizeNewYorkSavedStationId = (
  provider: string,
  stopId: string,
) => {
  const normalizedProvider = provider.trim().toLowerCase();
  const normalizedStopId = stopId.trim().toUpperCase();
  if (normalizedProvider === 'mta-subway' && /[NS]$/.test(normalizedStopId)) {
    return normalizedStopId.slice(0, -1);
  }
  return normalizedStopId;
};

export const resolveNewYorkRouteAppearance = (
  mode: NewYorkMode,
  lineId: string,
  label?: string | null,
) => {
  if (mode !== 'bus') return null;
  return resolveNewYorkBusAppearance(lineId, label);
};

export const isNewYorkBusBadge = (mode: ModeId) => mode === 'bus';

export const prepareNewYorkRouteEntries = (
  mode: NewYorkMode,
  routes: TransitRouteRecord[],
) => {
  if (mode === 'train') return prepareNewYorkSubwayRouteEntries(routes);
  const deduped = dedupeRoutesForPicker(routes);
  if (mode === 'bus') return prepareNewYorkBusRouteEntries(deduped);
  return null;
};

export const buildNewYorkRouteGroups = (
  mode: NewYorkMode,
  routes: TransitRoutePickerItem[],
) => {
  if (mode === 'train') return buildNewYorkSubwayRouteGroups(routes);
  if (mode === 'bus') return buildNewYorkBusRouteGroups(routes);
  return null;
};

export const isNewYorkExpressRouteBadge = (
  mode: NewYorkMode,
  route: TransitRoutePickerItem,
) => {
  if (mode !== 'train') return false;
  return isNewYorkSubwayExpressRouteBadge(route);
};

export const isNewYorkExpressVariant = (route: {label: string}) =>
  isNewYorkSubwayExpressVariant(route);

export const newYorkTransitModule: TransitCityModule = {
  city: 'new-york',
  modeOrder: ['train', 'bus', 'lirr', 'mnr'],
  backendProvidersByMode: {
    train: 'mta-subway',
    bus: 'mta-bus',
    lirr: 'mta-lirr',
    mnr: 'mta-mnr',
  },
  getModeLabel: mode => (isNewYorkMode(mode) ? getNewYorkModeLabel(mode) : null),
  formatRoutePickerLabel: (mode, routeId, routeLabel) =>
    isNewYorkMode(mode) ? formatNewYorkRoutePickerLabel(mode, routeId, routeLabel) : null,
  getLineLabel: (mode, routeId, routeLabel) =>
    isNewYorkMode(mode) ? getNewYorkLineLabel(mode, routeId, routeLabel) : null,
  getRouteBadgeLabel: (mode, routeId, routeLabel, routeShortName) => {
    if (!isNewYorkMode(mode)) return null;
    if (mode === 'train') return (routeShortName?.trim() || routeId.trim()).toUpperCase();
    if (mode === 'bus') return formatNewYorkBusRoutePickerLabel(routeId, routeLabel ?? routeId);
    if (mode === 'lirr') return getNewYorkLirrLineLabel(routeId, routeLabel ?? routeId).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (mode === 'mnr') return routeId.trim().toUpperCase().slice(0, 4);
    return (routeShortName?.trim() || routeId.trim() || routeLabel?.trim() || '').toUpperCase().slice(0, 4);
  },
  getDirectionLabel: (mode, direction, routeId, variant) =>
    isNewYorkMode(mode) ? getNewYorkDirectionLabel(mode, direction, routeId ?? undefined, variant) : null,
  serializeDirection: (mode, direction) =>
    isNewYorkMode(mode) ? serializeNewYorkDirection(mode, direction) : null,
  deserializeDirection: (mode, value, stopId) =>
    isNewYorkMode(mode) ? deserializeNewYorkDirection(mode, value, stopId) : null,
  normalizeSavedStationId: normalizeNewYorkSavedStationId,
  prepareRouteEntries: (mode, routes) =>
    isNewYorkMode(mode) ? prepareNewYorkRouteEntries(mode, routes) : null,
  buildRouteGroups: (mode, routes) =>
    isNewYorkMode(mode) ? buildNewYorkRouteGroups(mode, routes) : null,
  resolveRouteAppearance: (mode, lineId, label) =>
    isNewYorkMode(mode) ? resolveNewYorkRouteAppearance(mode, lineId, label) : null,
  isBusBadge: mode => mode === 'bus',
  isExpressRouteBadge: (mode, route) =>
    isNewYorkMode(mode) ? isNewYorkExpressRouteBadge(mode, route) : false,
  isExpressVariant: (mode, route) =>
    mode === 'train' ? isNewYorkExpressVariant(route) : false,
};

export {getNewYorkLirrHeadsign};
export {getNewYorkLirrDirectionLabel};
export {getNewYorkBusHeadsign};
export {getNewYorkBusDirectionLabel};
export {getNewYorkMnrHeadsign};
export {getNewYorkMnrDirectionLabel};
