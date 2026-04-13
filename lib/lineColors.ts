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
    'L':  {color: '#A7A9AC', textColor: '#FFFFFF'},
    'N':  {color: '#FCCC0A', textColor: '#000000'},
    'Q':  {color: '#FCCC0A', textColor: '#000000'},
    'R':  {color: '#FCCC0A', textColor: '#000000'},
    'W':  {color: '#FCCC0A', textColor: '#000000'},
    // Shuttles / SIR
    'S':  {color: '#808183', textColor: '#FFFFFF'},
    'FS': {color: '#808183', textColor: '#FFFFFF'},
    'GS': {color: '#808183', textColor: '#FFFFFF'},
    'SI': {color: '#0039A6', textColor: '#FFFFFF'},
    // LIRR branches — official MTA colors, keyed by API label
    'Babylon Branch':        {color: '#00985F', textColor: '#FFFFFF'},
    'Belmont Branch':        {color: '#60269E', textColor: '#FFFFFF'},
    'Belmont Park':          {color: '#60269E', textColor: '#FFFFFF'},
    'Belmont Park Spur':     {color: '#805DA7', textColor: '#FFFFFF'},
    'Hempstead Branch':      {color: '#CE8E00', textColor: '#FFFFFF'},
    'Oyster Bay Branch':     {color: '#00AF3F', textColor: '#FFFFFF'},
    'Ronkonkoma Branch':     {color: '#A626AA', textColor: '#FFFFFF'},
    'Montauk Branch':        {color: '#006983', textColor: '#FFFFFF'},
    'Long Beach Branch':     {color: '#FF6319', textColor: '#FFFFFF'},
    'Far Rockaway Branch':   {color: '#6E3219', textColor: '#FFFFFF'},
    'West Hempstead Branch': {color: '#00A1DE', textColor: '#FFFFFF'},
    'Port Washington Branch':{color: '#C60C30', textColor: '#FFFFFF'},
    'Port Jefferson Branch': {color: '#0039A6', textColor: '#FFFFFF'},
    'City Terminal Zone':    {color: '#4D5357', textColor: '#FFFFFF'},
    'Greenport Service':     {color: '#A626AA', textColor: '#FFFFFF'},
    // MNR branches — keyed by both label and numeric route ID
    'Hudson':            {color: '#009B3A', textColor: '#FFFFFF'},
    'Hudson Line':       {color: '#009B3A', textColor: '#FFFFFF'},
    'Harlem':            {color: '#0039A6', textColor: '#FFFFFF'},
    'Harlem Line':       {color: '#0039A6', textColor: '#FFFFFF'},
    'New Haven':         {color: '#EE0034', textColor: '#FFFFFF'},
    'New Haven Line':    {color: '#EE0034', textColor: '#FFFFFF'},
    'New Canaan':        {color: '#EE0034', textColor: '#FFFFFF'},
    'New Canaan Branch': {color: '#EE0034', textColor: '#FFFFFF'},
    'Danbury':           {color: '#EE0034', textColor: '#FFFFFF'},
    'Danbury Branch':    {color: '#EE0034', textColor: '#FFFFFF'},
    'Waterbury':         {color: '#EE0034', textColor: '#FFFFFF'},
    'Waterbury Branch':  {color: '#EE0034', textColor: '#FFFFFF'},
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
  philadelphia: {
    // SEPTA Regional Rail — official GTFS colors (route_short_name keys)
    'AIR': {color: '#005DAA', textColor: '#FFFFFF'}, // Airport
    'CHE': {color: '#005DAA', textColor: '#FFFFFF'}, // Chestnut Hill East
    'CHW': {color: '#005DAA', textColor: '#FFFFFF'}, // Chestnut Hill West
    'CYN': {color: '#005DAA', textColor: '#FFFFFF'}, // Cynwyd
    'FOX': {color: '#005DAA', textColor: '#FFFFFF'}, // Fox Chase
    'LAN': {color: '#005DAA', textColor: '#FFFFFF'}, // Lansdale/Doylestown
    'MED': {color: '#7B2D8B', textColor: '#FFFFFF'}, // Media/Elwyn
    'NOR': {color: '#005DAA', textColor: '#FFFFFF'}, // Manayunk/Norristown
    'PAO': {color: '#005DAA', textColor: '#FFFFFF'}, // Paoli/Thorndale
    'TRE': {color: '#C8102E', textColor: '#FFFFFF'}, // Trenton
    'WAR': {color: '#005DAA', textColor: '#FFFFFF'}, // Warminster
    'WIL': {color: '#005DAA', textColor: '#FFFFFF'}, // Wilmington/Newark
    'WTR': {color: '#005DAA', textColor: '#FFFFFF'}, // West Trenton
    // Trolleys
    '10': {color: '#3B7B38', textColor: '#FFFFFF'},
    '11': {color: '#3B7B38', textColor: '#FFFFFF'},
    '13': {color: '#3B7B38', textColor: '#FFFFFF'},
    '15': {color: '#3B7B38', textColor: '#FFFFFF'},
    '34': {color: '#3B7B38', textColor: '#FFFFFF'},
    '36': {color: '#3B7B38', textColor: '#FFFFFF'},
    // Bus fallback
    'septa-bus': {color: '#005DAA', textColor: '#FFFFFF'},
  },
  boston: {
    // MBTA rapid transit — keyed by actual API IDs and common variants
    'Red':     {color: '#DA291C', textColor: '#FFFFFF'},
    'RED':     {color: '#DA291C', textColor: '#FFFFFF'},
    'Orange':  {color: '#ED8B00', textColor: '#FFFFFF'},
    'ORANGE':  {color: '#ED8B00', textColor: '#FFFFFF'},
    'Blue':    {color: '#003DA5', textColor: '#FFFFFF'},
    'BLUE':    {color: '#003DA5', textColor: '#FFFFFF'},
    'Green':   {color: '#00843D', textColor: '#FFFFFF'},
    'GREEN':   {color: '#00843D', textColor: '#FFFFFF'},
    'Silver':  {color: '#7C878E', textColor: '#FFFFFF'},
    'SILVER':  {color: '#7C878E', textColor: '#FFFFFF'},
    'Mattapan':{color: '#DA291C', textColor: '#FFFFFF'},
    'MATTAPAN':{color: '#DA291C', textColor: '#FFFFFF'},
    // Green line branches (MBTA API uses these as lineId)
    'Green-B': {color: '#00843D', textColor: '#FFFFFF'},
    'GREEN-B': {color: '#00843D', textColor: '#FFFFFF'},
    'Green-C': {color: '#00843D', textColor: '#FFFFFF'},
    'GREEN-C': {color: '#00843D', textColor: '#FFFFFF'},
    'Green-D': {color: '#00843D', textColor: '#FFFFFF'},
    'GREEN-D': {color: '#00843D', textColor: '#FFFFFF'},
    'Green-E': {color: '#00843D', textColor: '#FFFFFF'},
    'GREEN-E': {color: '#00843D', textColor: '#FFFFFF'},
    // Short IDs
    'RL': {color: '#DA291C', textColor: '#FFFFFF'},
    'OL': {color: '#ED8B00', textColor: '#FFFFFF'},
    'BL': {color: '#003DA5', textColor: '#FFFFFF'},
    'GL': {color: '#00843D', textColor: '#FFFFFF'},
    // Compact local badge labels
    'ORG': {color: '#ED8B00', textColor: '#FFFFFF'},
    'BLU': {color: '#003DA5', textColor: '#FFFFFF'},
    'GRN': {color: '#00843D', textColor: '#FFFFFF'},
    'MAT': {color: '#DA291C', textColor: '#FFFFFF'},
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

// SEPTA rail lines — keyed by GTFS route_short_name. Most are SEPTA blue;
// Media/Elwyn and Trenton have distinct official colors.
const SEPTA_RAIL_COLORS: Record<string, {color: string; textColor: string}> = {
  'AIR': {color: '#005DAA', textColor: '#FFFFFF'}, // Airport
  'CHE': {color: '#005DAA', textColor: '#FFFFFF'}, // Chestnut Hill East
  'CHW': {color: '#005DAA', textColor: '#FFFFFF'}, // Chestnut Hill West
  'CYN': {color: '#005DAA', textColor: '#FFFFFF'}, // Cynwyd
  'FOX': {color: '#005DAA', textColor: '#FFFFFF'}, // Fox Chase
  'LAN': {color: '#005DAA', textColor: '#FFFFFF'}, // Lansdale/Doylestown
  'MED': {color: '#7B2D8B', textColor: '#FFFFFF'}, // Media/Elwyn
  'NOR': {color: '#005DAA', textColor: '#FFFFFF'}, // Manayunk/Norristown
  'PAO': {color: '#005DAA', textColor: '#FFFFFF'}, // Paoli/Thorndale
  'TRE': {color: '#C8102E', textColor: '#FFFFFF'}, // Trenton
  'WAR': {color: '#005DAA', textColor: '#FFFFFF'}, // Warminster
  'WIL': {color: '#005DAA', textColor: '#FFFFFF'}, // Wilmington/Newark
  'WTR': {color: '#005DAA', textColor: '#FFFFFF'}, // West Trenton
};

// SEPTA trolley lines — keyed by internal GTFS route ID
const SEPTA_TROLLEY_COLORS: Record<string, {color: string; textColor: string}> = {
  'G1': {color: '#3B7B38', textColor: '#FFFFFF'}, // Route 15
  'T1': {color: '#3B7B38', textColor: '#FFFFFF'}, // Route 10
  'T2': {color: '#3B7B38', textColor: '#FFFFFF'}, // Route 11
  'T3': {color: '#3B7B38', textColor: '#FFFFFF'}, // Route 13
  'T4': {color: '#3B7B38', textColor: '#FFFFFF'}, // Route 34
  'T5': {color: '#3B7B38', textColor: '#FFFFFF'}, // Route 36
};

// LIRR/MNR use numeric route IDs that collide with subway line numbers,
// so they need a separate provider-scoped lookup.
const LIRR_ROUTE_COLORS: Record<string, {color: string; textColor: string}> = {
  '1':  {color: '#00985F', textColor: '#FFFFFF'}, // Babylon
  '2':  {color: '#CE8E00', textColor: '#FFFFFF'}, // Hempstead
  '3':  {color: '#00AF3F', textColor: '#FFFFFF'}, // Oyster Bay
  '4':  {color: '#A626AA', textColor: '#FFFFFF'}, // Ronkonkoma
  '5':  {color: '#006983', textColor: '#FFFFFF'}, // Montauk
  '6':  {color: '#FF6319', textColor: '#FFFFFF'}, // Long Beach
  '7':  {color: '#6E3219', textColor: '#FFFFFF'}, // Far Rockaway
  '8':  {color: '#00A1DE', textColor: '#FFFFFF'}, // West Hempstead
  '9':  {color: '#C60C30', textColor: '#FFFFFF'}, // Port Washington
  '10': {color: '#0039A6', textColor: '#FFFFFF'}, // Port Jefferson
  '12': {color: '#4D5357', textColor: '#FFFFFF'}, // City Terminal Zone
  '13': {color: '#A626AA', textColor: '#FFFFFF'}, // Greenport
};

const MNR_ROUTE_COLORS: Record<string, {color: string; textColor: string}> = {
  '1': {color: '#009B3A', textColor: '#FFFFFF'}, // Hudson
  '2': {color: '#0039A6', textColor: '#FFFFFF'}, // Harlem
  '3': {color: '#EE0034', textColor: '#FFFFFF'}, // New Haven
  '4': {color: '#EE0034', textColor: '#FFFFFF'}, // New Canaan
  '5': {color: '#EE0034', textColor: '#FFFFFF'}, // Danbury
  '6': {color: '#EE0034', textColor: '#FFFFFF'}, // Waterbury
};

const SEPTA_BUS_DEFAULT: {color: string; textColor: string} = {color: '#005DAA', textColor: '#FFFFFF'};
const NJT_RAIL_DEFAULT: {color: string; textColor: string} = {color: '#0039A6', textColor: '#FFFFFF'};

const PROVIDER_COLOR_OVERRIDES: Record<string, Record<string, {color: string; textColor: string}>> = {
  'mta-lirr': LIRR_ROUTE_COLORS,
  'mta-mnr': MNR_ROUTE_COLORS,
  'septa-rail': SEPTA_RAIL_COLORS,
  'septa-trolley': SEPTA_TROLLEY_COLORS,
};

/**
 * Resolve line color using provider context. Handles LIRR/MNR numeric IDs
 * that would otherwise collide with subway line numbers in the city map.
 */
export function resolveProviderLineColor(
  provider: string,
  lineId: string,
): {color: string; textColor: string} | null {
  // SEPTA bus routes are all uniform SEPTA blue — no per-route color table needed
  if (provider === 'septa-bus') return SEPTA_BUS_DEFAULT;
  if (provider === 'njt-rail') return NJT_RAIL_DEFAULT;

  const overrideMap = PROVIDER_COLOR_OVERRIDES[provider];
  if (overrideMap) {
    const result = overrideMap[lineId] ?? overrideMap[lineId.toUpperCase()];
    if (result) return result;
    // Unknown SEPTA rail/trolley routes fall back to SEPTA blue rather than hash
    if (provider === 'septa-rail' || provider === 'septa-trolley') return SEPTA_BUS_DEFAULT;
  }
  return null;
}

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
