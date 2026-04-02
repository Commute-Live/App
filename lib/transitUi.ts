import type {CityId} from '../constants/cities';
import type {TransitUiMode} from '../types/transit';

export type UiDirection = 'uptown' | 'downtown';
type DirectionVariant = 'toggle' | 'bound' | 'summary';
type LocalMode = TransitUiMode;

const SEPTA_TROLLEY_ROUTE_LABELS: Record<string, string> = {
  D1: '101',
  D2: '102',
  G1: '15',
  T1: '10',
  T2: '11',
  T3: '13',
  T4: '34',
  T5: '36',
  'T BUS': 'T Bus',
  'T5 BUS': '36 Bus',
};

const BOSTON_SUBWAY_BADGE_LABELS: Record<string, string> = {
  RED: 'RED',
  ORANGE: 'ORG',
  BLUE: 'BLU',
  GREEN: 'GRN',
  'GREEN-B': 'B',
  'GREEN-C': 'C',
  'GREEN-D': 'D',
  'GREEN-E': 'E',
  MATTAPAN: 'MAT',
};

const BOSTON_COMMUTER_RAIL_BADGE_LABELS: Record<string, string> = {
  CAPEFLYER: 'CAPE',
  'CR-FAIRMOUNT': 'FAIR',
  'CR-FITCHBURG': 'FITCH',
  'CR-FOXBORO': 'FOXB',
  'CR-FRANKLIN': 'FRAN',
  'CR-GREENBUSH': 'GRNB',
  'CR-HAVERHILL': 'HAVE',
  'CR-KINGSTON': 'KING',
  'CR-LOWELL': 'LOWE',
  'CR-NEEDHAM': 'NEED',
  'CR-NEWBEDFORD': 'NBED',
  'CR-NEWBURYPORT': 'NBPT',
  'CR-PROVIDENCE': 'PROV',
  'CR-WORCESTER': 'WORC',
};

const BOSTON_FERRY_BADGE_LABELS: Record<string, string> = {
  'BOAT-EASTBOSTON': 'EB',
  'BOAT-F1': 'F1',
  'BOAT-F4': 'F4',
  'BOAT-F6': 'F6',
  'BOAT-F7': 'F7',
  'BOAT-F8': 'F8',
  'BOAT-LYNN': 'LYNN',
};

const MTA_MNR_LINE_LABELS: Record<string, string> = {
  '1': 'Hudson',
  '2': 'Harlem',
  '3': 'New Haven',
  '4': 'New Canaan',
  '5': 'Danbury',
  '6': 'Waterbury',
};

const CTA_TRAIN_DIRECTION_COPY: Record<
  string,
  Record<UiDirection, Record<DirectionVariant, string>>
> = {
  BLUE: {
    uptown: {toggle: "O'Hare", bound: "O'Hare-bound", summary: "O'Hare"},
    downtown: {toggle: 'Forest Park', bound: 'Forest Park-bound', summary: 'Forest Park'},
  },
  RED: {
    uptown: {toggle: 'Howard', bound: 'Howard-bound', summary: 'Howard'},
    downtown: {toggle: '95th', bound: '95th-bound', summary: '95th'},
  },
  BRN: {
    uptown: {toggle: 'Kimball', bound: 'Kimball-bound', summary: 'Kimball'},
    downtown: {toggle: 'Loop', bound: 'Loop-bound', summary: 'Loop'},
  },
  G: {
    uptown: {toggle: 'Harlem/Lake', bound: 'Harlem/Lake-bound', summary: 'Harlem/Lake'},
    downtown: {
      toggle: 'Ashland/63rd or Cottage Grove',
      bound: 'Ashland/63rd or Cottage Grove',
      summary: 'Ashland/63rd or Cottage Grove',
    },
  },
  ORG: {
    uptown: {toggle: 'Loop', bound: 'Loop-bound', summary: 'Loop'},
    downtown: {toggle: 'Midway', bound: 'Midway-bound', summary: 'Midway'},
  },
  P: {
    uptown: {toggle: 'Linden', bound: 'Linden-bound', summary: 'Linden'},
    downtown: {toggle: 'Loop', bound: 'Loop-bound', summary: 'Loop'},
  },
  PINK: {
    uptown: {toggle: 'Loop', bound: 'Loop-bound', summary: 'Loop'},
    downtown: {toggle: '54th/Cermak', bound: '54th/Cermak-bound', summary: '54th/Cermak'},
  },
  Y: {
    uptown: {toggle: 'Skokie', bound: 'Skokie-bound', summary: 'Skokie'},
    downtown: {toggle: 'Howard', bound: 'Howard-bound', summary: 'Howard'},
  },
};

const normalizeToken = (value: string | null | undefined) => value?.trim().toUpperCase() ?? '';

const trimLineSuffix = (value: string) => value.replace(/\s+Line$/i, '').trim();

const stripBostonRoutePrefix = (value: string) => value.replace(/^CR-/i, '').trim();

const compactBostonCommuterRailLabel = (value: string) =>
  value
    .replace(/\s+Line$/i, '')
    .replace(/\s+Event Service$/i, '')
    .trim();

const compactBostonFerryLabel = (routeId: string, label: string) => {
  const normalizedId = normalizeToken(routeId);
  if (normalizedId === 'BOAT-EASTBOSTON') return 'East Boston';
  if (normalizedId === 'BOAT-LYNN') return 'Lynn';
  if (/^BOAT-F\d+$/i.test(normalizedId)) return normalizedId.replace(/^BOAT-/i, '');
  return label.trim();
};

const compactSeptaRailLabel = (routeLabel: string) => trimLineSuffix(routeLabel).trim();

const resolveSeptaTrolleyLabel = (routeId: string, routeLabel: string) => {
  const mapped = SEPTA_TROLLEY_ROUTE_LABELS[normalizeToken(routeId)];
  if (mapped) return mapped;
  const routeNumber = routeLabel.match(/^Route\s+(\d+)/i)?.[1];
  return routeNumber ?? routeLabel.trim();
};

const defaultDirectionLabel = (direction: UiDirection, variant: DirectionVariant) => {
  if (variant === 'summary') {
    return direction === 'downtown' ? 'Downtown / South' : 'Uptown / North';
  }
  return direction === 'downtown' ? 'Downtown' : 'Uptown';
};

export const inferMbtaMode = (stopId: string | null | undefined, lineId?: string | null): LocalMode => {
  const normalizedStopId = (stopId ?? '').trim();
  const normalizedLineId = normalizeToken(lineId);
  if (/^BOAT-/i.test(normalizedStopId) || normalizedLineId.startsWith('BOAT-')) return 'ferry';
  if (/^\d+$/.test(normalizedStopId)) return 'bus';
  if (normalizedStopId && !/^PLACE-/i.test(normalizedStopId)) return 'commuter-rail';
  return 'train';
};

export const inferUiModeFromProvider = (
  provider: string | null | undefined,
  stopId?: string | null,
  lineId?: string | null,
): LocalMode | null => {
  switch ((provider ?? '').trim().toLowerCase()) {
    case 'mta-subway':
      return 'train';
    case 'mta-bus':
      return 'bus';
    case 'mta-lirr':
      return 'lirr';
    case 'mta-mnr':
      return 'mnr';
    case 'cta-subway':
      return 'train';
    case 'cta-bus':
      return 'bus';
    case 'septa-rail':
      return 'train';
    case 'septa-bus':
      return 'bus';
    case 'septa-trolley':
      return 'trolley';
    case 'mbta':
      return inferMbtaMode(stopId, lineId);
    default:
      return null;
  }
};

export const getLocalModeLabel = (city: CityId, mode: LocalMode) => {
  if (mode === 'train') {
    if (city === 'philadelphia') return 'Regional Rail';
    if (city === 'chicago') return 'L';
    if (city === 'boston') return 'T';
    return 'Subway';
  }
  if (mode === 'bus') return 'Bus';
  if (mode === 'trolley') return 'Trolley';
  if (mode === 'ferry') return 'Ferry';
  if (mode === 'lirr') return 'LIRR';
  if (mode === 'mnr') return 'Metro-North';
  if (mode === 'commuter-rail') return 'Commuter Rail';
  return 'Commuter Rail';
};

export const formatLocalRoutePickerLabel = (
  city: CityId,
  mode: LocalMode,
  routeId: string,
  routeLabel: string,
) => {
  if (city === 'new-york' && mode === 'bus') {
    return routeLabel.replace(/-?SBS\b/gi, '+').replace(/\s+/g, '');
  }
  if (city === 'chicago' && mode === 'train') {
    return trimLineSuffix(routeLabel);
  }
  if (city === 'boston' && mode === 'train') {
    return trimLineSuffix(routeLabel).replace(/^Green Line\s+/i, 'Green ');
  }
  if (city === 'boston' && mode === 'commuter-rail') {
    const sourceLabel = !routeLabel || normalizeToken(routeLabel) === normalizeToken(routeId)
      ? stripBostonRoutePrefix(routeId)
      : routeLabel;
    return compactBostonCommuterRailLabel(sourceLabel);
  }
  if (city === 'boston' && mode === 'ferry') {
    const sourceLabel = !routeLabel || normalizeToken(routeLabel) === normalizeToken(routeId)
      ? routeId
      : routeLabel;
    return compactBostonFerryLabel(routeId, sourceLabel);
  }
  if (city === 'philadelphia' && mode === 'train') {
    return compactSeptaRailLabel(routeLabel);
  }
  if (city === 'philadelphia' && mode === 'trolley') {
    return resolveSeptaTrolleyLabel(routeId, routeLabel);
  }
  return routeLabel.trim();
};

export const getLocalLineLabel = (
  city: CityId,
  mode: LocalMode,
  routeId: string,
  routeLabel: string,
) => {
  if (mode === 'lirr') return routeLabel.replace(/\s+Branch$/i, '').trim();
  if (mode === 'mnr') {
    return MTA_MNR_LINE_LABELS[normalizeToken(routeId)] ?? routeLabel.trim();
  }
  return formatLocalRoutePickerLabel(city, mode, routeId, routeLabel);
};

export const getLocalRouteBadgeLabel = (
  city: CityId,
  mode: LocalMode,
  routeId: string,
  routeLabel?: string | null,
) => {
  const normalizedId = normalizeToken(routeId);
  const safeLabel = (routeLabel ?? routeId).trim();

  if (city === 'new-york' && mode === 'bus') {
    return formatLocalRoutePickerLabel(city, mode, routeId, safeLabel);
  }
  if (city === 'chicago' && mode === 'train') {
    return normalizedId.slice(0, 4) || trimLineSuffix(safeLabel).toUpperCase().slice(0, 4);
  }
  if (city === 'philadelphia' && mode === 'train') {
    return normalizedId || compactSeptaRailLabel(safeLabel).toUpperCase().slice(0, 4);
  }
  if (city === 'philadelphia' && mode === 'trolley') {
    return resolveSeptaTrolleyLabel(routeId, safeLabel);
  }
  if (city === 'boston' && mode === 'train') {
    return (
      BOSTON_SUBWAY_BADGE_LABELS[normalizedId] ??
      BOSTON_SUBWAY_BADGE_LABELS[normalizeToken(trimLineSuffix(safeLabel))] ??
      trimLineSuffix(safeLabel).toUpperCase().slice(0, 4)
    );
  }
  if (city === 'boston' && mode === 'commuter-rail') {
    return (
      BOSTON_COMMUTER_RAIL_BADGE_LABELS[normalizedId] ??
      BOSTON_COMMUTER_RAIL_BADGE_LABELS[normalizeToken(stripBostonRoutePrefix(routeId))] ??
      stripBostonRoutePrefix(routeId).toUpperCase().slice(0, 4)
    );
  }
  if (city === 'boston' && mode === 'ferry') {
    return BOSTON_FERRY_BADGE_LABELS[normalizedId] ?? compactBostonFerryLabel(routeId, safeLabel).toUpperCase().slice(0, 5);
  }
  if (mode === 'mnr') return stripBostonRoutePrefix(routeId || safeLabel).toUpperCase().slice(0, 4);
  return safeLabel.toUpperCase().slice(0, 4);
};

export const getLocalDirectionLabel = (
  city: CityId,
  mode: LocalMode,
  direction: UiDirection,
  routeId?: string | null,
  variant: DirectionVariant = 'bound',
) => {
  if (city === 'chicago' && mode === 'train') {
    const copy = CTA_TRAIN_DIRECTION_COPY[normalizeToken(routeId)];
    if (copy) return copy[direction][variant];
  }
  if (city === 'boston') {
    return direction === 'uptown' ? 'Outbound' : 'Inbound';
  }
  if (city === 'philadelphia' && mode === 'train') {
    return direction === 'uptown' ? 'Northbound' : 'Southbound';
  }
  if (city === 'philadelphia' && (mode === 'bus' || mode === 'trolley')) {
    return direction === 'uptown' ? 'Outbound' : 'Inbound';
  }
  if (mode === 'mnr') {
    return direction === 'uptown' ? 'Outbound' : 'Inbound';
  }
  return defaultDirectionLabel(direction, variant);
};

export const serializeUiDirection = (city: CityId, mode: LocalMode, direction: UiDirection) => {
  if (city === 'boston') {
    return direction === 'uptown' ? '0' : '1';
  }
  if (city === 'philadelphia' && (mode === 'bus' || mode === 'trolley')) {
    return direction === 'uptown' ? '0' : '1';
  }
  return direction === 'uptown' ? 'N' : 'S';
};

export const deserializeUiDirection = (
  city: CityId,
  mode: LocalMode,
  value: string | null | undefined,
  stopId?: string | null,
): UiDirection => {
  const normalized = normalizeToken(value);
  if (city === 'boston') {
    return normalized === '1' || normalized === 'INBOUND' ? 'downtown' : 'uptown';
  }
  if (city === 'philadelphia' && (mode === 'bus' || mode === 'trolley')) {
    return normalized === '1' ? 'downtown' : 'uptown';
  }
  if (normalized === 'S' || normalized === 'SOUTHBOUND' || (!normalized && normalizeToken(stopId).endsWith('S'))) {
    return 'downtown';
  }
  return 'uptown';
};

export const isRailLinePreviewMode = (city: CityId, mode: LocalMode) =>
  mode === 'lirr' || mode === 'mnr' || mode === 'commuter-rail' || (city === 'philadelphia' && mode === 'train');
