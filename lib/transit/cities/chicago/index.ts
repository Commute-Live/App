import type {TransitCityModule} from '../types';
import {
  buildChicagoRouteGroups,
  deserializeChicagoDirection,
  formatChicagoRoutePickerLabel,
  getChicagoDirectionLabel,
  getChicagoLineLabel,
  getChicagoModeLabel,
  getChicagoRouteBadgeLabel,
  isChicagoMode,
  prepareChicagoRouteEntries,
  serializeChicagoDirection,
} from '../../providers/chicago';

export const chicagoTransitModule: TransitCityModule = {
  city: 'chicago',
  modeOrder: ['train', 'bus'],
  backendProvidersByMode: {
    train: 'cta-subway',
    bus: 'cta-bus',
  },
  getModeLabel: mode => (isChicagoMode(mode) ? getChicagoModeLabel(mode) : null),
  formatRoutePickerLabel: (mode, routeId, routeLabel) =>
    isChicagoMode(mode) ? formatChicagoRoutePickerLabel(mode, routeId, routeLabel) : null,
  getLineLabel: (mode, routeId, routeLabel) =>
    isChicagoMode(mode) ? getChicagoLineLabel(mode, routeId, routeLabel) : null,
  getRouteBadgeLabel: (mode, routeId, routeLabel) =>
    isChicagoMode(mode) ? getChicagoRouteBadgeLabel(mode, routeId, routeLabel) : null,
  getDirectionLabel: (mode, direction, routeId, variant) =>
    isChicagoMode(mode) ? getChicagoDirectionLabel(mode, direction, routeId, variant) : null,
  serializeDirection: (mode, direction) =>
    isChicagoMode(mode) ? serializeChicagoDirection(mode, direction) : null,
  deserializeDirection: (mode, value) =>
    isChicagoMode(mode) ? deserializeChicagoDirection(mode, value) : null,
  normalizeSavedStationId: (_provider, stopId) => stopId.trim().toUpperCase(),
  prepareRouteEntries: (mode, routes) =>
    isChicagoMode(mode) ? prepareChicagoRouteEntries(mode, routes) : null,
  buildRouteGroups: (mode, routes) =>
    isChicagoMode(mode) ? buildChicagoRouteGroups(mode, routes) : null,
};
