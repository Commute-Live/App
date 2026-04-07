import type {TransitCityModule} from '../types';
import {
  buildBostonRouteGroups,
  deserializeBostonDirection,
  formatBostonRoutePickerLabel,
  getBostonDirectionLabel,
  getBostonFullDirectionLabel,
  getBostonLineLabel,
  getBostonModeLabel,
  getBostonRouteBadgeLabel,
  getBostonRouteHeadsign,
  isBostonMode,
  prepareBostonRouteEntries,
  serializeBostonDirection,
} from '../../providers/boston';

export const bostonTransitModule: TransitCityModule = {
  city: 'boston',
  modeOrder: ['train', 'bus', 'commuter-rail'],
  backendProvidersByMode: {
    train: 'mbta-subway',
    bus: 'mbta-bus',
    'commuter-rail': 'mbta-rail',
  },
  getModeLabel: mode => (isBostonMode(mode) ? getBostonModeLabel(mode) : null),
  formatRoutePickerLabel: (mode, routeId, routeLabel) =>
    isBostonMode(mode) ? formatBostonRoutePickerLabel(mode, routeId, routeLabel) : null,
  getLineLabel: (mode, routeId, routeLabel) =>
    isBostonMode(mode) ? getBostonLineLabel(mode, routeId, routeLabel) : null,
  getRouteBadgeLabel: (mode, routeId, routeLabel, routeShortName) =>
    isBostonMode(mode) ? getBostonRouteBadgeLabel(mode, routeId, routeLabel, routeShortName) : null,
  getDirectionLabel: (mode, direction, _routeId, variant) =>
    isBostonMode(mode) ? getBostonDirectionLabel(mode, direction, variant) : null,
  serializeDirection: (mode, direction) =>
    isBostonMode(mode) ? serializeBostonDirection(direction) : null,
  deserializeDirection: (mode, value) =>
    isBostonMode(mode) ? deserializeBostonDirection(value) : null,
  normalizeSavedStationId: (_provider, stopId) => stopId.trim().toLowerCase(),
  prepareRouteEntries: (mode, routes) =>
    isBostonMode(mode) ? prepareBostonRouteEntries(mode, routes) : null,
  buildRouteGroups: (mode, routes) =>
    isBostonMode(mode) ? buildBostonRouteGroups(mode, routes) : null,
};

export {getBostonRouteHeadsign};
export {getBostonFullDirectionLabel};
