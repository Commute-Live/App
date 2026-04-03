import type {TransitCityModule} from '../types';
import {
  buildPhiladelphiaRouteGroups,
  deserializePhiladelphiaDirection,
  formatPhiladelphiaRoutePickerLabel,
  getPhiladelphiaDirectionLabel,
  getPhiladelphiaLineLabel,
  getPhiladelphiaModeLabel,
  getPhiladelphiaRouteBadgeLabel,
  isPhiladelphiaMode,
  preparePhiladelphiaRouteEntries,
  serializePhiladelphiaDirection,
} from '../../providers/philadelphia';

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
  prepareRouteEntries: (mode, routes) =>
    isPhiladelphiaMode(mode) ? preparePhiladelphiaRouteEntries(mode, routes) : null,
  buildRouteGroups: (mode, routes) =>
    isPhiladelphiaMode(mode) ? buildPhiladelphiaRouteGroups(mode, routes) : null,
};
