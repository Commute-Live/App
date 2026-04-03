import type {
  SupportedTransitCity,
  TransitCity,
  TransitModeMapping,
  TransitUiMode,
} from '../types/transit';
import {
  resolveTransitModeMapping as resolveTransitModeMappingFromRegistry,
  SUPPORTED_TRANSIT_CITIES,
  isSupportedTransitCity,
} from './transit/providerRegistry';

export {SUPPORTED_TRANSIT_CITIES, isSupportedTransitCity};

export const resolveTransitModeMapping = (
  city: TransitCity,
  uiMode: TransitUiMode,
): TransitModeMapping => resolveTransitModeMappingFromRegistry(city, uiMode);

export type {SupportedTransitCity};
