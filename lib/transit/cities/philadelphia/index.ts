import type {ModeId, UiDirection} from '../../frontendTypes';
import type {TransitCityModule} from '../types';
import {
  buildPhiladelphiaBusRouteGroups,
  formatPhiladelphiaBusRoutePickerLabel,
  getPhiladelphiaBusDirectionLabel,
  getPhiladelphiaBusLineLabel,
  getPhiladelphiaBusModeLabel,
  getPhiladelphiaBusRouteBadgeLabel,
  preparePhiladelphiaBusRouteEntries,
  serializePhiladelphiaBusDirection,
  deserializePhiladelphiaBusDirection,
} from './bus';
import {
  buildPhiladelphiaRailRouteGroups,
  formatPhiladelphiaRailRoutePickerLabel,
  getPhiladelphiaRailDirectionLabel,
  getPhiladelphiaRailLineLabel,
  getPhiladelphiaRailModeLabel,
  getPhiladelphiaRailRouteBadgeLabel,
  preparePhiladelphiaRailRouteEntries,
  serializePhiladelphiaRailDirection,
  deserializePhiladelphiaRailDirection,
} from './rail';
import {
  buildPhiladelphiaTrolleyRouteGroups,
  formatPhiladelphiaTrolleyRoutePickerLabel,
  getPhiladelphiaTrolleyDirectionLabel,
  getPhiladelphiaTrolleyLineLabel,
  getPhiladelphiaTrolleyModeLabel,
  getPhiladelphiaTrolleyRouteBadgeLabel,
  preparePhiladelphiaTrolleyRouteEntries,
  serializePhiladelphiaTrolleyDirection,
  deserializePhiladelphiaTrolleyDirection,
} from './trolley';
import {getPhiladelphiaRouteBadgeAppearance} from './shared';

export type PhiladelphiaMode = Extract<ModeId, 'train' | 'bus' | 'trolley'>;

export const isPhiladelphiaMode = (mode: ModeId): mode is PhiladelphiaMode =>
  mode === 'train' || mode === 'bus' || mode === 'trolley';

export const getPhiladelphiaModeLabel = (mode: PhiladelphiaMode) => {
  if (mode === 'train') return getPhiladelphiaRailModeLabel();
  if (mode === 'trolley') return getPhiladelphiaTrolleyModeLabel();
  return getPhiladelphiaBusModeLabel();
};

export const formatPhiladelphiaRoutePickerLabel = (
  mode: PhiladelphiaMode,
  routeId: string,
  routeLabel: string,
) => {
  if (mode === 'train') return formatPhiladelphiaRailRoutePickerLabel(routeId, routeLabel);
  if (mode === 'trolley') return formatPhiladelphiaTrolleyRoutePickerLabel(routeId, routeLabel);
  return formatPhiladelphiaBusRoutePickerLabel(routeId, routeLabel);
};

export const getPhiladelphiaLineLabel = (
  mode: PhiladelphiaMode,
  routeId: string,
  routeLabel: string,
) => {
  if (mode === 'train') return getPhiladelphiaRailLineLabel(routeId, routeLabel);
  if (mode === 'trolley') return getPhiladelphiaTrolleyLineLabel(routeId, routeLabel);
  return getPhiladelphiaBusLineLabel(routeId, routeLabel);
};

export const getPhiladelphiaRouteBadgeLabel = (
  mode: PhiladelphiaMode,
  routeId: string,
  routeLabel?: string | null,
) => {
  if (mode === 'train') return getPhiladelphiaRailRouteBadgeLabel(routeId, routeLabel);
  if (mode === 'trolley') return getPhiladelphiaTrolleyRouteBadgeLabel(routeId, routeLabel);
  return getPhiladelphiaBusRouteBadgeLabel(routeId, routeLabel);
};

export const getPhiladelphiaDirectionLabel = (
  mode: PhiladelphiaMode,
  direction: UiDirection,
  variant: 'toggle' | 'bound' | 'summary' = 'bound',
) => {
  if (mode === 'train') return getPhiladelphiaRailDirectionLabel(direction, variant);
  if (mode === 'trolley') return getPhiladelphiaTrolleyDirectionLabel(direction);
  return getPhiladelphiaBusDirectionLabel(direction);
};

export const serializePhiladelphiaDirection = (
  mode: PhiladelphiaMode,
  direction: UiDirection,
) => {
  if (mode === 'train') return serializePhiladelphiaRailDirection(direction);
  if (mode === 'trolley') return serializePhiladelphiaTrolleyDirection(direction);
  return serializePhiladelphiaBusDirection(direction);
};

export const deserializePhiladelphiaDirection = (
  mode: PhiladelphiaMode,
  value: string | null | undefined,
  stopId?: string | null,
) => {
  if (mode === 'train') return deserializePhiladelphiaRailDirection(value, stopId);
  if (mode === 'trolley') return deserializePhiladelphiaTrolleyDirection(value);
  return deserializePhiladelphiaBusDirection(value);
};

export const philadelphiaTransitModule: TransitCityModule = {
  city: 'philadelphia',
  modeOrder: ['train', 'bus', 'trolley'],
  backendProvidersByMode: {
    train: 'septa-rail',
    bus: 'septa-bus',
    trolley: 'septa-trolley',
  },
  getModeLabel: mode => (isPhiladelphiaMode(mode) ? getPhiladelphiaModeLabel(mode) : null),
  formatRoutePickerLabel: (mode, routeId, routeLabel) =>
    isPhiladelphiaMode(mode) ? formatPhiladelphiaRoutePickerLabel(mode, routeId, routeLabel) : null,
  getLineLabel: (mode, routeId, routeLabel) =>
    isPhiladelphiaMode(mode) ? getPhiladelphiaLineLabel(mode, routeId, routeLabel) : null,
  getRouteBadgeLabel: (mode, routeId, routeLabel) =>
    isPhiladelphiaMode(mode) ? getPhiladelphiaRouteBadgeLabel(mode, routeId, routeLabel) : null,
  getDirectionLabel: (mode, direction, _routeId, variant) =>
    isPhiladelphiaMode(mode) ? getPhiladelphiaDirectionLabel(mode, direction, variant) : null,
  serializeDirection: (mode, direction) =>
    isPhiladelphiaMode(mode) ? serializePhiladelphiaDirection(mode, direction) : null,
  deserializeDirection: (mode, value, stopId) =>
    isPhiladelphiaMode(mode) ? deserializePhiladelphiaDirection(mode, value, stopId) : null,
  normalizeSavedStationId: (_provider, stopId) => stopId.trim().toUpperCase(),
  prepareRouteEntries: (mode, routes) => {
    if (!isPhiladelphiaMode(mode)) return null;
    if (mode === 'train') return preparePhiladelphiaRailRouteEntries(routes);
    if (mode === 'trolley') return preparePhiladelphiaTrolleyRouteEntries(routes);
    return preparePhiladelphiaBusRouteEntries(routes);
  },
  buildRouteGroups: (mode, routes) => {
    if (!isPhiladelphiaMode(mode)) return null;
    if (mode === 'train') return buildPhiladelphiaRailRouteGroups(routes);
    if (mode === 'trolley') return buildPhiladelphiaTrolleyRouteGroups(routes);
    return buildPhiladelphiaBusRouteGroups(routes);
  },
  resolveRouteAppearance: (mode, lineId) => {
    if (!isPhiladelphiaMode(mode)) return null;
    return getPhiladelphiaRouteBadgeAppearance(mode, lineId);
  },
  isBusBadge: mode => mode === 'bus',
};
