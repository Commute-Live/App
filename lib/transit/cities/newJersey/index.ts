import type {ModeId, UiDirection} from '../../frontendTypes';
import type {TransitCityModule} from '../types';
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

export type NewJerseyMode = Extract<ModeId, 'train'>;

export const isNewJerseyMode = (mode: ModeId): mode is NewJerseyMode =>
  mode === 'train';

export const newJerseyTransitModule: TransitCityModule = {
  city: 'new-jersey',
  modeOrder: ['train'],
  backendProvidersByMode: {
    train: 'njt-rail',
  },
  getModeLabel: mode => {
    if (mode === 'train') return getNjtRailModeLabel();
    return null;
  },
  formatRoutePickerLabel: (mode, routeId, routeLabel) => {
    if (mode === 'train') return formatNjtRailRoutePickerLabel(routeId, routeLabel);
    return null;
  },
  getLineLabel: (mode, routeId, routeLabel) => {
    if (mode === 'train') return getNjtRailLineLabel(routeId, routeLabel);
    return null;
  },
  getRouteBadgeLabel: (mode, routeId, routeLabel, routeShortName) => {
    if (mode === 'train') return getNjtRailRouteBadgeLabel(routeId, routeLabel, routeShortName);
    return null;
  },
  getDirectionLabel: (mode, direction, _routeId, _variant) => {
    if (mode === 'train') return getNjtRailDirectionLabel(direction);
    return null;
  },
  serializeDirection: (mode, direction) => {
    if (mode === 'train') return serializeNjtRailDirection(direction);
    return null;
  },
  deserializeDirection: (mode, value) => {
    if (mode === 'train') return deserializeNjtRailDirection(value);
    return null;
  },
  normalizeSavedStationId: (_provider, stopId) => stopId.trim(),
  prepareRouteEntries: (mode, routes) => {
    if (mode === 'train') return prepareNjtRailRouteEntries(routes);
    return null;
  },
  buildRouteGroups: (mode, routes) => {
    if (mode === 'train') return buildNjtRailRouteGroups(routes);
    return null;
  },
  resolveRouteAppearance: (mode, routeId) => {
    if (mode === 'train') return getNjtRailRouteBadgeAppearance(routeId);
    return null;
  },
  isBusBadge: () => false,
};
