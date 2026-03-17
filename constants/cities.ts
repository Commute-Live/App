export type CityId = 'new-york' | 'philadelphia' | 'boston' | 'chicago';

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
    description: 'Subway + bus layouts with line badges and dense stop options.',
  },
  {
    id: 'philadelphia',
    label: 'Philly',
    shortLabel: 'Philly',
    agencyCode: 'SEPTA',
    agencyName: 'SEPTA',
    description: 'Regional rail and bus display setups for Center City commutes.',
  },
  {
    id: 'boston',
    label: 'Boston',
    shortLabel: 'Boston',
    agencyCode: 'MBTA',
    agencyName: 'MBTA',
    description: 'T and bus route selectors optimized for compact LCD layouts.',
  },
  {
    id: 'chicago',
    label: 'Chicago',
    shortLabel: 'Chicago',
    agencyCode: 'CTA',
    agencyName: 'CTA',
    description: 'L station and line selection flow tailored to CTA color lines.',
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
    badgeBorder: '#2D5DB5',
    badgeText: '#FFFFFF',
    accent: '#5CE1E6',
    accentSoft: '#12333A',
  },
  philadelphia: {
    badgeBg: '#0E3A6D',
    badgeBorder: '#1B5DA5',
    badgeText: '#FFFFFF',
    accent: '#FF8200',
    accentSoft: '#332211',
  },
  boston: {
    badgeBg: '#0E2C5A',
    badgeBorder: '#1E4F97',
    badgeText: '#FFFFFF',
    accent: '#DA291C',
    accentSoft: '#331918',
  },
  chicago: {
    badgeBg: '#2A0D12',
    badgeBorder: '#7C2233',
    badgeText: '#FFFFFF',
    accent: '#00A1DE',
    accentSoft: '#102B35',
  },
};

export function isCityId(value: string | undefined | null): value is CityId {
  return value === 'new-york' || value === 'philadelphia' || value === 'boston' || value === 'chicago';
}

export function normalizeCityId(value: string | undefined | null, fallback: CityId = 'new-york'): CityId {
  if (isCityId(value)) return value;
  return fallback;
}
