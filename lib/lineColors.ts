import type {CityId} from '../constants/cities';

type OnboardingProvider = 'MTA' | 'CTA' | 'MBTA' | 'SEPTA' | 'Bay Area';

export const FALLBACK_ROUTE_COLORS = [
  '#0039A6', '#00933C', '#EE352E', '#FF8200', '#B933AD', '#7C2233', '#00A1DE',
];

// Official transit agency colors keyed by city → line ID
export const CITY_LINE_COLORS: Partial<Record<CityId, Record<string, {color: string; textColor: string}>>> = {
  'new-york': {
    // IRT / numbered lines
    '1':  {color: '#EE352E', textColor: '#FFFFFF'},
    '2':  {color: '#EE352E', textColor: '#FFFFFF'},
    '3':  {color: '#EE352E', textColor: '#FFFFFF'},
    '4':  {color: '#00933C', textColor: '#FFFFFF'},
    '5':  {color: '#00933C', textColor: '#FFFFFF'},
    '6':  {color: '#00933C', textColor: '#FFFFFF'},
    '6X': {color: '#00933C', textColor: '#FFFFFF'},
    '7':  {color: '#B933AD', textColor: '#FFFFFF'},
    '7X': {color: '#B933AD', textColor: '#FFFFFF'},
    // IND
    'A':  {color: '#0039A6', textColor: '#FFFFFF'},
    'C':  {color: '#0039A6', textColor: '#FFFFFF'},
    'E':  {color: '#0039A6', textColor: '#FFFFFF'},
    'B':  {color: '#FF6319', textColor: '#FFFFFF'},
    'D':  {color: '#FF6319', textColor: '#FFFFFF'},
    'F':  {color: '#FF6319', textColor: '#FFFFFF'},
    'FX': {color: '#FF6319', textColor: '#FFFFFF'},
    'M':  {color: '#FF6319', textColor: '#FFFFFF'},
    'G':  {color: '#6CBE45', textColor: '#FFFFFF'},
    // BMT
    'J':  {color: '#996633', textColor: '#FFFFFF'},
    'Z':  {color: '#996633', textColor: '#FFFFFF'},
    'L':  {color: '#808183', textColor: '#FFFFFF'},
    'N':  {color: '#FCCC0A', textColor: '#000000'},
    'Q':  {color: '#FCCC0A', textColor: '#000000'},
    'R':  {color: '#FCCC0A', textColor: '#000000'},
    'W':  {color: '#FCCC0A', textColor: '#000000'},
    // Shuttles / SIR
    'S':  {color: '#808183', textColor: '#FFFFFF'},
    'FS': {color: '#808183', textColor: '#FFFFFF'},
    'GS': {color: '#808183', textColor: '#FFFFFF'},
    'SI': {color: '#0039A6', textColor: '#FFFFFF'},
  },
  chicago: {
    // CTA L lines — keyed by both longName-derived keys and actual API IDs (uppercase)
    'Red':    {color: '#C60C30', textColor: '#FFFFFF'},
    'Blue':   {color: '#00A1DE', textColor: '#FFFFFF'},
    'Brown':  {color: '#62361B', textColor: '#FFFFFF'},
    'Green':  {color: '#009B3A', textColor: '#FFFFFF'},
    'Orange': {color: '#F9461C', textColor: '#FFFFFF'},
    'Pink':   {color: '#E27EA6', textColor: '#FFFFFF'},
    'Purple': {color: '#522398', textColor: '#FFFFFF'},
    'Yellow': {color: '#F9E300', textColor: '#000000'},
    // API returns uppercase IDs
    'RED':    {color: '#C60C30', textColor: '#FFFFFF'},
    'BLUE':   {color: '#00A1DE', textColor: '#FFFFFF'},
    'BRN':    {color: '#62361B', textColor: '#FFFFFF'},
    'G':      {color: '#009B3A', textColor: '#FFFFFF'},
    'ORG':    {color: '#F9461C', textColor: '#FFFFFF'},
    'P':      {color: '#522398', textColor: '#FFFFFF'},
    'PEXP':   {color: '#522398', textColor: '#FFFFFF'},
    'PINK':   {color: '#E27EA6', textColor: '#FFFFFF'},
    'Y':      {color: '#F9E300', textColor: '#000000'},
    // Also handle lowercase / short IDs
    'red':    {color: '#C60C30', textColor: '#FFFFFF'},
    'blue':   {color: '#00A1DE', textColor: '#FFFFFF'},
    'brn':    {color: '#62361B', textColor: '#FFFFFF'},
    'g':      {color: '#009B3A', textColor: '#FFFFFF'},
    'org':    {color: '#F9461C', textColor: '#FFFFFF'},
    'p':      {color: '#522398', textColor: '#FFFFFF'},
    'pexp':   {color: '#522398', textColor: '#FFFFFF'},
    'pink':   {color: '#E27EA6', textColor: '#FFFFFF'},
    'y':      {color: '#F9E300', textColor: '#000000'},
  },
  boston: {
    // MBTA rapid transit — keyed by actual API IDs and common variants
    'Red':     {color: '#DA291C', textColor: '#FFFFFF'},
    'Orange':  {color: '#ED8B00', textColor: '#FFFFFF'},
    'Blue':    {color: '#003DA5', textColor: '#FFFFFF'},
    'Green':   {color: '#00843D', textColor: '#FFFFFF'},
    'Silver':  {color: '#7C878E', textColor: '#FFFFFF'},
    'Mattapan':{color: '#DA291C', textColor: '#FFFFFF'},
    // Green line branches (MBTA API uses these as lineId)
    'Green-B': {color: '#00843D', textColor: '#FFFFFF'},
    'Green-C': {color: '#00843D', textColor: '#FFFFFF'},
    'Green-D': {color: '#00843D', textColor: '#FFFFFF'},
    'Green-E': {color: '#00843D', textColor: '#FFFFFF'},
    // Short IDs
    'RL': {color: '#DA291C', textColor: '#FFFFFF'},
    'OL': {color: '#ED8B00', textColor: '#FFFFFF'},
    'BL': {color: '#003DA5', textColor: '#FFFFFF'},
    'GL': {color: '#00843D', textColor: '#FFFFFF'},
  },
  philadelphia: {
    // SEPTA Regional Rail
    'AIR': {color: '#005DAA', textColor: '#FFFFFF'},
    'CHE': {color: '#005DAA', textColor: '#FFFFFF'},
    'CHW': {color: '#005DAA', textColor: '#FFFFFF'},
    'CYN': {color: '#005DAA', textColor: '#FFFFFF'},
    'FOX': {color: '#005DAA', textColor: '#FFFFFF'},
    'LAN': {color: '#005DAA', textColor: '#FFFFFF'},
    'MED': {color: '#005DAA', textColor: '#FFFFFF'},
    'NOR': {color: '#005DAA', textColor: '#FFFFFF'},
    'PAO': {color: '#005DAA', textColor: '#FFFFFF'},
    'TRE': {color: '#005DAA', textColor: '#FFFFFF'},
    'WAR': {color: '#005DAA', textColor: '#FFFFFF'},
    'WIL': {color: '#005DAA', textColor: '#FFFFFF'},
    'WTR': {color: '#005DAA', textColor: '#FFFFFF'},
    // Subway / BSL / MFL
    'BSL': {color: '#FF6900', textColor: '#FFFFFF'},
    'MFL': {color: '#005DAA', textColor: '#FFFFFF'},
  },
};

// Bay Area SF Muni tram lines (operator_id=SF)
const BAY_AREA_LINE_COLORS: Record<string, {color: string; textColor: string}> = {
  'SF:F':    {color: '#BA0016', textColor: '#FFFFFF'},
  'SF:FBUS': {color: '#666666', textColor: '#FFFFFF'},
  'SF:J':    {color: '#BA0016', textColor: '#FFFFFF'},
  'SF:K':    {color: '#BA0016', textColor: '#FFFFFF'},
  'SF:L':    {color: '#BA0016', textColor: '#FFFFFF'},
  'SF:M':    {color: '#BA0016', textColor: '#FFFFFF'},
  'SF:N':    {color: '#BA0016', textColor: '#FFFFFF'},
  'SF:T':    {color: '#BA0016', textColor: '#FFFFFF'},
};

const PROVIDER_TO_CITY: Record<OnboardingProvider, CityId | null> = {
  MTA: 'new-york',
  CTA: 'chicago',
  MBTA: 'boston',
  SEPTA: 'philadelphia',
  'Bay Area': null,
};

export function hashLineColor(id: string): {color: string; textColor: string} {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return {color: FALLBACK_ROUTE_COLORS[hash % FALLBACK_ROUTE_COLORS.length], textColor: '#FFFFFF'};
}

export function resolveLineColor(
  provider: OnboardingProvider,
  lineId: string,
): {color: string; textColor: string} {
  if (provider === 'Bay Area') {
    return BAY_AREA_LINE_COLORS[lineId] ?? hashLineColor(lineId);
  }
  const city = PROVIDER_TO_CITY[provider];
  if (!city) return hashLineColor(lineId);
  const map = CITY_LINE_COLORS[city];
  return (
    map?.[lineId] ??
    map?.[lineId.toLowerCase()] ??
    hashLineColor(lineId)
  );
}
