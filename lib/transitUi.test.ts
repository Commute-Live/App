// @ts-nocheck
import {describe, expect, test} from 'bun:test';
import {
  formatLocalRoutePickerLabel,
  getLocalDirectionRequestId,
  getLocalLineLabel,
} from './transitUi';

const makeDirection = (id: string, uiKey: string) => ({
  id,
  uiKey,
  label: uiKey,
  terminal: null,
  boundLabel: uiKey,
  toggleLabel: uiKey,
  summaryLabel: uiKey,
});

describe('transit direction request ids', () => {
  test('prefers route metadata ids when present', () => {
    const route = {
      id: '22',
      directions: [
        makeDirection('0', 'dir0'),
        makeDirection('1', 'dir1'),
      ],
    };

    expect(getLocalDirectionRequestId('chicago', 'bus', 'dir0', route)).toBe('0');
    expect(getLocalDirectionRequestId('chicago', 'bus', 'dir1', route)).toBe('1');
  });

  test('falls back to serialized city direction ids when metadata is missing', () => {
    expect(getLocalDirectionRequestId('new-york', 'train', 'uptown')).toBe('N');
    expect(getLocalDirectionRequestId('boston', 'commuter-rail', 'inbound')).toBe('1');
  });
});

describe('New York commuter rail labels', () => {
  test('maps numeric LIRR ids to branch names', () => {
    expect(formatLocalRoutePickerLabel('new-york', 'lirr', '9', '9')).toBe('Port Washington Branch');
    expect(getLocalLineLabel('new-york', 'lirr', '9', '9')).toBe('Port Washington');
  });

  test('preserves explicit backend labels when present', () => {
    expect(formatLocalRoutePickerLabel('new-york', 'lirr', '9', 'Port Washington Branch')).toBe('Port Washington Branch');
    expect(getLocalLineLabel('new-york', 'lirr', '9', 'Port Washington Branch')).toBe('Port Washington');
  });
});
