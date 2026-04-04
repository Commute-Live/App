export type TransitCity = 'new-york' | 'philadelphia' | 'boston' | 'chicago' | 'new-jersey';

export type DisplayFormat =
    | 'single-line'   // [BADGE] [Woodlawn]         [2m]
    | 'two-line'      // [BADGE] [Woodlawn/Uptown]  [2m]
    | 'times-line';   // [BADGE] [Woodlawn/5,10m]   [2m]

export type DisplayContent = 'destination' | 'direction' | 'headsign' | 'custom';
export type SupportedTransitCity = 'new-york' | 'philadelphia' | 'boston' | 'chicago' | 'new-jersey';

export type TransitUiMode = 'train' | 'bus' | 'lirr' | 'mnr' | 'commuter-rail' | 'trolley' | 'ferry';
export type TransitUiDirection =
  | 'uptown'
  | 'downtown'
  | 'northbound'
  | 'southbound'
  | 'dir0'
  | 'dir1'
  | 'westbound'
  | 'eastbound'
  | 'outbound'
  | 'inbound';

export type TransitProvider = 'mta' | 'septa' | 'cta' | 'mbta' | 'njt';
export type TransitBackendMode = 'subway' | 'bus' | 'lirr' | 'mnr' | 'rail' | 'trolley' | 'ferry';
export type TransitBackendProviderId =
  | 'mta-subway'
  | 'mta-bus'
  | 'mta-lirr'
  | 'mta-mnr'
  | 'septa-rail'
  | 'septa-bus'
  | 'septa-trolley'
  | 'mbta'
  | 'cta-subway'
  | 'cta-bus'
  | 'njt-rail'
  | 'njt-bus';
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
  lines: TransitStationLine[];
};

export type TransitStationLine = {
  id: string;
  shortName: string;
  label: string;
};

export type TransitLine = {
  id: string;
  shortName: string | null;
  label: string;
  sortOrder: number | null;
  color: string | null;
  textColor: string | null;
  headsign0: string | null;
  headsign1: string | null;
  directions: TransitLineDirection[];
};

export type TransitLineDirection = {
  id: string;
  uiKey: TransitUiDirection;
  label: string;
  terminal: string | null;
  boundLabel: string;
  toggleLabel: string;
  summaryLabel: string;
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
    options?: {
      direction?: string;
    },
  ): Promise<TransitArrivalGroup>;
}
