import type {ModeId, UiDirection} from '../../frontendTypes';
import type {TransitCityModule} from '../types';
import {
  buildNjtBusRouteGroups,
  deserializeNjtBusDirection,
  formatNjtBusRoutePickerLabel,
  getNjtBusDirectionLabel,
  getNjtBusLineLabel,
  getNjtBusModeLabel,
  getNjtBusRouteBadgeAppearance,
  getNjtBusRouteBadgeLabel,
  prepareNjtBusRouteEntries,
  serializeNjtBusDirection,
} from './bus';
import {
  buildNjtRailRouteGroups,
  deserializeNjtRailDirection,
  formatNjtRailRoutePickerLabel,
  getNjtRailDirectionLabel,
  getNjtRailLineLabel,
  getNjtRailModeLabel,
  getNjtRailRouteBadgeAppearance,
  getNjtRailRouteBadgeLabel,
  prepareNjtRailRouteEntries,
  serializeNjtRailDirection,
} from './rail';

export type NewJerseyMode = Extract<ModeId, 'train' | 'bus'>;

export const isNewJerseyMode = (mode: ModeId): mode is NewJerseyMode =>
  mode === 'train' || mode === 'bus';

export const newJerseyTransitModule: TransitCityModule = {
  city: 'new-jersey',
  modeOrder: ['train', 'bus'],
  backendProvidersByMode: {
    train: 'njt-rail',
    bus: 'njt-bus',
  },
  getModeLabel: mode => {
    if (mode === 'train') return getNjtRailModeLabel();
    if (mode === 'bus') return getNjtBusModeLabel();
    return null;
  },
  formatRoutePickerLabel: (mode, routeId, routeLabel) => {
    if (mode === 'train') return formatNjtRailRoutePickerLabel(routeId, routeLabel);
    if (mode === 'bus') return formatNjtBusRoutePickerLabel(routeId, routeLabel);
    return null;
  },
  getLineLabel: (mode, routeId, routeLabel) => {
    if (mode === 'train') return getNjtRailLineLabel(routeId, routeLabel);
    if (mode === 'bus') return getNjtBusLineLabel(routeId, routeLabel);
    return null;
  },
  getRouteBadgeLabel: (mode, routeId, routeLabel, routeShortName) => {
    if (mode === 'train') return getNjtRailRouteBadgeLabel(routeId, routeLabel, routeShortName);
    if (mode === 'bus') return getNjtBusRouteBadgeLabel(routeId, routeLabel);
    return null;
  },
  getDirectionLabel: (mode, direction, _routeId, _variant) => {
    if (mode === 'train') return getNjtRailDirectionLabel(direction);
    if (mode === 'bus') return getNjtBusDirectionLabel(direction);
    return null;
  },
  serializeDirection: (mode, direction) => {
    if (mode === 'train') return serializeNjtRailDirection(direction);
    if (mode === 'bus') return serializeNjtBusDirection(direction);
    return null;
  },
  deserializeDirection: (mode, value) => {
    if (mode === 'train') return deserializeNjtRailDirection(value);
    if (mode === 'bus') return deserializeNjtBusDirection(value);
    return null;
  },
  normalizeSavedStationId: (_provider, stopId) => stopId.trim(),
  prepareRouteEntries: (mode, routes) => {
    if (mode === 'train') return prepareNjtRailRouteEntries(routes);
    if (mode === 'bus') return prepareNjtBusRouteEntries(routes);
    return null;
  },
  buildRouteGroups: (mode, routes) => {
    if (mode === 'train') return buildNjtRailRouteGroups(routes);
    if (mode === 'bus') return buildNjtBusRouteGroups(routes);
    return null;
  },
  resolveRouteAppearance: (mode, routeId) => {
    if (mode === 'train') return getNjtRailRouteBadgeAppearance(routeId);
    if (mode === 'bus') return getNjtBusRouteBadgeAppearance(routeId);
    return null;
  },
  isBusBadge: mode => mode === 'bus',
};
