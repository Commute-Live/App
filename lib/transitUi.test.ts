// @ts-nocheck
import {describe, expect, test} from 'bun:test';
import {
  getDirectionTerminalDisplayLabel,
  getLocalDirectionLabel,
  getLocalDirectionOptions,
  getLocalDirectionRequestId,
  getLocalDirectionTerminal,
  inferUiModeFromProvider,
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

  test('uses CTA L API metadata for direction options and labels', () => {
    const route = {
      id: 'BRN',
      directions: [
        makeDirection('1', 'dir0'),
        makeDirection('5', 'dir1'),
      ],
    };
    route.directions[0].label = 'To Kimball';
    route.directions[0].terminal = 'Kimball';
    route.directions[0].boundLabel = 'To Kimball';
    route.directions[0].toggleLabel = 'To Kimball';
    route.directions[0].summaryLabel = 'To Kimball';

    expect(getLocalDirectionOptions('chicago', 'train', route)).toEqual(['dir0', 'dir1']);
    expect(getLocalDirectionLabel('chicago', 'train', 'dir0', route)).toBe('To Kimball');
    expect(getLocalDirectionTerminal(route, 'dir0')).toBe('Kimball');
  });

  test('does not invent CTA L direction options without API metadata', () => {
    expect(getLocalDirectionOptions('chicago', 'train', 'BRN')).toEqual([]);
  });

  test('infers Chicago L mode from the updated provider mode alias', () => {
    expect(inferUiModeFromProvider('cta', undefined, undefined, 'cta/l')).toBe('train');
  });

  test('hides repeated terminal copy when the primary label already includes it', () => {
    expect(getDirectionTerminalDisplayLabel('To Howard', 'Howard')).toBeNull();
    expect(getDirectionTerminalDisplayLabel('Howard-bound', 'Howard')).toBeNull();
    expect(getDirectionTerminalDisplayLabel('Outbound', 'Alewife')).toBe('Alewife');
  });
});
