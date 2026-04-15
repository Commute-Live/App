import type {CityId} from '../../constants/cities';
import type {
  SupportedTransitCity,
  TransitBackendMode,
  TransitBackendProviderId,
  TransitModeMapping,
  TransitProvider,
  TransitProviderMode,
  TransitUiMode,
} from '../../types/transit';
import {
  bostonTransitModule,
  chicagoTransitModule,
  newJerseyTransitModule,
  newYorkTransitModule,
  philadelphiaTransitModule,
  type TransitCityModule,
} from './cities';

type BackendContext = {
  provider: TransitProvider;
  mode: TransitBackendMode;
};

const TRANSIT_CITY_MODULES: Record<SupportedTransitCity, TransitCityModule> = {
  'new-york': newYorkTransitModule,
  philadelphia: philadelphiaTransitModule,
  boston: bostonTransitModule,
  chicago: chicagoTransitModule,
  'new-jersey': newJerseyTransitModule,
};

const BACKEND_PROVIDER_CONTEXT: Record<TransitBackendProviderId, BackendContext> = {
  'mta-subway': {provider: 'mta', mode: 'subway'},
  'mta-bus': {provider: 'mta', mode: 'bus'},
  'mta-lirr': {provider: 'mta', mode: 'lirr'},
  'mta-mnr': {provider: 'mta', mode: 'mnr'},
  'septa-rail': {provider: 'septa', mode: 'rail'},
  'septa-bus': {provider: 'septa', mode: 'bus'},
  'septa-trolley': {provider: 'septa', mode: 'trolley'},
  mbta: {provider: 'mbta', mode: 'subway'},
  'mbta-subway': {provider: 'mbta', mode: 'subway'},
  'mbta-bus': {provider: 'mbta', mode: 'bus'},
  'mbta-rail': {provider: 'mbta', mode: 'rail'},
  'cta-l': {provider: 'cta', mode: 'l'},
  'cta-subway': {provider: 'cta', mode: 'l'},
  'cta-bus': {provider: 'cta', mode: 'bus'},
  'njt-rail': {provider: 'njt', mode: 'rail'},
};

const BACKEND_PROVIDER_CITY_MODE: Record<TransitBackendProviderId, {city: SupportedTransitCity; mode: TransitUiMode}> = {
  'mta-subway': {city: 'new-york', mode: 'train'},
  'mta-bus': {city: 'new-york', mode: 'bus'},
  'mta-lirr': {city: 'new-york', mode: 'lirr'},
  'mta-mnr': {city: 'new-york', mode: 'mnr'},
  'septa-rail': {city: 'philadelphia', mode: 'train'},
  'septa-bus': {city: 'philadelphia', mode: 'bus'},
  'septa-trolley': {city: 'philadelphia', mode: 'trolley'},
  mbta: {city: 'boston', mode: 'train'},
  'mbta-subway': {city: 'boston', mode: 'train'},
  'mbta-bus': {city: 'boston', mode: 'bus'},
  'mbta-rail': {city: 'boston', mode: 'commuter-rail'},
  'cta-l': {city: 'chicago', mode: 'train'},
  'cta-subway': {city: 'chicago', mode: 'train'},
  'cta-bus': {city: 'chicago', mode: 'bus'},
  'njt-rail': {city: 'new-jersey', mode: 'train'},
};

const hasOwn = <T extends object>(record: T, key: PropertyKey): key is keyof T =>
  Object.prototype.hasOwnProperty.call(record, key);

export const SUPPORTED_TRANSIT_CITIES = Object.keys(TRANSIT_CITY_MODULES) as SupportedTransitCity[];

export const isSupportedTransitCity = (city: string): city is SupportedTransitCity =>
  hasOwn(TRANSIT_CITY_MODULES, city);

export const getTransitCityModule = (city: CityId): TransitCityModule | null =>
  isSupportedTransitCity(city) ? TRANSIT_CITY_MODULES[city] : null;

export const getCityModeOrder = (city: CityId): TransitUiMode[] =>
  getTransitCityModule(city)?.modeOrder ? [...getTransitCityModule(city)!.modeOrder] : [];

export const resolveBackendProviderId = (
  city: SupportedTransitCity,
  mode: TransitUiMode,
): TransitBackendProviderId => {
  const backendProvider = TRANSIT_CITY_MODULES[city].backendProvidersByMode[mode];
  if (!backendProvider) {
    const supportedModes = TRANSIT_CITY_MODULES[city].modeOrder.join(', ') || 'none';
    throw new Error(`Transit API does not support mode "${mode}" for city "${city}". Supported modes: ${supportedModes}.`);
  }
  return backendProvider;
};

export const resolveBackendProviderContext = (
  backendProvider: string | null | undefined,
): BackendContext | null => {
  if (!backendProvider) return null;
  return BACKEND_PROVIDER_CONTEXT[backendProvider as TransitBackendProviderId] ?? null;
};

export const resolveCityModeFromBackendProvider = (
  backendProvider: string | null | undefined,
): {city: SupportedTransitCity; mode: TransitUiMode} | null => {
  if (!backendProvider) return null;
  return BACKEND_PROVIDER_CITY_MODE[backendProvider as TransitBackendProviderId] ?? null;
};

export const getTransitCityModuleFromBackendProvider = (
  backendProvider: string | null | undefined,
): TransitCityModule | null => {
  const mapping = resolveCityModeFromBackendProvider(backendProvider);
  return mapping ? TRANSIT_CITY_MODULES[mapping.city] : null;
};

export const providerToCity = (backendProvider: string | null | undefined): CityId | null =>
  resolveCityModeFromBackendProvider(backendProvider)?.city ?? null;

export const resolveTransitModeMapping = (
  city: CityId,
  uiMode: TransitUiMode,
): TransitModeMapping => {
  if (!isSupportedTransitCity(city)) {
    throw new Error(
      `Transit API does not support city "${city}". Supported cities: ${SUPPORTED_TRANSIT_CITIES.join(', ')}.`,
    );
  }

  const backendProvider = resolveBackendProviderId(city, uiMode);
  const context = BACKEND_PROVIDER_CONTEXT[backendProvider];
  const providerMode = `${context.provider}/${context.mode}` as TransitProviderMode;

  return {
    provider: context.provider,
    mode: context.mode,
    providerMode,
  };
};
