// @ts-nocheck
import {describe, expect, mock, test} from 'bun:test';

const apiFetchMock = mock(async () => {
  throw new Error('apiFetch mock response was not configured');
});

mock.module('./api', () => ({
  apiFetch: apiFetchMock,
}));

const ctaContext = {
  city: 'chicago',
  uiMode: 'train',
  provider: 'cta',
  mode: 'l',
  providerMode: 'cta/l',
};

describe('transit API normalization', () => {
  test('normalizes compact CTA L direction metadata from the API', async () => {
    const {normalizeTransitLine} = await import('./transitApi');
    const line = normalizeTransitLine({
      id: 'BRN',
      name: 'Brown Line',
      directions: [
        {id: '1', label: 'To Kimball'},
        {id: '5', label: 'To Loop'},
      ],
    }, ctaContext);

    expect(line?.directions).toEqual([
      {
        id: '1',
        uiKey: 'dir0',
        label: 'To Kimball',
        terminal: 'Kimball',
        boundLabel: 'To Kimball',
        toggleLabel: 'To Kimball',
        summaryLabel: 'To Kimball',
      },
      {
        id: '5',
        uiKey: 'dir1',
        label: 'To Loop',
        terminal: 'Loop',
        boundLabel: 'To Loop',
        toggleLabel: 'To Loop',
        summaryLabel: 'To Loop',
      },
    ]);
  });
});

describe('transit API endpoints', () => {
  test('requests CTA L line stops with the selected direction', async () => {
    apiFetchMock.mockResolvedValueOnce(new Response(JSON.stringify({stations: []}), {status: 200}));
    const {getTransitStopsForLine} = await import('./transitApi');

    await getTransitStopsForLine('chicago', 'train', 'ORG', {direction: '1'});

    expect(apiFetchMock).toHaveBeenCalledWith('/cta/stations/l/ORG/stopId?direction=1');
  });
});
