export type TransitCity = 'new-york' | 'philadelphia' | 'boston' | 'chicago';

export type DisplayFormat =
    | 'single-line'   // [BADGE] [Woodlawn]         [2m]
    | 'two-line'      // [BADGE] [Woodlawn/Uptown]  [2m]
    | 'times-line';   // [BADGE] [Woodlawn/5,10m]   [2m]

export type DisplayContent = 'destination' | 'direction' | 'custom';
export type SupportedTransitCity = 'new-york' | 'philadelphia' | 'boston' | 'chicago';

export type TransitUiMode = 'train' | 'bus' | 'lirr' | 'mnr' | 'commuter-rail' | 'trolley' | 'ferry';

export type TransitProvider = 'mta' | 'septa' | 'cta' | 'mbta';
export type TransitBackendMode = 'subway' | 'bus' | 'lirr' | 'mnr' | 'rail' | 'trolley' | 'ferry';
export type TransitProviderMode = `${TransitProvider}/${TransitBackendMode}`;

export type TransitModeMapping = {
  provider: TransitProvider;
  mode: TransitBackendMode;
  providerMode: TransitProviderMode;
};

export type TransitContext = {
  city: TransitCity;
  uiMode: TransitUiMode;
} & TransitModeMapping;

export type TransitStation = {
  id: string;
  name: string;
  area: string | null;
  lines: string[];
};

export type TransitLine = {
  id: string;
  label: string;
  color: string | null;
  textColor: string | null;
};

export type TransitArrival = {
  lineId: string;
  destination: string | null;
  minutes: number | null;
  status: string | null;
  scheduledAt: string | null;
};

export type TransitStationGroup = TransitContext & {
  stations: TransitStation[];
};

export type TransitLineGroup = TransitContext & {
  stopId: string;
  lines: TransitLine[];
};

export type TransitArrivalGroup = TransitContext & {
  stopId: string;
  lineIds: string[];
  arrivals: TransitArrival[];
};

export interface TransitApi {
  getTransitStations(city: TransitCity, uiMode: TransitUiMode): Promise<TransitStationGroup>;
  getTransitLines(city: TransitCity, uiMode: TransitUiMode, stopId: string): Promise<TransitLineGroup>;
  getTransitArrivals(
    city: TransitCity,
    uiMode: TransitUiMode,
    stopId: string,
    lineIds: readonly string[],
  ): Promise<TransitArrivalGroup>;
}
