import type {CityId} from '../constants/cities';
import type {TransitLineDirection, TransitUiMode} from '../types/transit';
import type {DirectionVariant, TransitRouteRecord, UiDirection} from './transit/frontendTypes';
import {getTransitCityModule, resolveCityModeFromBackendProvider} from './transit/registry';

type LocalMode = TransitUiMode;
type LocalRouteRef =
  | string
  | {
      id?: string;
      label?: string;
      headsign0?: string | null;
      headsign1?: string | null;
      directions?: TransitLineDirection[] | null;
    }
  | null
  | undefined;

export type {UiDirection};

const normalizeToken = (value: string | null | undefined) => value?.trim().toUpperCase() ?? '';

const defaultDirectionLabel = (direction: UiDirection, variant: DirectionVariant) => {
  if (direction === 'westbound') return 'Westbound';
  if (direction === 'eastbound') return 'Eastbound';
  if (direction === 'outbound') return 'Outbound';
  if (direction === 'inbound') return 'Inbound';
  if (direction === 'dir0') return variant === 'summary' ? 'Direction 0' : 'Direction 0';
  if (direction === 'dir1') return variant === 'summary' ? 'Direction 1' : 'Direction 1';
  if (variant === 'summary') {
    return direction === 'downtown' ? 'Downtown / South' : 'Uptown / North';
  }
  return direction === 'downtown' ? 'Downtown' : 'Uptown';
};

const getRouteId = (route: LocalRouteRef) => (typeof route === 'string' ? route : route?.id);

export const getLocalDirectionMetadata = (
  route: LocalRouteRef,
  direction: UiDirection,
) => {
  if (!route || typeof route === 'string' || !Array.isArray(route.directions)) return null;
  return route.directions.find(entry => entry.uiKey === direction) ?? null;
};

const getRouteDirectionMetadataLabel = (
  route: LocalRouteRef,
  direction: UiDirection,
  variant: DirectionVariant,
) => {
  const metadata = getLocalDirectionMetadata(route, direction);
  if (!metadata) return null;
  if (variant === 'toggle') return metadata.toggleLabel;
  if (variant === 'summary') return metadata.summaryLabel;
  return metadata.boundLabel;
};

export const getLocalDirectionTerminal = (
  route: LocalRouteRef,
  direction: UiDirection,
) => getLocalDirectionMetadata(route, direction)?.terminal ?? null;

const NEW_YORK_DIRECTION_OPTIONS: Partial<Record<LocalMode, UiDirection[]>> = {
  train: ['uptown', 'downtown'],
  bus: ['dir0', 'dir1'],
  lirr: ['westbound', 'eastbound'],
  mnr: ['outbound', 'inbound'],
};

const DEFAULT_DIRECTION_OPTIONS: UiDirection[] = ['uptown', 'downtown'];

export const getLocalDirectionOptions = (
  city: CityId,
  mode: LocalMode,
  route?: LocalRouteRef,
): UiDirection[] => {
  if (route && typeof route !== 'string' && Array.isArray(route.directions)) {
    const fromMetadata = route.directions.map(entry => entry.uiKey).filter((value, index, values) => values.indexOf(value) === index);
    if (fromMetadata.length > 0) return fromMetadata;
  }

  if (city === 'new-york') {
    return NEW_YORK_DIRECTION_OPTIONS[mode] ?? DEFAULT_DIRECTION_OPTIONS;
  }

  return DEFAULT_DIRECTION_OPTIONS;
};

export const getDefaultUiDirection = (
  city: CityId,
  mode: LocalMode,
  route?: LocalRouteRef,
): UiDirection => getLocalDirectionOptions(city, mode, route)[0] ?? 'uptown';

export const inferMbtaMode = (stopId: string | null | undefined, lineId?: string | null): LocalMode => {
  const normalizedStopId = (stopId ?? '').trim();
  const normalizedLineId = normalizeToken(lineId);
  if (/^BOAT-/i.test(normalizedStopId) || normalizedLineId.startsWith('BOAT-')) return 'ferry';
  if (/^\d+$/.test(normalizedStopId)) return 'bus';
  if (normalizedStopId && !/^PLACE-/i.test(normalizedStopId)) return 'commuter-rail';
  return 'train';
};

export const inferUiModeFromProvider = (
  provider: string | null | undefined,
  stopId?: string | null,
  lineId?: string | null,
): LocalMode | null => {
  const fixedMapping = resolveCityModeFromBackendProvider(provider);
  if (fixedMapping && (provider ?? '').trim().toLowerCase() !== 'mbta') {
    return fixedMapping.mode;
  }

  switch ((provider ?? '').trim().toLowerCase()) {
    case 'mbta':
      return inferMbtaMode(stopId, lineId);
    default:
      return null;
  }
};

export const getLocalModeLabel = (city: CityId, mode: LocalMode) => {
  const cityModule = getTransitCityModule(city);
  const moduleLabel = cityModule?.getModeLabel(mode);
  if (moduleLabel) return moduleLabel;
  if (mode === 'train') {
    return 'Subway';
  }
  if (mode === 'bus') return 'Bus';
  if (mode === 'trolley') return 'Trolley';
  if (mode === 'ferry') return 'Ferry';
  if (mode === 'lirr') return 'LIRR';
  if (mode === 'mnr') return 'Metro-North';
  if (mode === 'commuter-rail') return 'Commuter Rail';
  return 'Commuter Rail';
};

export const formatLocalRoutePickerLabel = (
  city: CityId,
  mode: LocalMode,
  routeId: string,
  routeLabel: string,
) => {
  const cityModule = getTransitCityModule(city);
  const moduleLabel = cityModule?.formatRoutePickerLabel(mode, routeId, routeLabel);
  if (moduleLabel) return moduleLabel;
  return routeLabel.trim();
};

export const getLocalLineLabel = (
  city: CityId,
  mode: LocalMode,
  routeId: string,
  routeLabel: string,
) => {
  const cityModule = getTransitCityModule(city);
  const moduleLabel = cityModule?.getLineLabel(mode, routeId, routeLabel);
  if (moduleLabel) return moduleLabel;
  return formatLocalRoutePickerLabel(city, mode, routeId, routeLabel);
};

export const getLocalRouteBadgeLabel = (
  city: CityId,
  mode: LocalMode,
  routeId: string,
  routeLabel?: string | null,
) => {
  const safeLabel = (routeLabel ?? routeId).trim();
  const cityModule = getTransitCityModule(city);
  const moduleLabel = cityModule?.getRouteBadgeLabel(mode, routeId, safeLabel);
  if (moduleLabel) return moduleLabel;
  return safeLabel.toUpperCase().slice(0, 4);
};

export const getLocalDirectionLabel = (
  city: CityId,
  mode: LocalMode,
  direction: UiDirection,
  route?: LocalRouteRef,
  variant: DirectionVariant = 'bound',
) => {
  const metadataLabel = getRouteDirectionMetadataLabel(route, direction, variant);
  if (metadataLabel) return metadataLabel;

  if (city === 'new-york') {
    if (mode === 'train') {
      const routeId = getRouteId(route);
      const cityModule = getTransitCityModule(city);
      return cityModule?.getDirectionLabel(mode, direction, routeId, variant) ?? defaultDirectionLabel(direction, variant);
    }
    return '--';
  }

  const routeId = getRouteId(route);
  const cityModule = getTransitCityModule(city);
  const moduleLabel = cityModule?.getDirectionLabel(mode, direction, routeId, variant);
  if (moduleLabel) return moduleLabel;
  return defaultDirectionLabel(direction, variant);
};

export const serializeUiDirection = (city: CityId, mode: LocalMode, direction: UiDirection) => {
  const cityModule = getTransitCityModule(city);
  const serialized = cityModule?.serializeDirection(mode, direction);
  if (serialized) return serialized;
  if (direction === 'downtown' || direction === 'eastbound' || direction === 'inbound' || direction === 'dir1') {
    return 'S';
  }
  return 'N';
};

export const deserializeUiDirection = (
  city: CityId,
  mode: LocalMode,
  value: string | null | undefined,
  stopId?: string | null,
): UiDirection => {
  const normalized = normalizeToken(value);
  const cityModule = getTransitCityModule(city);
  const deserialized = cityModule?.deserializeDirection(mode, value, stopId);
  if (deserialized) return deserialized;
  if (normalized === '1' || normalized === 'W' || normalized === 'WESTBOUND') return 'westbound';
  if (normalized === '0' || normalized === 'E' || normalized === 'EASTBOUND') return 'eastbound';
  if (normalized === 'INBOUND') return 'inbound';
  if (normalized === 'OUTBOUND') return 'outbound';
  if (normalized === 'S' || normalized === 'SOUTHBOUND' || (!normalized && normalizeToken(stopId).endsWith('S'))) {
    return 'downtown';
  }
  return 'uptown';
};

export const isRailLinePreviewMode = (city: CityId, mode: LocalMode) =>
  mode === 'lirr' || mode === 'mnr' || mode === 'commuter-rail' || (city === 'philadelphia' && mode === 'train');
