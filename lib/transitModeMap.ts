import type {
  SupportedTransitCity,
  TransitBackendMode,
  TransitCity,
  TransitModeMapping,
  TransitProvider,
  TransitProviderMode,
  TransitUiMode,
} from '../types/transit';

type ProviderModeEntry = {
  provider: TransitProvider;
  mode: TransitBackendMode;
};

type TransitModeMap = Record<SupportedTransitCity, Partial<Record<TransitUiMode, ProviderModeEntry>>>;

export const TRANSIT_MODE_MAP: TransitModeMap = {
  'new-york': {
    train: {provider: 'mta', mode: 'subway'},
    bus: {provider: 'mta', mode: 'bus'},
    'commuter-rail': {provider: 'mta', mode: 'lirr'},
  },
  philadelphia: {
    train: {provider: 'septa', mode: 'rail'},
    bus: {provider: 'septa', mode: 'bus'},
    trolley: {provider: 'septa', mode: 'trolley'},
  },
  boston: {
    train: {provider: 'mbta', mode: 'subway'},
    bus: {provider: 'mbta', mode: 'bus'},
    'commuter-rail': {provider: 'mbta', mode: 'rail'},
    ferry: {provider: 'mbta', mode: 'ferry'},
  },
  chicago: {
    train: {provider: 'cta', mode: 'subway'},
    bus: {provider: 'cta', mode: 'bus'},
  },
};

export const SUPPORTED_TRANSIT_CITIES: SupportedTransitCity[] = ['new-york', 'philadelphia', 'boston', 'chicago'];

const toProviderMode = (provider: TransitProvider, mode: TransitBackendMode): TransitProviderMode =>
  `${provider}/${mode}`;

export const isSupportedTransitCity = (city: TransitCity): city is SupportedTransitCity =>
  city === 'new-york' || city === 'philadelphia' || city === 'boston' || city === 'chicago';

export const resolveTransitModeMapping = (city: TransitCity, uiMode: TransitUiMode): TransitModeMapping => {
  if (!isSupportedTransitCity(city)) {
    throw new Error(
      `Transit API does not support city "${city}". Supported cities: ${SUPPORTED_TRANSIT_CITIES.join(', ')}.`,
    );
  }

  const cityModeMap = TRANSIT_MODE_MAP[city];
  const mapping = cityModeMap[uiMode];
  if (!mapping) {
    const supportedModes = Object.keys(cityModeMap);
    throw new Error(
      `Transit API does not support mode "${uiMode}" for city "${city}". Supported modes: ${
        supportedModes.join(', ') || 'none'
      }.`,
    );
  }

  return {
    provider: mapping.provider,
    mode: mapping.mode,
    providerMode: toProviderMode(mapping.provider, mapping.mode),
  };
};
