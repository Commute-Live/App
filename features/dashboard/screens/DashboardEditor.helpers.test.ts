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
});
