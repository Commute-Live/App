export type CityId =
  | 'new-york'
  | 'philadelphia'
  | 'boston'
  | 'chicago'
  | 'new-jersey'
  | 'new-york-new-jersey'
  | 'new-jersey-philadelphia';

export type CityOption = {
  id: CityId;
  label: string;
  shortLabel: string;
  agencyCode: string;
  agencyName: string;
  description: string;
};

export const CITY_OPTIONS: CityOption[] = [
  {
    id: 'new-york',
    label: 'New York',
    shortLabel: 'NYC',
    agencyCode: 'MTA',
    agencyName: 'MTA',
    description: 'All NYC subway lines, LIRR, Metro-North, and bus routes',
  },
  {
    id: 'philadelphia',
    label: 'Philly',
    shortLabel: 'Philly',
    agencyCode: 'SEPTA',
    agencyName: 'SEPTA',
    description: 'SEPTA rail, subway, trolley, and bus routes',
  },
  {
    id: 'boston',
    label: 'Boston',
    shortLabel: 'Boston',
    agencyCode: 'MBTA',
    agencyName: 'MBTA',
    description: 'All MBTA subway lines, commuter rail, and bus routes',
  },
  {
    id: 'chicago',
    label: 'Chicago',
    shortLabel: 'Chicago',
    agencyCode: 'CTA',
    agencyName: 'CTA',
    description: 'All CTA L lines and bus routes',
  },
  {
    id: 'new-jersey',
    label: 'New Jersey',
    shortLabel: 'NJ',
    agencyCode: 'NJT',
    agencyName: 'NJ Transit',
    description: 'NJ Transit rail across all corridors',
  },
  {
    id: 'new-york-new-jersey',
    label: 'New York + NJ',
    shortLabel: 'NY + NJ',
    agencyCode: 'MTA + NJT',
    agencyName: 'MTA + NJ Transit',
    description: 'Combined subway, commuter rail, and NJ Transit rail selection',
  },
  {
    id: 'new-jersey-philadelphia',
    label: 'NJ + Philly',
    shortLabel: 'NJ + PHL',
    agencyCode: 'NJT + SEPTA',
    agencyName: 'NJ Transit + SEPTA',
    description: 'Combined NJ Transit and SEPTA Regional Rail selection',
  },
];

export const CITY_LABELS: Record<CityId, string> = Object.fromEntries(
  CITY_OPTIONS.map(option => [option.id, option.label]),
) as Record<CityId, string>;

export const CITY_SHORT_LABELS: Record<CityId, string> = Object.fromEntries(
  CITY_OPTIONS.map(option => [option.id, option.shortLabel]),
) as Record<CityId, string>;

export const CITY_BRANDS: Record<
  CityId,
  {
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
    accent: string;
    accentSoft: string;
  }
> = {
  'new-york': {
    badgeBg: '#0039A6',
    badgeBorder: '#0039A6',
    badgeText: '#FFFFFF',
    accent: '#C4651A',
    accentSoft: '#EED8C4',
  },
  philadelphia: {
    badgeBg: '#7A3C10',
    badgeBorder: '#A0521A',
    badgeText: '#F7F2EB',
    accent: '#E8784A',
    accentSoft: '#F3DDC9',
  },
  boston: {
    badgeBg: '#5A4332',
    badgeBorder: '#7A604B',
    badgeText: '#F7F2EB',
    accent: '#B25D2C',
    accentSoft: '#EBDACA',
  },
  chicago: {
    badgeBg: '#6B584A',
    badgeBorder: '#8C7060',
    badgeText: '#F7F2EB',
    accent: '#C97A46',
    accentSoft: '#EEDDD0',
  },
  'new-jersey': {
    badgeBg: '#3B2C21',
    badgeBorder: '#5A4332',
    badgeText: '#F7F2EB',
    accent: '#8F5A31',
    accentSoft: '#E6D3C1',
  },
  'new-york-new-jersey': {
    badgeBg: '#1E335F',
    badgeBorder: '#2E4D8A',
    badgeText: '#F7F2EB',
    accent: '#B86A32',
    accentSoft: '#E8D7C7',
  },
  'new-jersey-philadelphia': {
    badgeBg: '#4B2E24',
    badgeBorder: '#6A4334',
    badgeText: '#F7F2EB',
    accent: '#C16A3B',
    accentSoft: '#ECD8CB',
  },
};

export function isCityId(value: string | undefined | null): value is CityId {
  return (
    value === 'new-york'
    || value === 'philadelphia'
    || value === 'boston'
    || value === 'chicago'
    || value === 'new-jersey'
    || value === 'new-york-new-jersey'
    || value === 'new-jersey-philadelphia'
  );
}

export function normalizeCityId(value: string | undefined | null, fallback: CityId = 'new-york'): CityId {
  if (isCityId(value)) return value;
  return fallback;
}
