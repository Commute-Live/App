// @ts-nocheck
import {describe, expect, test} from 'bun:test';
import {
  buildNewYorkSubwayRouteGroups,
  prepareNewYorkSubwayRouteEntries,
} from './subway';

const makeRoute = (id: string, sortOrder: number | null = null) => ({
  id,
  label: id,
  shortName: id,
  color: '#000000',
  textColor: '#FFFFFF',
  sortOrder,
  headsign0: null,
  headsign1: null,
  directions: [],
});

describe('New York subway picker ordering', () => {
  test('groups express variants under the base line badge and sorts rows canonically', () => {
    const rows = prepareNewYorkSubwayRouteEntries([
      makeRoute('FX', 18),
      makeRoute('Z', 26),
      makeRoute('4', 4),
      makeRoute('A', 8),
      makeRoute('7X', 7),
      makeRoute('R', 14),
      makeRoute('1', 1),
      makeRoute('F', 17),
      makeRoute('6', 6),
      makeRoute('6X', 6),
      makeRoute('G', 24),
      makeRoute('7', 7),
      makeRoute('W', 15),
      makeRoute('2', 2),
      makeRoute('L', 23),
      makeRoute('B', 16),
      makeRoute('M', 22),
      makeRoute('J', 25),
      makeRoute('Q', 13),
      makeRoute('D', 17),
      makeRoute('3', 3),
      makeRoute('5', 5),
      makeRoute('C', 9),
      makeRoute('E', 10),
      makeRoute('N', 12),
    ]);

    expect(rows.map(row => row.id)).toEqual([
      '1', '2', '3',
      '4', '5', '6', '7',
      'A', 'C', 'E',
      'N', 'Q', 'R', 'W',
      'B', 'D', 'F', 'M',
      'L', 'G', 'J', 'Z',
    ]);
    expect(rows.find(row => row.id === '6')?.routes.map(route => route.id)).toEqual(['6', '6X']);
    expect(rows.find(row => row.id === '7')?.routes.map(route => route.id)).toEqual(['7', '7X']);
    expect(rows.find(row => row.id === 'F')?.routes.map(route => route.id)).toEqual(['F', 'FX']);
  });

  test('builds subway picker rows to match the canonical MTA grouping before extras', () => {
    const groups = buildNewYorkSubwayRouteGroups(
      prepareNewYorkSubwayRouteEntries([
        makeRoute('S', 27),
        makeRoute('A', 8),
        makeRoute('7', 7),
        makeRoute('4', 4),
        makeRoute('1', 1),
        makeRoute('N', 12),
        makeRoute('B', 16),
        makeRoute('L', 23),
      ]),
    );

    expect(groups.map(group => group.routes.map(route => route.id))).toEqual([
      ['1'],
      ['4', '7'],
      ['A'],
      ['N'],
      ['B'],
      ['L'],
      ['S'],
    ]);
  });
});
