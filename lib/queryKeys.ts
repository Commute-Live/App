import type {CityId} from '../constants/cities';

export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  displays: (deviceId: string) => ['device', deviceId, 'displays'] as const,
  display: (deviceId: string, displayId: string) => ['device', deviceId, 'displays', displayId] as const,
  deviceConfig: (deviceId: string) => ['device', deviceId, 'config'] as const,
  lastCommand: (deviceId: string) => ['device', deviceId, 'last-command'] as const,
  transitStations: (city: CityId, mode: string) => ['transit', city, mode, 'stations'] as const,
  transitLinesForStation: (city: CityId, mode: string, stationId: string) =>
    ['transit', city, mode, 'stations', stationId, 'lines'] as const,
  transitGlobalLines: (city: CityId, mode: string) => ['transit', city, mode, 'lines', 'global'] as const,
  transitStopsForLine: (city: CityId, mode: string, lineId: string) =>
    ['transit', city, mode, 'lines', lineId, 'stops'] as const,
  transitArrivalsForSelection: (city: CityId, mode: string, stationId: string, routeId: string) =>
    ['transit', city, mode, 'stations', stationId, 'arrivals', routeId] as const,
  transitStationName: (provider: string, stopId: string) => ['transit', provider, 'station-name', stopId] as const,
  liveStationsSearch: (city: CityId, query: string) => ['transit', city, 'station-search', query] as const,
  espHeartbeat: ['esp', 'heartbeat'] as const,
  espDeviceInfo: ['esp', 'device-info'] as const,
  espStatus: ['esp', 'status'] as const,
};
