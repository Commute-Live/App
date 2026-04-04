import type {
  SupportedTransitCity,
  TransitBackendProviderId,
  TransitUiMode,
} from '../../../types/transit';
import type {
  DirectionVariant,
  TransitRouteAppearance,
  TransitRouteGroup,
  TransitRoutePickerItem,
  TransitRouteRecord,
  UiDirection,
} from '../frontendTypes';

export type TransitCityModule = {
  city: SupportedTransitCity;
  modeOrder: TransitUiMode[];
  backendProvidersByMode: Partial<Record<TransitUiMode, TransitBackendProviderId>>;
  getModeLabel(mode: TransitUiMode): string | null;
  formatRoutePickerLabel(mode: TransitUiMode, routeId: string, routeLabel: string): string | null;
  getLineLabel(mode: TransitUiMode, routeId: string, routeLabel: string): string | null;
  getRouteBadgeLabel(mode: TransitUiMode, routeId: string, routeLabel?: string | null, routeShortName?: string | null): string | null;
  getDirectionLabel(
    mode: TransitUiMode,
    direction: UiDirection,
    routeId?: string | null,
    variant?: DirectionVariant,
  ): string | null;
  serializeDirection(mode: TransitUiMode, direction: UiDirection): string | null;
  deserializeDirection(
    mode: TransitUiMode,
    value: string | null | undefined,
    stopId?: string | null,
  ): UiDirection | null;
  normalizeSavedStationId(provider: string, stopId: string): string;
  prepareRouteEntries(mode: TransitUiMode, routes: TransitRouteRecord[]): TransitRoutePickerItem[] | null;
  buildRouteGroups(mode: TransitUiMode, routes: TransitRoutePickerItem[]): TransitRouteGroup[] | null;
  resolveRouteAppearance?(mode: TransitUiMode, lineId: string, label?: string | null): TransitRouteAppearance | null;
  isBusBadge?(mode: TransitUiMode): boolean;
  isExpressRouteBadge?(mode: TransitUiMode, route: TransitRoutePickerItem): boolean;
  isExpressVariant?(mode: TransitUiMode, route: TransitRouteRecord): boolean;
};
