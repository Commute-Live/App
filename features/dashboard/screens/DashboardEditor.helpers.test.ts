// @ts-nocheck
import {describe, expect, mock, test} from 'bun:test';

mock.module('../../../lib/transitApi', () => ({
  getGlobalTransitLines: mock(async () => ({
    lines: [
      {
        id: 'RED',
        shortName: null,
        label: 'Red Line',
        sortOrder: null,
        color: '#C60C30',
        textColor: '#FFFFFF',
        headsign0: null,
        headsign1: null,
        directions: [],
      },
      {
        id: 'PINK',
        shortName: null,
        label: 'Pink Line',
        sortOrder: null,
        color: '#E27EA6',
        textColor: '#FFFFFF',
        headsign0: null,
        headsign1: null,
        directions: [],
      },
    ],
  })),
  getTransitArrivals: mock(),
  getTransitLines: mock(),
  getTransitStations: mock(),
  getTransitStopsForLine: mock(),
}));

mock.module('../../../theme', () => ({
  colors: {
    text: '#111111',
  },
}));

describe('dashboard editor helpers', () => {
  test('keeps full CTA L line labels from the API', async () => {
    const {loadGlobalLinesForCityMode} = await import('./DashboardEditor.helpers');

    const routes = await loadGlobalLinesForCityMode('chicago', 'train');

    expect(routes.map(route => route.label)).toEqual(['Red Line', 'Pink Line']);
  });

  test('prefers persisted route id over short name for saved MBTA bus lines', async () => {
    const {resolveSavedRouteId} = await import('./DashboardEditor.helpers');

    expect(
      resolveSavedRouteId({
        provider: 'mbta-bus',
        providerMode: 'mbta/bus',
        line: '741',
        shortName: 'SL1',
      }),
    ).toBe('741');
  });

  test('preserves mixed-case saved MBTA commuter rail stop ids', async () => {
    const {normalizeSavedStationId} = await import('./DashboardEditor.helpers');

    expect(normalizeSavedStationId('mbta-rail', 'PLACE-ER-0115')).toBe('PLACE-ER-0115');
    expect(normalizeSavedStationId('mbta-subway', 'PLACE-DWNXG')).toBe('place-dwnxg');
  });

  test('preserves a selected route when station metadata does not list it yet', async () => {
    const {normalizeLine} = await import('./DashboardEditor.helpers');

    const normalized = normalizeLine(
      'boston',
      {
        id: 'line-1',
        mode: 'commuter-rail',
        stationId: 'PLACE-FR-0132',
        routeId: 'CR-FITCHBURG',
        direction: 'outbound',
        patternId: '',
        scrolling: false,
        label: '',
        secondaryLabel: '',
        textColor: '#FFFFFF',
        nextStops: 3,
        displayFormat: 'single-line',
        primaryContent: 'destination',
        secondaryContent: 'direction',
      },
      {
        'commuter-rail': [
          {
            id: 'PLACE-FR-0132',
            name: 'Sample Stop',
            area: '',
            lines: [{id: 'CR-FITCHBURG'}],
          },
        ],
      },
      {
        'commuter-rail:PLACE-FR-0132': [
          {
            id: 'CR-LOWELL',
            shortName: null,
            label: 'Lowell Line',
            sortOrder: null,
            color: '#80276C',
            textColor: '#FFFFFF',
            headsign0: null,
            headsign1: null,
            directions: [],
            patterns: [],
          },
        ],
      },
    );

    expect(normalized.routeId).toBe('CR-FITCHBURG');
  });

  test('preserves saved stop name when station metadata is unavailable', async () => {
    const {normalizeLine, syncArrivals} = await import('./DashboardEditor.helpers');

    const normalized = normalizeLine(
      'boston',
      {
        id: 'line-1',
        mode: 'commuter-rail',
        stationId: 'PLACE-FR-3338',
        savedStopName: 'Wachusett',
        routeId: 'CR-FITCHBURG',
        direction: 'outbound',
        patternId: '',
        scrolling: false,
        label: '',
        secondaryLabel: '',
        textColor: '#FFFFFF',
        nextStops: 3,
        displayFormat: 'single-line',
        primaryContent: 'destination',
        secondaryContent: 'direction',
      },
      {'commuter-rail': []},
      {},
    );

    expect(normalized.savedStopName).toBe('Wachusett');
    expect(syncArrivals([], [normalized])[0]?.minutes).toBe(null);
  });

  test('uses a stable MBTA commuter rail provider color', async () => {
    const {resolveProviderLineColor} = await import('../../../lib/lineColors');

    expect(resolveProviderLineColor('mbta-rail', 'CR-FITCHBURG')).toEqual({
      color: '#ED8B00',
      textColor: '#FFFFFF',
    });
    expect(resolveProviderLineColor('mbta-rail', 'CR-UNKNOWN')).toBe(null);
  });
});
