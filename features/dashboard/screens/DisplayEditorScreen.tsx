import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {Alert, Animated, Easing, Keyboard, KeyboardAvoidingView, LayoutAnimation, Modal, PanResponder, Platform, Pressable, ScrollView, Text, TextInput, UIManager, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  State,
  type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import {colors} from '../../../theme';
import DashboardPreviewSection from '../components/DashboardPreviewSection';
import {useAppState} from '../../../state/appState';
import {CITY_BRANDS, CITY_LABELS, CITY_OPTIONS, type CityId} from '../../../constants/cities';
import type {DisplayContent, DisplayFormat, TransitStationLine} from '../../../types/transit';
import type {Display3DSlot} from '../components/Display3DPreview';
import {apiFetch} from '../../../lib/api';
import {queryKeys} from '../../../lib/queryKeys';
import type {
  ModeId,
  TransitRouteGroup as RouteGroup,
  TransitRoutePickerItem as RoutePickerItem,
  TransitRouteRecord as Route,
  UiDirection as Direction,
} from '../../../lib/transit/frontendTypes';
import {
  deserializeUiDirection,
  getDefaultUiDirection,
  getDirectionTerminalDisplayLabel,
  getLocalDirectionRequestId,
  getLocalDirectionLabel,
  getLocalDirectionOptions,
  getLocalDirectionTerminal,
  getLocalLineLabel,
  getLocalRouteBadgeLabel,
  isRailLinePreviewMode,
  serializeUiDirection,
} from '../../../lib/transitUi';
import {
  createDisplay,
  fetchDisplay,
  fetchDisplays,
  updateDisplay,
  validateDisplayDraft,
  type DeviceDisplay,
  type DisplaySavePayload,
} from '../../../lib/displays';
import {useAuth} from '../../../state/authProvider';
import {useSelectedDevice} from '../../../hooks/useSelectedDevice';
import {
  areSameLinePicks,
  buildNextArrivalTimes,
  buildRouteGroups,
  cityModeFromSavedLine,
  clampNextStops,
  ensureLineCount,
  formatRoutePickerLabel,
  getAvailableModes,
  getModeLabel,
  isExpressRouteBadge,
  isExpressVariant,
  isLiveCitySupported,
  isNycBusBadge,
  loadArrivalForSelection,
  loadGlobalLinesForCityMode,
  loadRoutesForStation,
  loadStationsForCityMode,
  loadStopsForLine,
  mergeArrivals,
  normalizeCityIdParam,
  normalizeDisplayFormat,
  normalizeLine,
  normalizeMode,
  normalizePrimaryContent,
  normalizeSavedStationId,
  normalizeSecondaryContent,
  prepareRouteEntriesForPicker,
  resolveBackendProvider,
  resolveBackendProviderMode,
  resolveDisplayContent,
  resolveSelectedStationForLine,
  routeLookupKey,
  stopLookupKey,
  syncArrivals,
} from './DashboardEditor.helpers';
import {styles} from './DisplayEditor.styles';

type Station = {id: string; name: string; area: string; lines: TransitStationLine[]};
type Arrival = {lineId: string; minutes: number; status: 'GOOD' | 'DELAYS'; destination: string | null};
type LinePick = {
  id: string;
  mode: ModeId;
  stationId: string;
  routeId: string;
  direction: Direction;
  patternId?: string;
  scrolling: boolean;
  label: string;
  secondaryLabel: string;
  textColor: string;
  nextStops: number;
  displayFormat: DisplayFormat;
  primaryContent: DisplayContent;
  secondaryContent: DisplayContent;
};
type StationsByMode = Partial<Record<ModeId, Station[]>>;
type RoutesByStation = Record<string, Route[]>;
type EditorStep = 'city' | 'service' | 'format' | 'lines' | 'stops' | 'done';
type WizardStepDef = {id: EditorStep; label: string; complete: boolean; reachable: boolean};
type SelectionSheetOption = {id: string; label: string; description?: string};

const DEFAULT_TEXT_COLOR = '#FFFFFF';
const BOROUGH_ORDER = ['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island'];
const DEFAULT_NEXT_STOPS = 3;
const MIN_NEXT_STOPS = 1;
const MAX_NEXT_STOPS = 5;
const DEFAULT_LAYOUT_SLOTS = 1;
const MAX_LAYOUT_SLOTS = 6;
const DEFAULT_DISPLAY_PRESET = 1;
const DEFAULT_BRIGHTNESS = 40;
const MIN_BRIGHTNESS = 10;
const MAX_BRIGHTNESS = 100;
const MIN_STEP_SWIPE_DISTANCE = 56;
const LAYOUT_OPTIONS = Array.from({length: MAX_LAYOUT_SLOTS}, (_, index) => {
  const slots = index + 1
  return {
    id: `layout-${slots}`,
    slots,
    label: `${slots} ${slots === 1 ? 'line' : 'lines'}`,
  }
})
const lineSlotId = (index: number) => `line-${index + 1}`
const withHexAlpha = (color: string, alpha: string) => (/^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color);
const getCityAgencyPillPalette = (city: CityId) => {
  const brand = CITY_BRANDS[city];

  return {
    borderColor: brand.accent,
    textColor: brand.accent,
    backgroundColor: withHexAlpha(brand.accent, '12'),
  };
};

const getMockStopName = (city: CityId, mode: ModeId) => {
  if (city === 'chicago' && mode === 'train') return 'Clark/Lake';
  if (city === 'boston' && mode === 'train') return 'Park Street';
  if (city === 'boston' && mode === 'commuter-rail') return 'Back Bay';
  if (city === 'philadelphia' && mode === 'train') return '30th Street Station';
  if (city === 'philadelphia' && mode === 'trolley') return '13th St';
  if (city === 'philadelphia' && mode === 'bus') return '69th St TC';
  if (city === 'new-jersey' && mode === 'train') return 'Secaucus Junction';
  if (city === 'new-jersey' && mode === 'bus') return 'Newark Penn Station';
  return 'Times Sq–42 St';
};

const getBlankLine = (
  city: CityId,
  index: number,
  stationsByMode: StationsByMode,
  routesByStation: RoutesByStation,
): LinePick => {
  const seeded = ensureLineCount([], city, index + 1, stationsByMode, routesByStation)[index]
  const base = seeded ?? ensureLineCount([], city, 1, stationsByMode, routesByStation)[0]
  return normalizeLine(
    city,
    {
      ...(base ?? {
        id: lineSlotId(index),
        mode: 'train' as ModeId,
        stationId: '',
        routeId: '',
        direction: 'uptown' as Direction,
        patternId: '',
        scrolling: false,
        label: '',
        secondaryLabel: '',
        textColor: DEFAULT_TEXT_COLOR,
        nextStops: DEFAULT_NEXT_STOPS,
        displayFormat: 'single-line' as DisplayFormat,
        primaryContent: 'destination' as DisplayContent,
        secondaryContent: 'direction' as DisplayContent,
      }),
      id: lineSlotId(index),
      routeId: '',
      stationId: '',
      patternId: '',
      scrolling: false,
      label: '',
      secondaryLabel: '',
      primaryContent: 'destination',
      secondaryContent: 'direction',
    },
    stationsByMode,
    routesByStation,
  )
}

const resolveRouteForLine = (
  city: CityId,
  line: Pick<LinePick, 'mode' | 'stationId' | 'routeId'>,
  routesByStation: RoutesByStation,
  linesByMode: Partial<Record<ModeId, Route[]>>,
) => {
  const mode = normalizeMode(city, line.mode);
  return (routesByStation[routeLookupKey(mode, line.stationId)] ?? []).find(route => route.id === line.routeId)
    ?? (linesByMode[mode] ?? []).find(route => route.id === line.routeId);
};

const getDefaultPatternForRoute = (route: Route | undefined) => route?.patterns?.[0];

const getSelectedPatternForLine = (route: Route | undefined, line: Pick<LinePick, 'patternId'>) =>
  route?.patterns?.find(pattern => pattern.id === line.patternId) ?? getDefaultPatternForRoute(route);

const stopLookupTokenForLine = (
  city: CityId,
  mode: ModeId,
  line: Pick<LinePick, 'direction' | 'patternId'>,
  route?: Route | string,
) => {
  const selectedPattern = route && typeof route !== 'string' ? getSelectedPatternForLine(route, line) : undefined;
  return selectedPattern?.id || line.patternId || getLocalDirectionRequestId(city, mode, line.direction, route) || '';
};

const DISPLAY_PRESET_OPTIONS = [
  {id: 1, label: 'Your Station', description: 'The selected station on the left, next arrival on the right.'},
  {id: 2, label: 'Direction', description: 'Uptown or Downtown on the left, next arrival on the right.'},
  {id: 3, label: 'Destination', description: 'Route destination on the left, next arrival on the right.'},
  {id: 4, label: 'Your Station + Upcoming Trains', description: 'Selected station with upcoming arrivals.'},
  {id: 5, label: 'Direction + Upcoming Trains', description: 'Travel direction with upcoming arrivals.'},
  {id: 6, label: 'Destination + Upcoming Trains', description: 'Route destination with upcoming arrivals.'},
] as const;
const Haptics = {selectionAsync: async () => {}, notificationAsync: async (_: any) => {}};

const isNewYorkRailDestinationOnlyMode = (city: CityId, mode: ModeId) =>
  city === 'new-york' && (mode === 'lirr' || mode === 'mnr');

const getDisplayPresetOptionsForMode = (city: CityId, mode: ModeId) =>
  (city === 'chicago' || isNewYorkRailDestinationOnlyMode(city, mode))
    ? DISPLAY_PRESET_OPTIONS.filter(option => option.id !== 2 && option.id !== 5)
    : DISPLAY_PRESET_OPTIONS;

const getPresetDescriptionForMode = (
  city: CityId,
  mode: ModeId,
  presetId: number,
  defaultDescription: string,
) => {
  if (city === 'new-york' && mode === 'bus') {
    if (presetId === 2) return 'Trip destination on the left, next arrival on the right.';
    if (presetId === 5) return 'Trip destination with upcoming arrivals.';
  }
  if (city === 'new-york' && mode === 'mnr') {
    if (presetId === 2) return 'Inbound or Outbound terminal on the left, next arrival on the right.';
    if (presetId === 5) return 'Inbound or Outbound terminal with upcoming arrivals.';
  }
  if (city === 'chicago' && mode === 'train') {
    if (presetId === 2) return 'Terminal-bound direction on the left, next arrival on the right.';
    if (presetId === 5) return 'Terminal-bound direction with upcoming arrivals.';
  }
  if (city === 'chicago' && mode === 'bus') {
    if (presetId === 2) return 'Trip destination on the left, next arrival on the right.';
    if (presetId === 5) return 'Trip destination with upcoming arrivals.';
  }
  if (city === 'philadelphia' && mode === 'train') {
    if (presetId === 2) return 'Inbound or Outbound on the left, next arrival on the right.';
    if (presetId === 5) return 'Inbound or Outbound with upcoming arrivals.';
  }
  if (city === 'philadelphia' && (mode === 'bus' || mode === 'trolley')) {
    if (presetId === 2) return 'Trip destination on the left, next arrival on the right.';
    if (presetId === 5) return 'Trip destination with upcoming arrivals.';
  }
  if (city === 'new-jersey' && mode === 'train') {
    if (presetId === 2) return 'Trip destination on the left, next arrival on the right.';
    if (presetId === 5) return 'Trip destination with upcoming arrivals.';
  }
  return defaultDescription;
};

const formatSaveErrorMessage = (message: string) => {
  const normalized = message.trim();
  if (!normalized) return 'Unable to save this display right now. Please try again.';

  const lowered = normalized.toLowerCase();
  if (lowered.includes('network') || lowered.includes('fetch') || lowered.includes('failed to fetch')) {
    return 'We could not reach the server. Check your connection and try again.';
  }
  if (lowered.includes('timeout')) {
    return 'Saving took too long. Please try again.';
  }
  if (lowered.includes('401') || lowered.includes('403') || lowered.includes('unauthorized')) {
    return 'You do not have permission to save this display right now.';
  }
  if (lowered.includes('404')) {
    return 'The selected device or display could not be found.';
  }
  if (lowered.includes('409')) {
    return 'This display changed elsewhere. Refresh and try saving again.';
  }
  if (lowered.includes('500') || lowered.includes('502') || lowered.includes('503')) {
    return 'The server had trouble saving your display. Please try again.';
  }

  return normalized;
};

const getPresetBehavior = (presetId: number) => {
  switch (presetId) {
    case 2:
      return {displayFormat: 'single-line' as DisplayFormat, primaryContent: 'direction' as DisplayContent, secondaryContent: 'direction' as DisplayContent, supportsBottomCustom: false};
    case 3:
      return {displayFormat: 'single-line' as DisplayFormat, primaryContent: 'headsign' as DisplayContent, secondaryContent: 'headsign' as DisplayContent, supportsBottomCustom: false};
    case 4:
      return {displayFormat: 'times-line' as DisplayFormat, primaryContent: 'destination' as DisplayContent, secondaryContent: 'direction' as DisplayContent, supportsBottomCustom: false};
    case 5:
      return {displayFormat: 'times-line' as DisplayFormat, primaryContent: 'direction' as DisplayContent, secondaryContent: 'direction' as DisplayContent, supportsBottomCustom: false};
    case 6:
      return {displayFormat: 'times-line' as DisplayFormat, primaryContent: 'headsign' as DisplayContent, secondaryContent: 'headsign' as DisplayContent, supportsBottomCustom: false};
    case 1:
    default:
      return {displayFormat: 'single-line' as DisplayFormat, primaryContent: 'destination' as DisplayContent, secondaryContent: 'direction' as DisplayContent, supportsBottomCustom: false};
  }
};

const getPersistedDisplayType = (presetId: number) => {
  switch (presetId) {
    case 2:
      return 2;
    case 3:
      return 1;
    case 4:
      return 4;
    case 5:
      return 5;
    case 6:
      return 4;
    case 1:
    default:
      return 1;
  }
};

const getPersistedArrivalsToDisplay = (
  lines: Array<{displayFormat?: string; nextStops?: number}>,
) => {
  let maxCount = 1;
  for (const line of lines) {
    const count =
      line.displayFormat === 'times-line'
        ? Math.max(MIN_NEXT_STOPS, Math.min(3, Math.trunc(line.nextStops || DEFAULT_NEXT_STOPS)))
        : 1;
    if (count > maxCount) maxCount = count;
  }
  return maxCount;
};

const getDisplayPresetFromPersistedType = (displayType: number) => {
  switch (displayType) {
    case 2:
      return 2;
    case 4:
      return 4;
    case 5:
      return 5;
    case 1:
    case 3:
    default:
      return 1;
  }
};

const inferDisplayPreset = (
  line: Pick<LinePick, 'displayFormat' | 'primaryContent' | 'secondaryContent'>,
  fallbackPreset = DEFAULT_DISPLAY_PRESET,
) => {
  if (line.displayFormat === 'two-line') {
    return line.secondaryContent === 'headsign' ? 3 : 1;
  }
  if (line.displayFormat === 'times-line') {
    if (line.primaryContent === 'headsign') return 6;
    return line.primaryContent === 'direction' ? 5 : 4;
  }
  if (line.primaryContent === 'headsign') return 3;
  if (line.primaryContent === 'direction') return 2;
  return fallbackPreset;
};

const isNycRailMode = (mode: ModeId) => mode === 'lirr' || mode === 'mnr';

const trimRouteHeadsign = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
};

const getRouteId = (route: Route | string | undefined) => (typeof route === 'string' ? route : route?.id);

const getRouteHeadsign = (
  city: CityId,
  mode: ModeId,
  route: Route | string | undefined,
  direction: Direction,
) => {
  if (!route || typeof route === 'string') return null;
  const metadataTerminal = getLocalDirectionTerminal(route, direction);
  if (metadataTerminal) return trimRouteHeadsign(metadataTerminal);
  if (city === 'new-york') return null;
  const useHeadsign1 =
    direction === 'downtown' || direction === 'dir1' || direction === 'westbound' || direction === 'inbound';
  return trimRouteHeadsign(useHeadsign1 ? route.headsign1 : route.headsign0);
};

const getDirectionCueLabel = (
  city: CityId,
  mode: ModeId,
  direction: Direction,
  route?: Route | string,
) => {
  return getLocalDirectionLabel(city, mode, direction, route, 'bound');
};

const getHeadsignLabel = (
  city: CityId,
  mode: ModeId,
  direction: Direction,
  route?: Route | string,
  routeLabel = '',
) => {
  const headsign = getRouteHeadsign(city, mode, route, direction);
  if (headsign) return headsign;
  if (city === 'new-york') return '--';
  if (isRailLinePreviewMode(city, mode)) {
    const routeId = getRouteId(route);
    const safeRouteLabel =
      typeof route === 'string'
        ? routeLabel || route
        : route?.label?.trim() || routeLabel || routeId || 'Route';
    return getRailPreviewRouteLabel(city, mode, safeRouteLabel, routeId);
  }
  return getDirectionCueLabel(city, mode, direction, route);
};

const getSignedDirectionLabel = (
  city: CityId,
  mode: ModeId,
  direction: Direction,
  route?: Route | string,
) => {
  const summaryLabel = getLocalDirectionLabel(city, mode, direction, route, 'summary');
  if (summaryLabel) return summaryLabel;
  const cue = getDirectionCueLabel(city, mode, direction, route);
  const headsign = getRouteHeadsign(city, mode, route, direction);
  if (!headsign) return cue;
  return `${cue} · ${headsign}`;
};

const getDirectionLabel = (
  city: CityId,
  mode: ModeId,
  direction: Direction,
  route?: Route | string,
) => getDirectionCueLabel(city, mode, direction, route);

const getDirectionToggleLabel = (
  city: CityId,
  mode: ModeId,
  direction: Direction,
  route?: Route | string,
) => {
  const cue = getDirectionCueLabel(city, mode, direction, route);
  const headsign = getRouteHeadsign(city, mode, route, direction);
  return `${cue}: ${headsign ?? 'Not Found'}`;
};

const getDirectionSummaryLabel = (city: CityId, mode: ModeId, direction: Direction, route?: Route | string) => {
  return getSignedDirectionLabel(city, mode, direction, route);
};

const getRailPreviewRouteLabel = (city: CityId, mode: ModeId, routeLabel: string, routeId?: string) => {
  const trimmed = routeLabel.trim();
  if (!trimmed && !routeId) return 'Route';
  return getLocalLineLabel(city, mode, routeId ?? trimmed, trimmed || (routeId ?? 'Route'));
};

const getPresetLabelForMode = (_city: CityId, _mode: ModeId, _presetId: number, defaultLabel: string) => defaultLabel;

const getWizardStepDefs = ({
  step,
  includeCityStep,
  hasLine,
  hasStop,
  hasPreset,
  isLirr,
}: {
  step: EditorStep;
  includeCityStep: boolean;
  hasLine: boolean;
  hasStop: boolean;
  hasPreset: boolean;
  isLirr: boolean;
}): WizardStepDef[] => [
  ...(includeCityStep
    ? [{id: 'city' as const, label: 'City', complete: step !== 'city', reachable: true}]
    : []),
  {id: 'service', label: 'Service', complete: step !== 'service' && step !== 'city', reachable: true},
  {id: 'lines', label: isLirr ? 'Branch' : 'Line', complete: hasLine, reachable: true},
  {id: 'stops', label: isLirr ? 'Station' : 'Stop', complete: hasStop, reachable: hasLine},
  {id: 'format', label: 'Style', complete: hasPreset, reachable: hasLine && hasStop},
  {id: 'done', label: 'Save', complete: false, reachable: hasLine && hasStop && hasPreset},
];

const WIZARD_STEP_DEFAULT_COLOR = colors.accent;
const WIZARD_STEP_ACTIVE_COLOR = colors.accent;

export default function DisplayEditorScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const {state: appState, setPreset, setSelectedStations, setArrivals: setAppArrivals, setSelectedCity} = useAppState();
  const params = useLocalSearchParams<{city?: string; from?: string; mode?: string; displayId?: string}>();
  const initialCity = normalizeCityIdParam(params.city ?? appState.selectedCity);
  const isCreateMode = params.mode === 'new';
  const [editorCity, setEditorCity] = useState<CityId>(initialCity);
  const city = editorCity;
  const fallbackRoute = '/dashboard';
  const headerEnter = useRef(new Animated.Value(0)).current;
  const previewEnter = useRef(new Animated.Value(0)).current;
  const editorEnter = useRef(new Animated.Value(0)).current;
  const liveSupported = isLiveCitySupported(city);
  const {deviceId, deviceIds, setDeviceId} = useAuth();
  const selectedDevice = useSelectedDevice();
  const hasLinkedDevice = deviceIds.length > 0;
  const [layoutSlots, setLayoutSlots] = useState<number>(DEFAULT_LAYOUT_SLOTS);
  const [displayPresetsByLine, setDisplayPresetsByLine] = useState<Record<string, number>>({});
  const [lines, setLines] = useState<LinePick[]>(() => ensureLineCount([], city, DEFAULT_LAYOUT_SLOTS, {}, {}));
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [stationSearch, setStationSearch] = useState<Record<string, string>>({});
  const [presetName, setPresetName] = useState('Display 1');
  const [editingDisplayId, setEditingDisplayId] = useState<string | null>(
    typeof params.displayId === 'string' ? params.displayId : null,
  );
  const [displayMetadata, setDisplayMetadata] = useState({paused: false, priority: 0, sortOrder: 0, scrolling: false, brightness: DEFAULT_BRIGHTNESS});
  const [saving, setSaving] = useState(false);
  const [saveDone, setSaveDone] = useState(false);
  const [previewDragging, setPreviewDragging] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showLayoutSelector, setShowLayoutSelector] = useState(false);
  const [stationsByMode, setStationsByMode] = useState<StationsByMode>({});
  const [stationsLoadingByMode, setStationsLoadingByMode] = useState<Partial<Record<ModeId, boolean>>>({});
  const [stationsByLine, setStationsByLine] = useState<Partial<Record<string, Station[]>>>({});
  const [stationsLoadingByLine, setStationsLoadingByLine] = useState<Partial<Record<string, boolean>>>({});
  const [routesByStation, setRoutesByStation] = useState<RoutesByStation>({});
  const [routesLoadingByStation, setRoutesLoadingByStation] = useState<Record<string, boolean>>({});
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [liveStatusText, setLiveStatusText] = useState('');
  const [editorStep, setEditorStep] = useState<EditorStep>(isCreateMode ? 'city' : 'done');
  // Tracks the style the user is hovering/previewing in Step 3 (format) before confirming
  const [liveStylePreview, setLiveStylePreview] = useState<number | null>(null);
  const [linesByMode, setLinesByMode] = useState<Partial<Record<ModeId, Route[]>>>({});
  const [linesLoadingByMode, setLinesLoadingByMode] = useState<Partial<Record<ModeId, boolean>>>({});
  const stepAnim = useRef(new Animated.Value(1)).current;
  const linesRequestedRef = useRef(new Set<string>());
  const stationsRequestedRef = useRef(new Set<string>());
  const routesRequestedRef = useRef(new Set<string>());
  const previousCityRef = useRef(city);
  const selectedDisplayPreset = displayPresetsByLine[selectedLineId] ?? DEFAULT_DISPLAY_PRESET;
  const selectedLinePresetConfirmed = selectedLineId in displayPresetsByLine;
  const allLinesPresetConfirmed = lines.every(line => line.id in displayPresetsByLine);
  // When the user is browsing styles in Step 3, reflect that in the fixed preview
  const liveDisplayType = editorStep === 'format' && liveStylePreview !== null ? liveStylePreview : selectedDisplayPreset;
  const animateSectionLayout = () => {
    LayoutAnimation.configureNext({
      duration: 180,
      create: {type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity},
      update: {type: LayoutAnimation.Types.easeInEaseOut},
      delete: {type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity},
    });
  };

  const handleCitySelect = (nextCity: CityId) => {
    if (nextCity !== city) {
      setEditorCity(nextCity);
      setDisplayPresetsByLine({});
      setSelectedLineId('');
      setLiveStylePreview(null);
    }
    setSelectedCity(nextCity);
    setEditorStep('service');
  };

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    const keyboardShowEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const keyboardHideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const animateKeyboardChange = () => {
      LayoutAnimation.configureNext({
        duration: 180,
        create: {type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity},
        update: {type: LayoutAnimation.Types.easeInEaseOut},
        delete: {type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity},
      });
    };

    const showSub = Keyboard.addListener(keyboardShowEvent, animateKeyboardChange);
    const hideSub = Keyboard.addListener(keyboardHideEvent, animateKeyboardChange);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const cityChanged = previousCityRef.current !== city;
    previousCityRef.current = city;
    if (!cityChanged) return;
    setStationsByMode({});
    setStationsLoadingByMode({});
    setStationsByLine({});
    setStationsLoadingByLine({});
    setRoutesByStation({});
    setRoutesLoadingByStation({});
    setStationSearch({});
    setLiveStatusText('');
    setArrivals([]);
    setLinesByMode({});
    setLinesLoadingByMode({});
    linesRequestedRef.current.clear();
    stationsRequestedRef.current.clear();
    routesRequestedRef.current.clear();
    setLines(() => ensureLineCount([], city, layoutSlots, {}, {}));
  }, [city, layoutSlots]);

  useEffect(() => {
    setLines(prev => {
      const normalized = ensureLineCount(prev, city, layoutSlots, stationsByMode, routesByStation);
      return areSameLinePicks(prev, normalized) ? prev : normalized;
    });
  }, [city, layoutSlots, routesByStation, stationsByMode]);

  useEffect(() => {
    setDisplayPresetsByLine(prev => {
      const next: Record<string, number> = {};
      lines.forEach(line => {
        if (line.id in prev) {
          next[line.id] = prev[line.id];
        }
      });
      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });
  }, [lines]);

  useEffect(() => {
    if (!liveSupported) return;
    const requestedModes = [...new Set(lines.map(line => normalizeMode(city, line.mode)))]
      .filter(mode => !(city === 'chicago' && mode === 'train'));
    requestedModes.forEach(mode => {
      const key = `${city}:${mode}`;
      if (stationsRequestedRef.current.has(key)) return;
      stationsRequestedRef.current.add(key);
      setStationsLoadingByMode(prev => ({...prev, [mode]: true}));
      void queryClient.fetchQuery({
        queryKey: queryKeys.transitStations(city, mode),
        queryFn: () => loadStationsForCityMode(city, mode),
      })
        .then(stations => {
          setStationsByMode(prev => ({...prev, [mode]: stations}));
        })
        .catch(() => {
          setLiveStatusText('Unable to load stops right now.');
          setStationsByMode(prev => ({...prev, [mode]: []}));
        })
        .finally(() => {
          setStationsLoadingByMode(prev => ({...prev, [mode]: false}));
        });
    });
  }, [city, lines, liveSupported, queryClient]); // stationsRequestedRef guards against duplicates

  useEffect(() => {
    if (!liveSupported) return;
    const uniqueModes = [...new Set(lines.map(line => normalizeMode(city, line.mode)))];
    uniqueModes.forEach(mode => {
      const key = `${city}:${mode}`;
      if (linesRequestedRef.current.has(key)) return;
      linesRequestedRef.current.add(key);
      setLinesLoadingByMode(prev => ({...prev, [mode]: true}));
      void queryClient.fetchQuery({
        queryKey: queryKeys.transitGlobalLines(city, mode),
        queryFn: () => loadGlobalLinesForCityMode(city, mode),
      })
        .then(routes => {
          setLinesByMode(prev => ({...prev, [mode]: routes}));
        })
        .catch(() => {
          setLinesByMode(prev => ({...prev, [mode]: []}));
        })
        .finally(() => {
          setLinesLoadingByMode(prev => ({...prev, [mode]: false}));
        });
    });
  }, [city, lines, liveSupported, queryClient]); // linesRequestedRef guards against duplicates — no cancellation needed

  const selectedLine = lines.find(line => line.id === selectedLineId) ?? null;
  const activeWizardLine = selectedLine ?? lines[0] ?? null;

  useEffect(() => {
    if (!liveSupported) return;
    const pending = lines
      .flatMap(line => {
        const mode = normalizeMode(city, line.mode);
        const route = resolveRouteForLine(city, line, routesByStation, linesByMode);
        const selectedPattern = getSelectedPatternForLine(route, line);
        if (city === 'chicago' && mode === 'train') {
          if (!selectedPattern) return [];
          return [{
            mode,
            routeId: line.routeId,
            direction: selectedPattern.direction ?? getLocalDirectionRequestId(city, mode, selectedPattern.uiKey, route),
            pattern: selectedPattern.id,
          }];
        }
        const stopsToFetch =
          selectedPattern
            ? [{
              mode,
              routeId: line.routeId,
              direction: selectedPattern.direction ?? getLocalDirectionRequestId(city, mode, selectedPattern.uiKey, route),
              pattern: selectedPattern.id,
            }]
            : editorStep === 'stops' && selectedLine?.id === line.id
              ? getLocalDirectionOptions(city, mode, route).map(direction => ({
                mode,
                routeId: line.routeId,
                direction: getLocalDirectionRequestId(city, mode, direction, route),
                pattern: '',
              }))
              : [{
                mode,
                routeId: line.routeId,
                direction: getLocalDirectionRequestId(city, mode, line.direction, route),
                pattern: '',
              }];
        return stopsToFetch;
      })
      .filter(item => item.routeId.length > 0)
      .filter((item, index, items) =>
        items.findIndex(candidate =>
          candidate.mode === item.mode
          && candidate.routeId === item.routeId
          && candidate.direction === item.direction
          && candidate.pattern === item.pattern,
        ) === index,
      );

    pending.forEach(item => {
      const lookupKey = stopLookupKey(item.mode, item.routeId, item.pattern || item.direction);
      setStationsLoadingByLine(prev => ({...prev, [lookupKey]: true}));
      void queryClient.fetchQuery({
        queryKey: queryKeys.transitStopsForLine(city, item.mode, item.routeId, item.pattern || item.direction || ''),
        queryFn: () => loadStopsForLine(city, item.mode, item.routeId, item.direction, item.pattern),
      })
        .then(stations => setStationsByLine(prev => ({
          ...prev,
          [lookupKey]: stations,
        })))
        .catch(() => setStationsByLine(prev => ({
          ...prev,
          [lookupKey]: [],
        })))
        .finally(() => setStationsLoadingByLine(prev => ({...prev, [lookupKey]: false})));
    });
  }, [city, editorStep, lines, linesByMode, liveSupported, queryClient, routesByStation, selectedLine]);

  useEffect(() => {
    if (!isCreateMode || !deviceId) return;
    queryClient.fetchQuery({
      queryKey: queryKeys.displays(deviceId),
      queryFn: () => fetchDisplays(deviceId),
    })
      .then(({displays}) => {
        const names = new Set(displays.map(d => d.name));
        let n = displays.length + 1;
        while (names.has(`Display ${n}`)) n++;
        setPresetName(`Display ${n}`);
      })
      .catch(() => {});
  }, [deviceId, isCreateMode, queryClient]);

  useEffect(() => {
    if (!liveSupported) return;
    const pending = lines
      .map(line => ({mode: normalizeMode(city, line.mode), stationId: line.stationId}))
      .filter(item => item.stationId.length > 0);

    pending.forEach(item => {
      const key = routeLookupKey(item.mode, item.stationId);
      if (routesRequestedRef.current.has(key)) return;
      routesRequestedRef.current.add(key);
      setRoutesLoadingByStation(prev => ({...prev, [key]: true}));
      void queryClient.fetchQuery({
        queryKey: queryKeys.transitLinesForStation(city, item.mode, item.stationId),
        queryFn: () => loadRoutesForStation(city, item.mode, item.stationId),
      })
        .then(result => {
          const resolvedStopId = result.stopId?.trim() || item.stationId;
          const resolvedKey = routeLookupKey(item.mode, resolvedStopId);
          setRoutesByStation(prev => ({
            ...prev,
            [key]: result.routes,
            [resolvedKey]: result.routes,
          }));
          if (resolvedStopId !== item.stationId) {
            setLines(prev =>
              prev.map(line =>
                line.mode === item.mode && line.stationId === item.stationId
                  ? {...line, stationId: resolvedStopId}
                  : line,
              ),
            );
          }
        })
        .catch(() => {
          setRoutesByStation(prev => ({...prev, [key]: []}));
        })
        .finally(() => {
          setRoutesLoadingByStation(prev => ({...prev, [key]: false}));
        });
    });
  }, [city, lines, liveSupported, queryClient]); // routesRequestedRef guards against duplicates

  useEffect(() => {
    setArrivals(prev => syncArrivals(prev, lines));
  }, [lines]);

  useEffect(() => {
    if (selectedLineId || lines.length === 0) return;
    setSelectedLineId(lines[0]?.id ?? '');
  }, [lines, selectedLineId]);

  // Auto-select first linked device if none is currently selected
  useEffect(() => {
    if (!deviceId && deviceIds.length > 0) {
      setDeviceId(deviceIds[0]);
    }
  }, [deviceId, deviceIds, setDeviceId]);

  // Load saved display/config on mount and restore lines/layout/schedule metadata
  useEffect(() => {
    if (!hasLinkedDevice || !selectedDevice.id) return;
    let cancelled = false;
    (async () => {
      try {
        let sourceDisplay: any = null;

        if (editingDisplayId) {
          sourceDisplay = await queryClient.fetchQuery({
            queryKey: queryKeys.display(selectedDevice.id, editingDisplayId),
            queryFn: () => fetchDisplay(selectedDevice.id, editingDisplayId),
          });
        } else if (!isCreateMode) {
          const configResult = await queryClient.fetchQuery({
            queryKey: queryKeys.deviceConfig(selectedDevice.id),
            queryFn: async () => {
              const response = await apiFetch(`/device/${selectedDevice.id}/config`);
              const data = await response.json().catch(() => null);
              return {ok: response.ok, data};
            },
          });
          if (!configResult.ok || cancelled) return;
          sourceDisplay = configResult.data?.display ?? null;
        }
        if (!sourceDisplay || cancelled) return;

        const savedLines: Array<any> = Array.isArray(sourceDisplay?.config?.lines) ? sourceDisplay.config.lines : [];
        const savedDisplayType = Number(sourceDisplay?.config?.displayType);
        const fallbackDisplayPreset = Number.isFinite(savedDisplayType)
          ? getDisplayPresetFromPersistedType(Math.trunc(savedDisplayType))
          : DEFAULT_DISPLAY_PRESET;
        const citySavedLines = savedLines.filter((saved: any) => cityModeFromSavedLine(saved)?.city === city);
        const nextLayoutSlots = Math.max(1, Math.min(MAX_LAYOUT_SLOTS, citySavedLines.length || 1));
        let nextLines = ensureLineCount([], city, nextLayoutSlots, {}, {});

        setPresetName(typeof sourceDisplay.name === 'string' && sourceDisplay.name.trim().length > 0 ? sourceDisplay.name : 'Display 1');
        setDisplayMetadata({
          paused: sourceDisplay.paused === true,
          priority: Number.isInteger(sourceDisplay.priority) ? sourceDisplay.priority : 0,
          sortOrder: Number.isInteger(sourceDisplay.sortOrder) ? sourceDisplay.sortOrder : 0,
          scrolling: sourceDisplay.config?.scrolling === true,
          brightness: Number.isFinite(Number(sourceDisplay.config?.brightness))
            ? Math.max(MIN_BRIGHTNESS, Math.min(MAX_BRIGHTNESS, Math.trunc(Number(sourceDisplay.config?.brightness))))
            : DEFAULT_BRIGHTNESS,
        });

        if (!cancelled) {
          setLayoutSlots(nextLayoutSlots);
        }

        if (citySavedLines.length > 0) {
          const restoredLines: LinePick[] = citySavedLines.slice(0, MAX_LAYOUT_SLOTS).map((saved: any, i: number) => {
            const displayFormat = normalizeDisplayFormat(saved.displayFormat);
            const mapping = cityModeFromSavedLine(saved);
            const mode: ModeId = mapping?.mode ?? 'train';
            const savedProvider = typeof saved.provider === 'string' ? saved.provider.trim().toLowerCase() : '';
            const savedProviderMode = typeof saved.providerMode === 'string' ? saved.providerMode.trim().toLowerCase() : '';
            const isSavedNjtRail = savedProvider === 'njt-rail' || savedProviderMode === 'njt/rail';
            const savedLine = typeof saved.line === 'string' ? saved.line.trim() : '';
            const savedShortName = typeof saved.shortName === 'string' ? saved.shortName.trim() : '';
            const normalizedSavedStop = typeof saved.stop === 'string' ? saved.stop.trim().toUpperCase() : '';
            const dir: Direction = deserializeUiDirection(
              city,
              mode,
              typeof saved.direction === 'string' ? saved.direction : undefined,
              normalizedSavedStop,
            );
            return {
              id: `line-${i + 1}`,
              mode,
              stationId: normalizeSavedStationId(saved.provider, normalizedSavedStop),
              routeId: isSavedNjtRail ? savedLine || savedShortName : savedShortName || savedLine,
              direction: dir,
              patternId: typeof saved.patternId === 'string' ? saved.patternId.trim() : '',
              scrolling: saved.scrolling === true || (saved.scrolling === undefined && sourceDisplay.config?.scrolling === true),
              label: typeof saved.label === 'string' ? saved.label : typeof saved.topText === 'string' ? saved.topText : '',
              secondaryLabel:
                typeof saved.secondaryLabel === 'string'
                  ? saved.secondaryLabel
                  : typeof saved.bottomText === 'string'
                    ? saved.bottomText
                    : '',
              textColor: typeof saved.textColor === 'string' && saved.textColor.trim().length > 0 ? saved.textColor : DEFAULT_TEXT_COLOR,
              nextStops: typeof saved.nextStops === 'number' ? clampNextStops(saved.nextStops) : DEFAULT_NEXT_STOPS,
              displayFormat,
              primaryContent: normalizePrimaryContent(
                displayFormat,
                typeof saved.primaryContent === 'string' ? (saved.primaryContent as DisplayContent) : 'destination',
                displayFormat,
              ),
              secondaryContent: normalizeSecondaryContent(
                displayFormat,
                typeof saved.secondaryContent === 'string' ? (saved.secondaryContent as DisplayContent) : 'direction',
                displayFormat,
              ),
            };
          });
          nextLines = ensureLineCount(restoredLines, city, nextLayoutSlots, {}, {});
        }

        if (!cancelled) {
          const nextPresetName =
            typeof sourceDisplay.name === 'string' && sourceDisplay.name.trim().length > 0
              ? sourceDisplay.name
              : 'Display 1';
          setLines(nextLines);
          setPresetName(nextPresetName);
          const nextDisplayPresets = nextLines.reduce<Record<string, number>>((acc, line, index) => {
            const savedLine = citySavedLines[index];
            const lineDisplayType = Number(savedLine?.displayType);
            const lineFallbackPreset = Number.isFinite(lineDisplayType)
              ? getDisplayPresetFromPersistedType(Math.trunc(lineDisplayType))
              : fallbackDisplayPreset;
            acc[line.id] = inferDisplayPreset(line, lineFallbackPreset);
            return acc;
          }, {});
          setDisplayPresetsByLine(nextDisplayPresets);
          snapshotRef.current = {
            city,
            layoutSlots: nextLayoutSlots,
            displayPresetsByLine: nextDisplayPresets,
            lines: nextLines,
            presetName: nextPresetName,
            scrolling: sourceDisplay.config?.scrolling === true,
            brightness: Number.isFinite(Number(sourceDisplay.config?.brightness))
              ? Math.max(MIN_BRIGHTNESS, Math.min(MAX_BRIGHTNESS, Math.trunc(Number(sourceDisplay.config?.brightness))))
              : DEFAULT_BRIGHTNESS,
          };
        }
      } catch {
        // Silent — user configures from scratch if load fails
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [city, editingDisplayId, hasLinkedDevice, isCreateMode, queryClient, selectedDevice.id]);

  const activeLiveSelections = useMemo(
    () =>
      lines.filter(line => {
        if (!line.stationId.trim() || !line.routeId.trim()) return false;
        const normalizedMode = normalizeMode(city, line.mode);
        const resolvedStation = resolveSelectedStationForLine(
          line,
          city,
          stationsByMode,
          stationsByLine,
        );
        if (!resolvedStation) return false;
        const stationRoutes = routesByStation[routeLookupKey(normalizedMode, resolvedStation.id)] ?? [];
        return stationRoutes.some(route => route.id === line.routeId);
      }),
    [city, lines, routesByStation, stationsByLine, stationsByMode],
  );
  const activeSelectionKey = useMemo(
    () =>
      activeLiveSelections
        .map(line => `${line.id}:${line.mode}:${line.stationId}:${line.routeId}:${line.direction}:${line.patternId ?? ''}`)
        .join('|'),
    [activeLiveSelections],
  );

  useEffect(() => {
    if (!liveSupported || activeLiveSelections.length === 0) {
      setLiveStatusText('');
      return;
    }
    let cancelled = false;

    const pollLiveArrivals = async () => {
      try {
        const updates = await Promise.all(
          activeLiveSelections.map(async line => {
            const liveArrival = await queryClient.fetchQuery({
              queryKey: queryKeys.transitArrivalsForSelection(
                city,
                line.mode,
                line.stationId,
                line.routeId,
                serializeUiDirection(city, line.mode, line.direction),
              ),
              queryFn: () => loadArrivalForSelection(city, line),
            });
            if (!liveArrival) return null;
            return {lineId: line.id, ...liveArrival};
          }),
        );
        if (cancelled) return;
        const valid = updates.filter((item): item is Arrival => !!item);
        if (valid.length === 0) return;
        setArrivals(prev => mergeArrivals(prev, valid, lines));
        setLiveStatusText('');
      } catch {
        if (!cancelled) {
          setLiveStatusText('Unable to refresh arrivals.');
        }
      }
    };

    void pollLiveArrivals();
    const timer = setInterval(() => {
      void pollLiveArrivals();
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeSelectionKey, activeLiveSelections, city, lines, liveSupported, queryClient]);

  useEffect(() => {
    headerEnter.setValue(0);
    previewEnter.setValue(0);
    editorEnter.setValue(0);

    Animated.parallel([
      Animated.timing(headerEnter, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(70),
        Animated.timing(previewEnter, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(140),
        Animated.timing(editorEnter, {
          toValue: 1,
          duration: 340,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [editorEnter, headerEnter, previewEnter]);

  useEffect(() => {
    stepAnim.setValue(0);
    Animated.spring(stepAnim, {
      toValue: 1,
      tension: 110,
      friction: 14,
      useNativeDriver: true,
    }).start();
  }, [editorStep, selectedLineId, stepAnim]);

  const snapshotRef = useRef({
    city,
    layoutSlots,
    displayPresetsByLine,
    lines,
    presetName,
    scrolling: displayMetadata.scrolling,
    brightness: displayMetadata.brightness,
  });
  const isDirty = useMemo(() => {
    const snap = snapshotRef.current;
    return (
      snap.city !== city ||
      snap.layoutSlots !== layoutSlots ||
      JSON.stringify(snap.displayPresetsByLine) !== JSON.stringify(displayPresetsByLine) ||
      snap.presetName !== presetName ||
      snap.scrolling !== displayMetadata.scrolling ||
      snap.brightness !== displayMetadata.brightness ||
      JSON.stringify(snap.lines) !== JSON.stringify(lines)
    );
  }, [city, displayMetadata.brightness, displayMetadata.scrolling, displayPresetsByLine, layoutSlots, lines, presetName]);

  const draftPayload = useMemo(() => {
    const payloadLines = lines
      .filter(line => line.stationId && line.routeId)
      .map(line => {
        const normalizedMode = normalizeMode(city, line.mode);
        const station = resolveSelectedStationForLine(line, city, stationsByMode, stationsByLine);
        const route =
          (routesByStation[routeLookupKey(normalizedMode, line.stationId)] ?? []).find(item => item.id === line.routeId) ??
          (linesByMode[normalizedMode] ?? []).find(item => item.id === line.routeId);
        const direction = serializeUiDirection(city, line.mode, line.direction).trim();
        const provider = resolveBackendProvider(city, line.mode);
        const providerMode = resolveBackendProviderMode(city, line.mode);
        const selectedPreset = displayPresetsByLine[line.id] ?? inferDisplayPreset(line);
        const presetBehavior = getPresetBehavior(selectedPreset);
        const primaryContent = line.label.trim().length > 0 ? 'custom' : presetBehavior.primaryContent;
        const secondaryContent =
          presetBehavior.supportsBottomCustom && line.secondaryLabel.trim().length > 0
            ? 'custom'
            : presetBehavior.secondaryContent;
        const persistedRouteId =
          city === 'new-jersey' && normalizedMode === 'train'
            ? route?.shortName?.trim() || line.routeId
            : line.routeId;
        const selectedPattern = getSelectedPatternForLine(route, line);

        return {
          ...(direction ? {direction} : {}),
          ...(selectedPattern ? {patternId: selectedPattern.id, patternLabel: selectedPattern.label} : {}),
          provider,
          providerMode,
          line: persistedRouteId,
          shortName: route?.shortName ?? undefined,
          stop: line.stationId,
          stopName: station?.name ?? undefined,
          headsign0: route?.headsign0 ?? undefined,
          headsign1: route?.headsign1 ?? undefined,
          directions: route?.directions ?? undefined,
          displayType: getPersistedDisplayType(selectedPreset),
          scrolling: line.scrolling,
          label: line.label.trim() || undefined,
          secondaryLabel: line.secondaryLabel.trim() || undefined,
          textColor: line.textColor || undefined,
          nextStops: presetBehavior.displayFormat === 'times-line' ? line.nextStops : undefined,
          displayFormat: presetBehavior.displayFormat,
          primaryContent,
          secondaryContent: presetBehavior.displayFormat === 'two-line' ? secondaryContent : undefined,
        };
      });

    return {
      name: presetName.trim() || 'Display 1',
      paused: displayMetadata.paused,
      priority: displayMetadata.priority,
      sortOrder: displayMetadata.sortOrder,
      scheduleStart: null,
      scheduleEnd: null,
      scheduleDays: [],
      config: {
        brightness: displayMetadata.brightness,
        displayType: getPersistedDisplayType(displayPresetsByLine['line-1'] ?? DEFAULT_DISPLAY_PRESET),
        scrolling: displayMetadata.scrolling,
        arrivalsToDisplay: getPersistedArrivalsToDisplay(payloadLines),
        lines: payloadLines,
      },
    };
  }, [city, displayMetadata.brightness, displayMetadata.paused, displayMetadata.priority, displayMetadata.scrolling, displayMetadata.sortOrder, displayPresetsByLine, lines, linesByMode, presetName, routesByStation, stationsByLine, stationsByMode]);

  const displayValidationError = useMemo(() => validateDisplayDraft(draftPayload), [draftPayload]);
  const canAutoConfirmCurrentPreset =
    editorStep === 'format'
    && !!selectedLineId
    && !!selectedLine?.routeId
    && !!selectedLine?.stationId;
  const saveDisplayPresetsByLine = useMemo(
    () =>
      canAutoConfirmCurrentPreset && !(selectedLineId in displayPresetsByLine)
        ? {
            ...displayPresetsByLine,
            [selectedLineId]: selectedDisplayPreset,
          }
        : displayPresetsByLine,
    [canAutoConfirmCurrentPreset, displayPresetsByLine, selectedDisplayPreset, selectedLineId],
  );
  const saveDraftPayload = useMemo(
    () =>
      saveDisplayPresetsByLine === displayPresetsByLine
        ? draftPayload
        : {
            ...draftPayload,
            config: {
              ...draftPayload.config,
              displayType: getPersistedDisplayType(saveDisplayPresetsByLine['line-1'] ?? DEFAULT_DISPLAY_PRESET),
            },
          },
    [displayPresetsByLine, draftPayload, saveDisplayPresetsByLine],
  );
  const saveValidationError = useMemo(() => validateDisplayDraft(saveDraftPayload), [saveDraftPayload]);
  const completedLines = useMemo(
    () => lines.filter(line => line.stationId.trim().length > 0 && line.routeId.trim().length > 0),
    [lines],
  );
  const allLinesReadyToSave = useMemo(
    () => completedLines.length === layoutSlots && completedLines.every(line => line.id in saveDisplayPresetsByLine),
    [completedLines, layoutSlots, saveDisplayPresetsByLine],
  );
  const canSaveToDevice = !!selectedDevice.id && hasLinkedDevice && allLinesReadyToSave && !saveValidationError;

  const saveDisplayMutation = useMutation({
    mutationFn: async ({
      nextDeviceId,
      nextEditingDisplayId,
      payload,
    }: {
      nextDeviceId: string;
      nextEditingDisplayId: string | null;
      payload: DisplaySavePayload;
    }) => {
      const result = nextEditingDisplayId
        ? await updateDisplay(nextDeviceId, nextEditingDisplayId, payload)
        : await createDisplay(nextDeviceId, payload);
      const nextDisplayId =
        typeof result?.displayId === 'string'
          ? result.displayId
          : typeof result?.display?.displayId === 'string'
            ? result.display.displayId
            : nextEditingDisplayId;
      await apiFetch(`/refresh/device/${nextDeviceId}`, {method: 'POST'});
      return {nextDisplayId};
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({queryKey: queryKeys.displays(variables.nextDeviceId)});
      if (variables.nextEditingDisplayId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.display(variables.nextDeviceId, variables.nextEditingDisplayId),
        });
      }
    },
  });

  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    setSaveDone(false);
    let savedDisplayId: string | null = null;

    try {
      if (!selectedDevice.id || !hasLinkedDevice) {
        setLiveStatusText('Link a device before saving.');
        setSaving(false);
        return;
      }
      if (!allLinesReadyToSave) {
        setLiveStatusText('Choose a preset before saving.');
        setSaving(false);
        return;
      }
      if (saveValidationError) {
        setLiveStatusText(saveValidationError);
        setSaving(false);
        return;
      }

      try {
        if (saveDisplayPresetsByLine !== displayPresetsByLine) {
          setDisplayPresetsByLine(saveDisplayPresetsByLine);
        }
        const cachedDisplays =
          queryClient.getQueryData<{displays: DeviceDisplay[]; activeDisplayId: string | null}>(
            queryKeys.displays(selectedDevice.id),
          ) ?? (await fetchDisplays(selectedDevice.id));
        const maxPriority = Math.max(0, ...cachedDisplays.displays.map(display => display.priority));
        const shouldKeepActivePriority =
          !!editingDisplayId && cachedDisplays.activeDisplayId === editingDisplayId;
        let payloadToSave = saveDraftPayload;
        payloadToSave = {
          ...payloadToSave,
          priority: shouldKeepActivePriority ? payloadToSave.priority : maxPriority + 1,
        };
        if (!editingDisplayId) {
          const nextSortOrder =
            cachedDisplays.displays.length > 0
              ? Math.max(...cachedDisplays.displays.map(display => display.sortOrder)) + 1
              : 0;
          payloadToSave = {
            ...payloadToSave,
            sortOrder: nextSortOrder,
          };
        }
        const result = await saveDisplayMutation.mutateAsync({
          nextDeviceId: selectedDevice.id,
          nextEditingDisplayId: editingDisplayId,
          payload: payloadToSave,
        });
        const nextDisplayId = result.nextDisplayId;
        savedDisplayId = nextDisplayId;
        if (nextDisplayId) {
          setEditingDisplayId(nextDisplayId);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Save failed';
        setLiveStatusText(formatSaveErrorMessage(msg));
        setSaving(false);
        return;
      }

      snapshotRef.current = {
        city,
        layoutSlots,
        displayPresetsByLine: saveDisplayPresetsByLine,
        lines,
        presetName,
        scrolling: displayMetadata.scrolling,
        brightness: displayMetadata.brightness,
      };
      setPreset(presetName.trim() || 'Display 1');
      setSelectedStations(
        lines
          .map(line => resolveSelectedStationForLine(line, city, stationsByMode, stationsByLine)?.name ?? line.label.trim())
          .filter(name => name.length > 0),
      );
      setAppArrivals(
        lines
          .map(line => {
            const mode = normalizeMode(city, line.mode);
            const routes = routesByStation[routeLookupKey(mode, line.stationId)] ?? [];
            const route = routes.find(item => item.id === line.routeId);
            const arrival = arrivals.find(item => item.lineId === line.id);
            const stationName = resolveSelectedStationForLine(line, city, stationsByMode, stationsByLine)?.name;
            const selectedPattern = getSelectedPatternForLine(route, line);
            const directionDestination = selectedPattern?.lastStopName ?? getRouteHeadsign(city, mode, route, line.direction);
            return {
              line: route?.label ?? line.routeId,
              destination: arrival?.destination ?? directionDestination ?? stationName ?? (line.label.trim() || 'Selected stop'),
              minutes: arrival?.minutes ?? 0,
            };
          })
          .filter(item => item.line.trim().length > 0),
      );

      setSaveDone(true);
      void Haptics.notificationAsync?.('success');
      setTimeout(() => {
        setSaveDone(false);
        if (savedDisplayId) {
          router.replace({
            pathname: '/dashboard',
            params: {focusDisplayId: savedDisplayId},
          });
          return;
        }
        router.replace('/dashboard');
      }, 1200);
    } catch {
      setLiveStatusText('We could not save this display right now. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleBackPress = () => {
    if ((router as any).canGoBack?.()) {
      router.back();
      return;
    }
    router.replace(fallbackRoute);
  };

  const handleTopBarBackPress = () => {
    if (currentWizardStepIndex > 0 && previousWizardStepId) {
      setEditorStep(previousWizardStepId);
      void Haptics.selectionAsync();
      return;
    }

    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    handleBackPress();
  };

  const applyLayout = (slots: number) => {
    animateSectionLayout();
    const safeSlots = Math.max(1, Math.min(MAX_LAYOUT_SLOTS, Math.round(slots || 1)));
    const nextLines = ensureLineCount(lines, city, safeSlots, stationsByMode, routesByStation).map((line, index) =>
      index >= layoutSlots
        ? getBlankLine(city, index, stationsByMode, routesByStation)
        : line,
    )

    if (safeSlots !== layoutSlots) {
      const allowedIds = new Set(nextLines.map(line => line.id))
      setLayoutSlots(safeSlots)
      setLines(nextLines)
      setDisplayPresetsByLine(prev =>
        Object.fromEntries(Object.entries(prev).filter(([id]) => allowedIds.has(id))),
      )
    }

    const nextSelectedLineId =
      selectedLineId && nextLines.some(line => line.id === selectedLineId)
        ? selectedLineId
        : nextLines[0]?.id ?? 'line-1'
    const nextSelectedLine = nextLines.find(line => line.id === nextSelectedLineId)

    setSelectedLineId(nextSelectedLineId)
    setEditorStep(resolveEditorStepForLine(nextSelectedLine ?? null))

    void Haptics.selectionAsync()
  };

  const addLineToLayout = () => {
    if (layoutSlots >= MAX_LAYOUT_SLOTS) return
    animateSectionLayout()
    const nextLayoutSlots = layoutSlots + 1
    const nextLines = ensureLineCount(lines, city, nextLayoutSlots, stationsByMode, routesByStation).map((line, index) =>
      index >= layoutSlots
        ? getBlankLine(city, index, stationsByMode, routesByStation)
        : line,
    )
    const nextLine = nextLines[nextLayoutSlots - 1] ?? nextLines[0]
    setLayoutSlots(nextLayoutSlots)
    setLines(nextLines)
    setSelectedLineId(nextLine?.id ?? lineSlotId(nextLayoutSlots - 1))
    setEditorStep(nextLine?.routeId ? resolveEditorStepForLine(nextLine) : 'service')
    void Haptics.selectionAsync()
  }

  const removeStopFromLayout = (id: string) => {
    if (layoutSlots < 2) return
    animateSectionLayout()
    const remaining = lines.filter(line => line.id !== id)
    const nextLines = remaining.map((line, index) =>
      normalizeLine(city, {...line, id: lineSlotId(index)}, stationsByMode, routesByStation),
    )
    const nextPresets = remaining.reduce<Record<string, number>>((acc, line, index) => {
      const preset = displayPresetsByLine[line.id]
      if (preset != null) {
        acc[lineSlotId(index)] = preset
      }
      return acc
    }, {})
    const nextSelectedLineId =
      selectedLineId === id
        ? nextLines[Math.min(nextLines.length - 1, lines.findIndex(line => line.id === id))]?.id ?? 'line-1'
        : nextLines.find(line => line.id === selectedLineId)?.id ?? nextLines[0]?.id ?? 'line-1'
    const nextSelectedLine = nextLines.find(line => line.id === nextSelectedLineId) ?? nextLines[0] ?? null

    setLayoutSlots(nextLines.length)
    setLines(nextLines)
    setDisplayPresetsByLine(nextPresets)
    setSelectedLineId(nextSelectedLineId)
    setEditorStep(resolveEditorStepForLine(nextSelectedLine))
    void Haptics.selectionAsync()
  };

  const advanceToNextSlotIfNeeded = (completedLineId: string) => {
    const completedIndex = lines.findIndex(line => line.id === completedLineId)
    if (completedIndex < 0) return false

    const nextLine = lines.slice(completedIndex + 1).find(line => !line.routeId || !line.stationId)
    if (!nextLine) return false

    setSelectedLineId(nextLine.id)
    setEditorStep(nextLine.routeId ? resolveEditorStepForLine(nextLine) : 'service')
    return true
  };

  const updateLine = (id: string, next: Partial<LinePick>) => {
    setLines(prev =>
      prev.map(line =>
        line.id === id ? normalizeLine(city, {...line, ...next}, stationsByMode, routesByStation) : line,
      ),
    );
  };

  const resolveEditorStepForLine = (line: LinePick | null): EditorStep => {
    if (!line?.routeId) return 'lines';
    if (!line.stationId) return 'stops';
    if (!(line.id in displayPresetsByLine)) return 'format';
    return 'done';
  };

  const clearLineSelection = (id: string) => {
    animateSectionLayout();
    updateLine(id, {routeId: '', stationId: '', patternId: '', scrolling: false});
    setSelectedLineId(id);
    setEditorStep('lines');
  };

  const clearStopSelection = (id: string) => {
    animateSectionLayout();
    updateLine(id, {stationId: ''});
    setSelectedLineId(id);
    setEditorStep('stops');
  };

  const clearDisplayPreset = (id: string) => {
    animateSectionLayout();
    setDisplayPresetsByLine(prev => {
      const next = {...prev};
      delete next[id];
      return next;
    });
    setSelectedLineId(id);
    setEditorStep('format');
  };

  const handleSelectSlotForEdit = (id: string) => {
    animateSectionLayout();
    const line = lines.find(l => l.id === id);
    setSelectedLineId(id);
    setEditorStep(resolveEditorStepForLine(line ?? null));
  };

  const reorderLineByHold = (id: string) => {
    setLines(prev => {
      const idx = prev.findIndex(line => line.id === id);
      if (idx === -1 || prev.length < 2) return prev;
      const target = idx === 0 ? 1 : idx - 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    void Haptics.selectionAsync();
  };

  const previewSlots = useMemo<Display3DSlot[]>(
    () =>
      lines.map(line => {
        const safeMode = normalizeMode(city, line.mode);
        const station = resolveSelectedStationForLine(line, city, stationsByMode, stationsByLine);
        const lineRoutes = routesByStation[routeLookupKey(safeMode, line.stationId)] ?? [];
        const route = line.routeId
          ? lineRoutes.find(item => item.id === line.routeId)
            ?? (linesByMode[safeMode] ?? []).find(item => item.id === line.routeId)
          : undefined;
        const selectedPattern = getSelectedPatternForLine(route, line);
        const arrival = arrivals.find(item => item.lineId === line.id);

        const isSelectedLine = line.id === selectedLineId;
        const confirmedPreset = displayPresetsByLine[line.id] ?? DEFAULT_DISPLAY_PRESET;
        const displayPreset = editorStep === 'format' && isSelectedLine && liveDisplayType !== null ? liveDisplayType : confirmedPreset;

        const etaMinutes = arrival?.minutes != null ? Math.max(0, Math.round(arrival.minutes)) : null;
        // Use mock values when in format step so all styles are visible
        const mockEta = editorStep === 'format' && isSelectedLine;
        const hideEtaDuringSetup = editorStep === 'lines' || editorStep === 'stops';
        const etaText = mockEta ? '3m' : hideEtaDuringSetup ? '--' : etaMinutes != null ? `${etaMinutes}m` : '--';
        const additionalArrivalCount = Math.max(0, line.nextStops - 1);
        const etaListText = additionalArrivalCount > 0
          ? (
              mockEta
                ? buildNextArrivalTimes(3, additionalArrivalCount)
                : buildNextArrivalTimes(etaMinutes ?? 2, additionalArrivalCount)
            ).join(', ')
          : '';
        const routePreviewLabel = route?.label ?? line.routeId ?? '';
        const directionLabel = selectedPattern?.label ?? getDirectionCueLabel(city, safeMode, line.direction, route ?? line.routeId);
        const headsignLabel = selectedPattern?.lastStopName ?? getHeadsignLabel(city, safeMode, line.direction, route ?? line.routeId, routePreviewLabel);
        const stopName = station?.name ?? (mockEta ? getMockStopName(city, safeMode) : '');
        const primaryPreviewText = resolveDisplayContent(line.primaryContent, stopName, directionLabel, headsignLabel, line.label);
        const secondaryPreviewText = resolveDisplayContent(
          line.secondaryContent,
          stopName,
          directionLabel,
          headsignLabel,
          line.secondaryLabel || (mockEta ? (line.secondaryContent === 'headsign' ? headsignLabel : directionLabel) : ''),
        );
        const previewTitle = stopName ? primaryPreviewText : '';
        const previewSubLine =
          !stopName
            ? undefined
            : (displayPreset === 4 || displayPreset === 5 || displayPreset === 6) && etaListText
                ? etaListText
                : undefined;
        const previewSubLineColor =
          displayPreset === 4 || displayPreset === 5 || displayPreset === 6 ? colors.highlight : undefined;

        const badgeShape: Display3DSlot['badgeShape'] =
          city === 'new-york' && safeMode === 'train'
            ? 'circle'
            : city === 'chicago' && safeMode === 'train'
            ? 'train'
            : 'pill';


        return {
          id: line.id,
          color: route?.color ?? colors.border,
          textColor: route?.textColor || DEFAULT_TEXT_COLOR,
          routeLabel: isNycRailMode(safeMode)
            ? (route ? '' : '?')
            : getLocalRouteBadgeLabel(
                city,
                safeMode,
                line.routeId ?? route?.id ?? '?',
                route?.label ?? line.routeId ?? '?',
                route?.shortName,
              ),
          badgeShape,
          selected: line.id === selectedLineId,
          stopName: previewTitle,
          scrollLabel: line.scrolling,
          subLine: previewSubLine,
          subLineColor: previewSubLineColor,
          times: etaText,
        };
      }),
    [arrivals, city, displayPresetsByLine, editorStep, lines, linesByMode, liveDisplayType, routesByStation, selectedLineId, stationsByLine, stationsByMode],
  );
  const previewEmptyMessage =
    editorStep === 'lines' && !lines.some(line => line.routeId)
      ? 'Select a line below to preview'
      : undefined;
  const previewHasMultipleDevices = !previewEmptyMessage && previewSlots.length > 2;

  const headerAnimatedStyle = {
    opacity: headerEnter,
    transform: [
      {
        translateY: headerEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [-12, 0],
        }),
      },
    ],
  } as const;

  const previewAnimatedStyle = {
    opacity: previewEnter,
    transform: [
      {
        translateY: previewEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
      {
        scale: previewEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [0.985, 1],
        }),
      },
    ],
  } as const;

  const editorAnimatedStyle = {
    opacity: editorEnter,
    transform: [
      {
        translateY: editorEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  } as const;

  const stepAnimatedStyle = {
    opacity: stepAnim,
    transform: [
      {
        translateX: stepAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [28, 0],
        }),
      },
      {
        translateY: stepAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
      {
        scale: stepAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.985, 1],
        }),
      },
    ],
  } as const;

  const selectedRouteForEditor = selectedLine
    ? resolveRouteForLine(city, selectedLine, routesByStation, linesByMode)
    : undefined;
  const selectedStopsLookupKey = selectedLine
    ? stopLookupKey(
      normalizeMode(city, selectedLine.mode),
      selectedLine.routeId,
      stopLookupTokenForLine(
        city,
        normalizeMode(city, selectedLine.mode),
        selectedLine,
        selectedRouteForEditor,
      ),
    )
    : '';
  const fallbackSelectedStopsLookupKey = selectedLine
    ? stopLookupKey(normalizeMode(city, selectedLine.mode), selectedLine.routeId)
    : '';
  const selectedStationsForRoute = selectedLine
    ? (
      stationsByLine[selectedStopsLookupKey]
      ?? stationsByLine[fallbackSelectedStopsLookupKey]
      ?? []
    )
    : [];
  const selectedStationsLoading = selectedLine
    ? !!stationsLoadingByLine[selectedStopsLookupKey]
    : false;
  const selectedStationForEditor = selectedLine
    ? resolveSelectedStationForLine(selectedLine, city, stationsByMode, stationsByLine)
    : undefined;
  const completedBuilderSteps =
    (selectedLine?.routeId ? 1 : 0) +
    (selectedLine?.stationId ? 1 : 0) +
    (selectedLinePresetConfirmed ? 1 : 0);
  const builderProgressItems = [
    {
      id: 'line',
      label: 'Line',
      state: selectedLine?.routeId ? 'complete' : editorStep === 'lines' ? 'active' : 'upcoming',
      value: selectedRouteForEditor?.label ?? 'Choose route',
      onPress: editorStep !== 'lines' ? () => setEditorStep('lines') : undefined,
    },
    {
      id: 'stop',
      label: 'Stop',
      state: selectedLine?.stationId ? 'complete' : editorStep === 'stops' ? 'active' : 'upcoming',
      value: selectedStationForEditor?.name ?? 'Choose stop',
      onPress: selectedLine?.routeId ? () => setEditorStep('stops') : undefined,
    },
    {
      id: 'display',
      label: 'Display Type',
      state: selectedLinePresetConfirmed ? 'complete' : editorStep === 'format' ? 'active' : 'upcoming',
      value: selectedLinePresetConfirmed
        ? (() => {
            const selectedMode = selectedLine != null ? normalizeMode(city, selectedLine.mode) : 'train';
            const defaultLabel = DISPLAY_PRESET_OPTIONS.find(option => option.id === selectedDisplayPreset)?.label ?? 'Choose style';
            return getPresetLabelForMode(city, selectedMode, selectedDisplayPreset, defaultLabel);
          })()
        : 'Choose style',
      onPress: selectedLine?.routeId && selectedLine?.stationId ? () => setEditorStep('format') : undefined,
    },
  ] as const;
  const wizardStepDefs = useMemo(
    () =>
      getWizardStepDefs({
        step: editorStep,
        includeCityStep: isCreateMode,
        hasLine: !!selectedLine?.routeId,
        hasStop: !!selectedLine?.stationId,
        hasPreset: selectedLinePresetConfirmed,
        isLirr: selectedLine != null && normalizeMode(city, selectedLine.mode) === 'lirr',
      }),
    [city, editorStep, isCreateMode, selectedLine, selectedLinePresetConfirmed],
  );
  const currentWizardStepIndex = wizardStepDefs.findIndex(item => item.id === editorStep);
  const previousWizardStepId = currentWizardStepIndex > 0 ? wizardStepDefs[currentWizardStepIndex - 1]?.id ?? null : null;
  const nextWizardStepId = (() => {
    if (currentWizardStepIndex < 0) return null;
    const nextStep = wizardStepDefs[currentWizardStepIndex + 1];
    return nextStep?.reachable ? nextStep.id : null;
  })();
  const canSwipeBetweenSteps = !previewHasMultipleDevices;
  const handleSwipeStep = (targetStep: EditorStep | null) => {
    if (!targetStep) return;
    setEditorStep(targetStep);
    void Haptics.selectionAsync();
  };
  const handleStepSwipeGesture = ({nativeEvent}: PanGestureHandlerStateChangeEvent) => {
    if (nativeEvent.state !== State.END) return;

    const {translationX, translationY} = nativeEvent;
    const horizontalDistance = Math.abs(translationX);
    const verticalDistance = Math.abs(translationY);

    if (horizontalDistance < MIN_STEP_SWIPE_DISTANCE || horizontalDistance <= verticalDistance * 1.2) {
      return;
    }

    if (translationX < 0) {
      handleSwipeStep(nextWizardStepId);
      return;
    }

    handleSwipeStep(previousWizardStepId);
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <PanGestureHandler
        enabled={canSwipeBetweenSteps && (!!nextWizardStepId || !!previousWizardStepId)}
        activeOffsetX={[-20, 20]}
        failOffsetY={[-20, 20]}
        onHandlerStateChange={handleStepSwipeGesture}>
          <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
            <KeyboardAvoidingView
              style={styles.keyboardAvoid}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>

        {/* ── Wizard header (fixed, not scrollable) ─────────────────────── */}
        <Animated.View style={[styles.topBarWrap, headerAnimatedStyle]}>
          <TopBar
            layoutSlots={layoutSlots}
            presetName={presetName}
            editorStep={editorStep}
            onPresetNameChange={setPresetName}
            onLayoutOpen={() => setShowLayoutSelector(true)}
            onBackPress={handleTopBarBackPress}
          />
          <WizardStepBar
            step={editorStep}
            includeCityStep={isCreateMode}
            hasLine={!!selectedLine?.routeId}
            hasStop={!!selectedLine?.stationId}
            hasPreset={selectedLinePresetConfirmed}
            isLirr={selectedLine != null && normalizeMode(city, selectedLine.mode) === 'lirr'}
            onGoTo={targetStep => {
              if (targetStep === 'city' && isCreateMode) { setEditorStep('city'); return; }
              if (!selectedLine) return;
              if (targetStep === 'service') { setEditorStep('service'); return; }
              if (targetStep === 'lines') { setEditorStep('lines'); return; }
              if (targetStep === 'stops' && selectedLine.routeId) { setEditorStep('stops'); return; }
              if (targetStep === 'format' && selectedLine.routeId && selectedLine.stationId) { setEditorStep('format'); return; }
              if (targetStep === 'done' && selectedLine.routeId && selectedLine.stationId && selectedLinePresetConfirmed) { setEditorStep('done'); return; }
            }}
          />
        </Animated.View>

        {/* ── Fixed preview — always visible, never scrolls ─────────────── */}
        {editorStep !== 'city' && editorStep !== 'service' ? (
          <Animated.View style={[styles.wizardFixedPreview, previewAnimatedStyle]}>
            <EditorPreviewCarousel
              slots={previewSlots}
              displayType={getPersistedDisplayType(liveDisplayType)}
              onSelectSlot={handleSelectSlotForEdit}
              onReorderSlot={reorderLineByHold}
              onDragStateChange={setPreviewDragging}
              emptyMessage={previewEmptyMessage}
            />
          </Animated.View>
        ) : null}

        {editorStep === 'city' ? (
          <Animated.View style={[stepAnimatedStyle, styles.linePickerFullScreen]}>
            <CityPickerStep selectedCity={city} onSelectCity={handleCitySelect} />
          </Animated.View>
        ) : null}

        {editorStep === 'service' && activeWizardLine ? (
          <Animated.View style={[stepAnimatedStyle, styles.linePickerFullScreen]}>
            <ServicePickerStep
              city={city}
              selectedMode={normalizeMode(city, activeWizardLine.mode)}
              hasLinkedDevice={hasLinkedDevice}
              liveSupported={liveSupported}
              onSelectMode={mode => {
                if (normalizeMode(city, activeWizardLine.mode) !== mode) {
                  updateLine(activeWizardLine.id, {mode, stationId: '', routeId: ''});
                }
                setEditorStep('lines');
              }}
              onAddDevice={() => router.push('/register-device')}
            />
          </Animated.View>
        ) : null}

        {/* ── Stop picker — fixed layout, lives outside the scroll view ── */}
        {editorStep === 'stops' && selectedLine ? (
          <Animated.View style={[stepAnimatedStyle, styles.stopPickerFullScreen]}>
            <StopPickerStep
              city={city}
              selectedMode={normalizeMode(city, selectedLine.mode)}
              selectedRoute={selectedRouteForEditor}
              stations={selectedStationsForRoute}
              loading={selectedStationsLoading}
              selectedStationId={selectedLine.stationId}
              selectedRouteId={selectedLine.routeId}
              selectedDirection={selectedLine.direction}
              search={stationSearch[selectedLine.id] ?? ''}
              onSearch={text => setStationSearch(prev => ({...prev, [selectedLine.id]: text}))}
              onSelectDirection={direction => updateLine(selectedLine.id, {direction})}
              onSelectStation={id => {
                updateLine(selectedLine.id, {stationId: id});
                setEditorStep(selectedLinePresetConfirmed ? 'done' : 'format');
              }}
            />
          </Animated.View>
        ) : null}

        {editorStep === 'lines' && activeWizardLine ? (
          <Animated.View style={[stepAnimatedStyle, styles.linePickerFullScreen]}>
            <LinePickerStep
              city={city}
              selectedMode={normalizeMode(city, activeWizardLine.mode)}
              linesByMode={linesByMode}
              linesLoadingByMode={linesLoadingByMode}
              selectedRouteId={activeWizardLine.routeId}
              selectedPatternId={activeWizardLine.patternId ?? ''}
              hasLinkedDevice={hasLinkedDevice}
              liveSupported={liveSupported}
              onSelectLine={(routeId, patternId) => {
                const mode = normalizeMode(city, activeWizardLine.mode);
                const selectedRoute = (linesByMode[mode] ?? []).find(route => route.id === routeId);
                const selectedPattern =
                  selectedRoute?.patterns?.find(pattern => pattern.id === patternId)
                  ?? getDefaultPatternForRoute(selectedRoute);
                updateLine(activeWizardLine.id, {
                  routeId,
                  stationId: '',
                  patternId: selectedPattern?.id ?? '',
                  direction: selectedPattern?.uiKey ?? getDefaultUiDirection(city, mode, selectedRoute),
                });
                setEditorStep('stops');
              }}
              onAddDevice={() => router.push('/register-device')}
            />
          </Animated.View>
        ) : null}

        {/* ── Scrollable step content (format/save only) ─────────────────── */}
        {editorStep !== 'city' && editorStep !== 'service' && editorStep !== 'stops' && editorStep !== 'lines' ? (
        <ScrollView
          contentContainerStyle={styles.wizardScroll}
          scrollEnabled={!previewDragging}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">

          {!hasLinkedDevice ? (
            <Pressable style={styles.noDeviceBar} onPress={() => router.push('/register-device')}>
              <Text style={styles.noDeviceText}>No device linked — tap to add one</Text>
            </Pressable>
          ) : null}

          {!liveSupported ? (
            <View style={styles.liveDisabledCard}>
              <Text style={styles.liveDisabledTitle}>Live Transit Unavailable</Text>
              <Text style={styles.liveDisabledBody}>
                {CITY_LABELS[city]} does not support live stop and line lookups yet.
              </Text>
            </View>
          ) : null}

          {selectedLine ? (
            <Animated.View style={stepAnimatedStyle}>

              {/* Step 3: Style picker — fixed preview above reflects live selection */}
              {editorStep === 'format' ? (
                <LedStylePickerStep
                  city={city}
                  displayType={selectedDisplayPreset}
                  line={selectedLine}
                  selectedRoute={selectedRouteForEditor}
                  selectedStation={selectedStationForEditor}
                  onChangeLine={next => updateLine(selectedLine.id, next)}
                  onPreview={setLiveStylePreview}
                  onSelect={preset => {
                    setLiveStylePreview(null);
                    const behavior = getPresetBehavior(preset);
                    const nextPrimaryContent = selectedLine.label.trim().length > 0 ? 'custom' : behavior.primaryContent;
                    const nextSecondaryContent =
                      behavior.supportsBottomCustom && selectedLine.secondaryLabel.trim().length > 0
                        ? 'custom'
                        : behavior.secondaryContent;
                    updateLine(selectedLine.id, {
                      displayFormat: behavior.displayFormat,
                      primaryContent: nextPrimaryContent,
                      secondaryContent: nextSecondaryContent,
                    });
                    setDisplayPresetsByLine(prev => ({...prev, [selectedLine.id]: preset}));
                    if (advanceToNextSlotIfNeeded(selectedLine.id)) return;
                    setEditorStep('done');
                  }}
                />
              ) : null}

              {/* Step 4: Review & save */}
              {editorStep === 'done' ? (
                <WizardReviewStep
                  city={city}
                  line={selectedLine}
                  displayPreset={selectedDisplayPreset}
                  selectedRoute={selectedRouteForEditor}
                  selectedStation={selectedStationForEditor}
                  presetName={presetName}
                  displayMetadata={displayMetadata}
                  onChangeLine={next => updateLine(selectedLine.id, next)}
                  onClearLine={() => clearLineSelection(selectedLine.id)}
                  onClearStop={() => clearStopSelection(selectedLine.id)}
                  onClearDisplayType={() => clearDisplayPreset(selectedLine.id)}
                  onPresetNameChange={setPresetName}
                  onBrightnessChange={brightness => setDisplayMetadata(prev => ({...prev, brightness}))}
                  onScrollingChange={scrolling => updateLine(selectedLine.id, {scrolling})}
                />
              ) : null}

            </Animated.View>
          ) : null}
        </ScrollView>
        ) : null}
            </KeyboardAvoidingView>

            {editorStep === 'done' ? (
              <SaveBar
                dirty={isDirty}
                loading={saving}
                success={saveDone}
                disabled={!canSaveToDevice}
                message={liveStatusText}
                secondaryActionLabel={layoutSlots < MAX_LAYOUT_SLOTS && selectedLinePresetConfirmed ? 'Add Another Line' : undefined}
                onSecondaryActionPress={layoutSlots < MAX_LAYOUT_SLOTS && selectedLinePresetConfirmed ? addLineToLayout : undefined}
                dangerActionLabel={layoutSlots > 1 && selectedLine ? 'Remove a Line' : undefined}
                onDangerActionPress={layoutSlots > 1 && selectedLine ? () => removeStopFromLayout(selectedLine.id) : undefined}
                onPress={handleSave}
              />
            ) : null}
            <ConfirmDiscardModal
              visible={showDiscardConfirm}
              onStay={() => setShowDiscardConfirm(false)}
              onLeave={() => {
                setShowDiscardConfirm(false);
                if ((router as any).canGoBack?.()) {
                  router.back();
                  return;
                }
                router.replace(fallbackRoute);
              }}
            />
            <LayoutSelectorModal
              visible={showLayoutSelector}
              layoutSlots={layoutSlots}
              onClose={() => setShowLayoutSelector(false)}
              onSelect={slots => {
                setShowLayoutSelector(false)
                applyLayout(slots)
              }}
            />
          </SafeAreaView>
      </PanGestureHandler>
    </GestureHandlerRootView>
  );
}

function EditorPreviewCarousel({
  slots,
  displayType,
  onSelectSlot,
  onReorderSlot,
  onDragStateChange,
  emptyMessage,
}: {
  slots: Display3DSlot[];
  displayType: number;
  onSelectSlot: (id: string) => void;
  onReorderSlot: (id: string) => void;
  onDragStateChange?: (dragging: boolean) => void;
  emptyMessage?: string;
}) {
  const deviceGroups = useMemo(() => {
    if (emptyMessage || slots.length <= 2) return [slots];
    const groups: Display3DSlot[][] = [];
    for (let index = 0; index < slots.length; index += 2) {
      groups.push(slots.slice(index, index + 2));
    }
    return groups;
  }, [emptyMessage, slots]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselDirection, setCarouselDirection] = useState<1 | -1>(1);
  const [previewStageWidth, setPreviewStageWidth] = useState(0);
  const [previewTransition, setPreviewTransition] = useState<{
    outgoing: Display3DSlot[];
    incoming: Display3DSlot[];
    direction: 1 | -1;
  } | null>(null);
  const previewTrackAnim = useRef(new Animated.Value(1)).current;
  const previousGroupRef = useRef<Display3DSlot[] | null>(null);
  const previousIndexRef = useRef<number | null>(null);
  const previousSelectedSlotIndexRef = useRef<number | null>(null);
  const selectedSlotIndex = slots.findIndex(slot => slot.selected);
  const hasMultipleDevices = !emptyMessage && deviceGroups.length > 1;
  const safeIndex = hasMultipleDevices ? Math.min(carouselIndex, deviceGroups.length - 1) : 0;
  const currentGroup = deviceGroups[safeIndex] ?? slots;
  const currentGroupKey = currentGroup.map(slot => slot.id).join('|');
  const previewTravelDistance = (previewStageWidth > 0 ? previewStageWidth : 320) + 24;

  useEffect(() => {
    if (!hasMultipleDevices) {
      setCarouselIndex(0);
      previousSelectedSlotIndexRef.current = selectedSlotIndex;
      return;
    }

    if (selectedSlotIndex >= 0 && previousSelectedSlotIndexRef.current !== selectedSlotIndex) {
      previousSelectedSlotIndexRef.current = selectedSlotIndex;
      const nextIndex = Math.floor(selectedSlotIndex / 2);
      if (nextIndex !== safeIndex) {
        setCarouselDirection(nextIndex > safeIndex ? 1 : -1);
        setCarouselIndex(nextIndex);
      }
      return;
    }

    previousSelectedSlotIndexRef.current = selectedSlotIndex;

    if (carouselIndex >= deviceGroups.length) {
      setCarouselIndex(deviceGroups.length - 1);
    }
  }, [carouselIndex, deviceGroups.length, hasMultipleDevices, safeIndex, selectedSlotIndex]);

  useLayoutEffect(() => {
    if (!hasMultipleDevices) {
      previousIndexRef.current = null;
      previousGroupRef.current = currentGroup;
      setPreviewTransition(null);
      previewTrackAnim.setValue(1);
      return;
    }

    if (previousIndexRef.current === null) {
      previousIndexRef.current = safeIndex;
      previousGroupRef.current = currentGroup;
      previewTrackAnim.setValue(1);
      return;
    }

    if (previousIndexRef.current === safeIndex) {
      previousGroupRef.current = currentGroup;
      return;
    }

    const outgoingGroup = previousGroupRef.current;
    previousIndexRef.current = safeIndex;
    previousGroupRef.current = currentGroup;

    if (!outgoingGroup) {
      setPreviewTransition(null);
      previewTrackAnim.setValue(1);
      return;
    }

    setPreviewTransition({
      outgoing: outgoingGroup,
      incoming: currentGroup,
      direction: carouselDirection,
    });
    previewTrackAnim.stopAnimation();
    previewTrackAnim.setValue(0);
    Animated.timing(previewTrackAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({finished}) => {
      if (finished) {
        setPreviewTransition(current =>
          current && current.incoming.map(slot => slot.id).join('|') === currentGroupKey ? null : current,
        );
      }
    });
  }, [carouselDirection, currentGroup, currentGroupKey, hasMultipleDevices, previewTrackAnim, safeIndex]);

  const goTo = useCallback(
    (index: number, directionHint?: 1 | -1) => {
      if (!hasMultipleDevices) return;
      const normalizedIndex = (index + deviceGroups.length) % deviceGroups.length;
      if (normalizedIndex !== safeIndex) {
        setCarouselDirection(directionHint ?? (normalizedIndex > safeIndex ? 1 : -1));
      }
      setCarouselIndex(normalizedIndex);
    },
    [deviceGroups.length, hasMultipleDevices, safeIndex],
  );

  const moveCarousel = useCallback(
    (direction: 1 | -1) => {
      if (!hasMultipleDevices) return;
      goTo(safeIndex + direction, direction);
    },
    [goTo, hasMultipleDevices, safeIndex],
  );

  const displaySwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          hasMultipleDevices &&
          Math.abs(gestureState.dx) > 14 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2,
        onPanResponderRelease: (_event, gestureState) => {
          if (Math.abs(gestureState.dx) < 40) return;
          moveCarousel(gestureState.dx < 0 ? 1 : -1);
        },
      }),
    [hasMultipleDevices, moveCarousel],
  );

  const renderPreviewGroup = (group: Display3DSlot[]) => (
    <DashboardPreviewSection
      slots={group}
      displayType={displayType}
      onSelectSlot={onSelectSlot}
      onReorderSlot={onReorderSlot}
      onDragStateChange={onDragStateChange}
      showHint={false}
      showGlow={false}
      emptyMessage={emptyMessage}
    />
  );

  return (
    <View style={styles.editorPreviewCarousel}>
      <Animated.View {...(hasMultipleDevices ? displaySwipeResponder.panHandlers : {})}>
        <View
          style={styles.editorPreviewStage}
          onLayout={event => setPreviewStageWidth(event.nativeEvent.layout.width)}>
          <View style={[styles.editorPreviewPane, previewTransition && styles.editorPreviewPaneHidden]}>
            {renderPreviewGroup(currentGroup)}
          </View>
          {previewTransition ? (
            <>
              <Animated.View
                style={[
                  styles.editorPreviewPaneFloating,
                  {
                    transform: [
                      {
                        translateX: previewTrackAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [
                            0,
                            previewTransition.direction > 0 ? -previewTravelDistance : previewTravelDistance,
                          ],
                        }),
                      },
                    ],
                  },
                ]}>
                {renderPreviewGroup(previewTransition.outgoing)}
              </Animated.View>
              <Animated.View
                style={[
                  styles.editorPreviewPaneFloating,
                  {
                    transform: [
                      {
                        translateX: previewTrackAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [
                            previewTransition.direction > 0 ? previewTravelDistance : -previewTravelDistance,
                            0,
                          ],
                        }),
                      },
                    ],
                  },
                ]}>
                {renderPreviewGroup(previewTransition.incoming)}
              </Animated.View>
            </>
          ) : null}
        </View>
      </Animated.View>

      {hasMultipleDevices ? (
        <>
          <View style={styles.editorPreviewNavRow}>
            <Pressable style={styles.editorPreviewArrowButton} onPress={() => goTo(safeIndex - 1)}>
              <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
            </Pressable>
            <View style={styles.editorPreviewNavCenter}>
              <Text style={styles.editorPreviewNavTitle}>Device {safeIndex + 1}</Text>
              <Text style={styles.editorPreviewNavMeta}>
                {currentGroup.length} {currentGroup.length === 1 ? 'line' : 'lines'}
              </Text>
            </View>
            <Pressable style={styles.editorPreviewArrowButton} onPress={() => goTo(safeIndex + 1)}>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
          <View style={styles.editorPreviewDots}>
            {deviceGroups.map((_, index) => (
              <Pressable
                key={`editor-preview-dot-${index + 1}`}
                style={[styles.editorPreviewDot, index === safeIndex && styles.editorPreviewDotActive]}
                onPress={() => goTo(index)}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function TopBar({
  layoutSlots,
  presetName,
  editorStep,
  onPresetNameChange,
  onLayoutOpen,
  onBackPress,
}: {
  layoutSlots: number;
  presetName: string;
  editorStep: EditorStep;
  onPresetNameChange: (value: string) => void;
  onLayoutOpen: () => void;
  onBackPress: () => void;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [draftName, setDraftName] = useState(presetName);

  useEffect(() => {
    setDraftName(presetName);
  }, [presetName]);

  const commitName = () => {
    const next = draftName.trim() || 'Display 1';
    onPresetNameChange(next);
    setRenameOpen(false);
  };

  return (
    <View style={styles.topBarWrap}>
      <View style={styles.topBar}>
        <View style={styles.topBarSideLeft}>
          <Pressable style={styles.backButton} onPress={onBackPress}>
            <Text style={styles.topBarBackText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.topBarCenter}>
          <View style={styles.presetNameRow}>
            <Text style={styles.presetNameTitle} numberOfLines={1}>
              {presetName}
            </Text>
            <Pressable
              style={styles.presetNameEditButton}
              onPress={() => setRenameOpen(prev => !prev)}>
              <Text style={styles.presetNameEditEmoji}>Edit</Text>
            </Pressable>
          </View>
        </View>

        {editorStep !== 'city' && editorStep !== 'service' && editorStep !== 'lines' ? (
          <View style={styles.topBarSideRight}>
            <Pressable style={styles.layoutPillTopRight} onPress={onLayoutOpen}>
              <Text style={styles.layoutPillTopRightText}>{layoutSlots === 1 ? '1 line' : '2 lines'}</Text>
              <Text style={styles.layoutPillChevron}>⌄</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <FadeSection visible={renameOpen}>
        <View style={styles.renameRow}>
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            placeholder="Display name"
            placeholderTextColor={colors.textMuted}
            style={styles.renameInput}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={commitName}
          />
          <Pressable style={styles.renameActionButton} onPress={commitName}>
            <Text style={styles.renameActionButtonText}>Save</Text>
          </Pressable>
        </View>
      </FadeSection>
    </View>
  );
}

function CityPickerStep({
  selectedCity,
  onSelectCity,
}: {
  selectedCity: CityId;
  onSelectCity: (city: CityId) => void;
}) {
  return (
    <View style={styles.cityPickerSection}>
      <Text style={styles.stepTitle}>Select city</Text>
      <Text style={styles.stepSubtitle}>Choose the transit system this display should follow.</Text>
      <View style={styles.cityPickerList}>
        {CITY_OPTIONS.map(option => {
          const active = option.id === selectedCity;
          const brand = CITY_BRANDS[option.id];
          const pillPalette = getCityAgencyPillPalette(option.id);
          const idleCardBorderColor =
            option.id === 'new-york' ? withHexAlpha(brand.accent, '8A') : withHexAlpha(brand.badgeBorder, '8A');
          const idleCardBackgroundColor =
            option.id === 'new-york' ? withHexAlpha(brand.accent, '14') : withHexAlpha(brand.badgeBg, '14');
          return (
            <Pressable
              key={option.id}
              style={[
                styles.cityPickerCard,
                !active && {
                  borderColor: idleCardBorderColor,
                  backgroundColor: idleCardBackgroundColor,
                },
                active && styles.cityPickerCardActive,
              ]}
              onPress={() => onSelectCity(option.id)}>
              <View style={styles.cityPickerCardTop}>
                <View style={styles.cityPickerIdentity}>
                  <View
                    style={[
                      styles.cityPickerAgencyPill,
                      {
                        borderColor: pillPalette.borderColor,
                        backgroundColor: pillPalette.backgroundColor,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.cityPickerAgencyText,
                        {color: pillPalette.textColor},
                      ]}>
                      {option.agencyCode}
                    </Text>
                  </View>
                  <View style={styles.cityPickerTitleWrap}>
                    <Text style={[styles.cityPickerTitle, active && styles.cityPickerTitleActive]}>
                      {option.label}
                    </Text>
                  </View>
                </View>
                <View style={[styles.choiceRowCheck, active && styles.choiceRowCheckActive]}>
                  {active ? <Text style={styles.choiceRowCheckText}>✓</Text> : null}
                </View>
              </View>
              <View style={styles.cityPickerCopy}>
                <Text style={styles.cityPickerDescription} numberOfLines={2}>
                  {option.description}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ServicePickerStep({
  city,
  selectedMode,
  hasLinkedDevice,
  liveSupported,
  onSelectMode,
  onAddDevice,
}: {
  city: CityId;
  selectedMode: ModeId;
  hasLinkedDevice: boolean;
  liveSupported: boolean;
  onSelectMode: (mode: ModeId) => void;
  onAddDevice: () => void;
}) {
  const modeOptions = getAvailableModes(city);

  return (
    <View style={[styles.stepContainer, styles.linePickerStepFull]}>
      {!hasLinkedDevice ? (
        <Pressable style={styles.noDeviceBar} onPress={onAddDevice}>
          <Text style={styles.noDeviceText}>No device linked — tap to add one</Text>
        </Pressable>
      ) : null}
      {!liveSupported ? (
        <View style={styles.liveDisabledCard}>
          <Text style={styles.liveDisabledTitle}>Live Transit Unavailable</Text>
          <Text style={styles.liveDisabledBody}>
            {CITY_LABELS[city]} does not support live stop and line lookups yet.
          </Text>
        </View>
      ) : null}

      <View style={styles.stepSection}>
        <Text style={styles.stepTitle}>Select service</Text>
        <Text style={styles.stepSubtitle}>Choose the service for this display.</Text>
      </View>

      <View style={styles.servicePickerList}>
        {modeOptions.map(mode => {
          const active = selectedMode === mode;
          const accentColor = CITY_MODE_COLORS[city]?.[mode] ?? colors.accent;

          return (
            <Pressable
              key={mode}
              style={[styles.servicePickerCard, active && styles.servicePickerCardActive]}
              onPress={() => onSelectMode(mode)}>
              <View style={[styles.servicePickerAccent, {backgroundColor: accentColor}]} />
              <View style={styles.servicePickerBody}>
                <View style={styles.servicePickerIdentity}>
                  <View
                    style={[
                      styles.servicePickerBadge,
                      {borderColor: accentColor, backgroundColor: withHexAlpha(accentColor, '12')},
                    ]}>
                    <Text style={[styles.servicePickerBadgeText, {color: accentColor}]}>
                      {getModeLabel(city, mode)}
                    </Text>
                  </View>
                  <View style={styles.servicePickerCopy}>
                    <Text style={[styles.servicePickerTitle, active && styles.servicePickerTitleActive]}>
                      {getModeLabel(city, mode)}
                    </Text>
                    <Text style={styles.servicePickerDescription}>
                      {getServiceDescription(city, mode)}
                    </Text>
                  </View>
                </View>
                <View style={[styles.choiceRowCheck, active && styles.choiceRowCheckActive]}>
                  {active ? <Text style={styles.choiceRowCheckText}>✓</Text> : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function WizardStepBar({
  step,
  includeCityStep,
  hasLine,
  hasStop,
  hasPreset,
  isLirr,
  onGoTo,
}: {
  step: EditorStep;
  includeCityStep: boolean;
  hasLine: boolean;
  hasStop: boolean;
  hasPreset: boolean;
  isLirr: boolean;
  onGoTo: (step: EditorStep) => void;
}) {
  const stepDefs = getWizardStepDefs({step, includeCityStep, hasLine, hasStop, hasPreset, isLirr});

  const connectorStates = stepDefs.slice(0, -1).map(item => item.complete);

  // Connector fill anims (3 connectors between 4 steps)
  const connectorAnims = useRef(
    connectorStates.map(complete => new Animated.Value(complete ? 1 : 0)),
  ).current;

  useEffect(() => {
    connectorStates.forEach((complete, i) => {
      Animated.spring(connectorAnims[i], {
        toValue: complete ? 1 : 0,
        useNativeDriver: false,
        speed: 14,
        bounciness: 0,
      }).start();
    });
  }, [connectorAnims, connectorStates]);

  return (
    <View style={styles.wizardStepBar}>
      <View style={styles.stepIndicatorRow}>
        {stepDefs.map((s, i) => (
          <React.Fragment key={s.id}>
            <WizardDot
              num={i + 1}
              label={s.label}
              isActive={s.id === step}
              isComplete={s.complete}
              reachable={s.reachable}
              onPress={() => onGoTo(s.id)}
            />
            {i < stepDefs.length - 1 && (
              <View style={styles.stepConnectorTrack}>
                <Animated.View
                  style={[
                    styles.stepConnectorFill,
                    {
                      width: connectorAnims[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
            )}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

function WizardDot({
  num,
  label,
  isActive,
  isComplete,
  reachable,
  onPress,
}: {
  num: number;
  label: string;
  isActive: boolean;
  isComplete: boolean;
  reachable: boolean;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const wasActive = useRef(isActive);

  useEffect(() => {
    if (isActive && !wasActive.current) {
      Animated.sequence([
        Animated.spring(scaleAnim, {toValue: 1.25, useNativeDriver: true, speed: 40, bounciness: 14}),
        Animated.spring(scaleAnim, {toValue: 1, useNativeDriver: true, speed: 20, bounciness: 0}),
      ]).start();
    }
    wasActive.current = isActive;
  }, [isActive, scaleAnim]);

  const circleColor = isActive ? WIZARD_STEP_ACTIVE_COLOR : WIZARD_STEP_DEFAULT_COLOR;

  return (
    <Pressable
      style={styles.stepDotWrapper}
      onPress={reachable ? onPress : undefined}
      disabled={!reachable}>
      <Animated.View
        style={[
          styles.stepDotCircle,
          (isActive || isComplete) && {
            borderColor: circleColor,
          },
          isActive && {
            backgroundColor: withHexAlpha(circleColor, '2A'),
          },
          isComplete && {
            backgroundColor: circleColor,
          },
          {transform: [{scale: scaleAnim}]},
        ]}>
        {isComplete ? (
          <Text style={styles.stepDotCheckmark}>✓</Text>
        ) : (
          <Text
            style={[
              styles.stepDotNumber,
              (isActive || isComplete) && {color: circleColor},
            ]}>
            {num}
          </Text>
        )}
      </Animated.View>
      <Text
        style={[
          styles.stepDotLabel,
          isComplete && styles.stepDotLabelComplete,
          isActive && {color: circleColor},
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

function LayoutSelectorModal({
  visible,
  layoutSlots,
  onClose,
  onSelect,
}: {
  visible: boolean;
  layoutSlots: number;
  onClose: () => void;
  onSelect: (slots: number) => void;
}) {
  return (
    <SelectionSheet
      visible={visible}
      title="Number of Lines"
      subtitle="Choose how many lines this display should show."
      options={[
        {id: '1', label: 'Single Line', description: 'Keep one destination large and easy to scan.'},
        {id: '2', label: 'Two Lines', description: 'Split the display to show a second line.'},
      ]}
      value={String(layoutSlots)}
      onSelect={id => onSelect(Number(id))}
      onClose={onClose}
    />
  );
}

function ConfirmDiscardModal({
  visible,
  onStay,
  onLeave,
}: {
  visible: boolean;
  onStay: () => void;
  onLeave: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onStay}>
      <Pressable style={styles.confirmOverlay} onPress={onStay}>
        <Pressable style={styles.confirmSheet} onPress={() => {}}>
          <Text style={styles.confirmTitle}>Discard unsaved changes?</Text>
          <Text style={styles.confirmBody}>You have unsaved edits. Leave this page without saving?</Text>
          <View style={styles.confirmActions}>
            <Pressable style={styles.confirmStayButton} onPress={onStay}>
              <Text style={styles.confirmStayText}>Keep editing</Text>
            </Pressable>
            <Pressable style={styles.confirmLeaveButton} onPress={onLeave}>
              <Text style={styles.confirmLeaveText}>Discard and Go Back</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SaveBar({
  dirty,
  loading,
  success,
  disabled,
  message,
  secondaryActionLabel,
  onSecondaryActionPress,
  dangerActionLabel,
  onDangerActionPress,
  onPress,
}: {
  dirty: boolean;
  loading: boolean;
  success: boolean;
  disabled: boolean;
  message: string;
  secondaryActionLabel?: string;
  onSecondaryActionPress?: () => void;
  dangerActionLabel?: string;
  onDangerActionPress?: () => void;
  onPress: () => void;
}) {
  const visibilityAnim = useRef(new Animated.Value(dirty || loading || success ? 1 : 0.92)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(visibilityAnim, {
      toValue: dirty || loading || success ? 1 : 0.94,
      tension: 110,
      friction: 16,
      useNativeDriver: true,
    }).start();
  }, [dirty, loading, success, visibilityAnim]);

  useEffect(() => {
    if (!dirty && !success) return;
    Animated.sequence([
      Animated.spring(buttonScale, {toValue: 1.03, tension: 180, friction: 10, useNativeDriver: true}),
      Animated.spring(buttonScale, {toValue: 1, tension: 180, friction: 12, useNativeDriver: true}),
    ]).start();
  }, [buttonScale, dirty, success]);

  return (
    <Animated.View
      style={[
        styles.saveBar,
        {
          opacity: visibilityAnim,
          transform: [
            {
              translateY: visibilityAnim.interpolate({
                inputRange: [0.94, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}>
      {secondaryActionLabel && onSecondaryActionPress ? (
        <Pressable style={styles.reviewActionButton} onPress={onSecondaryActionPress}>
          <Text style={styles.reviewActionButtonText}>{secondaryActionLabel}</Text>
        </Pressable>
      ) : null}
      {dangerActionLabel && onDangerActionPress ? (
        <Pressable style={styles.reviewRemoveButton} onPress={onDangerActionPress}>
          <Text style={styles.reviewRemoveButtonText}>{dangerActionLabel}</Text>
        </Pressable>
      ) : null}
      <Animated.View style={{transform: [{scale: buttonScale}]}}>
        <Pressable
          disabled={disabled}
          onPress={onPress}
          style={[styles.saveButton, disabled && styles.saveButtonDisabled, success && styles.saveButtonSuccess]}>
          <Text style={styles.saveButtonText}>{loading ? 'Saving...' : success ? 'Synced' : 'Save to Device'}</Text>
        </Pressable>
      </Animated.View>
      {message ? <Text style={styles.saveHint}>{message}</Text> : null}
    </Animated.View>
  );
}

function SelectionSheet({
  visible,
  title,
  subtitle,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: SelectionSheetOption[];
  value: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }

    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 240 : 170,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({finished}) => {
      if (finished && !visible) {
        setMounted(false);
      }
    });
  }, [progress, visible]);

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <View style={styles.selectionSheetOverlay}>
        <Animated.View
          style={[
            styles.selectionSheetBackdrop,
            {
              opacity: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            },
          ]}>
          <Pressable style={styles.selectionSheetBackdropPressable} onPress={onClose} />
        </Animated.View>
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.selectionSheetFrame,
            {
              opacity: progress,
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [36, 0],
                  }),
                },
                {
                  scale: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.98, 1],
                  }),
                },
              ],
            },
          ]}>
          <View style={styles.selectionSheetSurface}>
            <View style={styles.selectionSheetHandle} />
            <View style={styles.selectionSheetHeader}>
              <View style={styles.selectionSheetHeaderCopy}>
                <Text style={styles.selectionSheetTitle}>{title}</Text>
                {subtitle ? <Text style={styles.selectionSheetSubtitle}>{subtitle}</Text> : null}
              </View>
              <Pressable style={styles.selectionSheetCloseButton} onPress={onClose}>
                <Text style={styles.selectionSheetCloseButtonText}>Close</Text>
              </Pressable>
            </View>
            <View style={styles.selectionSheetOptionList}>
              {options.map((option, index) => {
                const active = option.id === value;
                const last = index === options.length - 1;
                return (
                  <Pressable
                    key={option.id}
                    style={[
                      styles.selectionSheetOption,
                      active && styles.selectionSheetOptionActive,
                      !last && styles.selectionSheetOptionDivider,
                    ]}
                    onPress={() => {
                      onSelect(option.id);
                      onClose();
                    }}>
                    <View style={styles.selectionSheetOptionCopy}>
                      <Text style={[styles.selectionSheetOptionLabel, active && styles.selectionSheetOptionLabelActive]}>
                        {option.label}
                      </Text>
                      {option.description ? (
                        <Text style={[styles.selectionSheetOptionDescription, active && styles.selectionSheetOptionDescriptionActive]}>
                          {option.description}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[styles.selectionSheetOptionBadge, active && styles.selectionSheetOptionBadgeActive]}>
                      <Text style={[styles.selectionSheetOptionBadgeText, active && styles.selectionSheetOptionBadgeTextActive]}>
                        {active ? 'Selected' : 'Choose'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function SimplePicker({
  visible,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  options: SelectionSheetOption[];
  value: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <SelectionSheet
      visible={visible}
      title="Choose Service Pattern"
      subtitle="Pick the version of this line you want to show."
      options={options}
      value={value}
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}

function StepTransitionMessage({
  message,
  badgeLabel,
  badgeColor,
}: {
  message: string;
  badgeLabel?: string;
  badgeColor?: string;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fadeAnim, {toValue: 1, tension: 140, friction: 12, useNativeDriver: true}),
      Animated.spring(scaleAnim, {toValue: 1, tension: 140, friction: 12, useNativeDriver: true}),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <Animated.View style={[styles.transitionContainer, {opacity: fadeAnim, transform: [{scale: scaleAnim}]}]}>
      {badgeLabel ? (
        <View style={[styles.transitionBadge, {backgroundColor: badgeColor ?? colors.border}]}>
          <Text style={styles.transitionBadgeText}>{badgeLabel}</Text>
        </View>
      ) : (
        <View style={styles.transitionSpinnerPlaceholder} />
      )}
      <Text style={styles.transitionMessage}>{message}</Text>
      <View style={styles.transitionDots}>
        <View style={styles.transitionDot} />
        <View style={styles.transitionDot} />
        <View style={styles.transitionDot} />
      </View>
    </Animated.View>
  );
}

function FadeSection({
  visible,
  children,
}: {
  visible: boolean;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }

    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 150,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({finished}) => {
      if (finished && !visible) {
        setMounted(false);
      }
    });
  }, [anim, visible]);

  if (!mounted) return null;

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [18, 0],
            }),
          },
          {
            scale: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.98, 1],
            }),
          },
        ],
      }}>
      {children}
    </Animated.View>
  );
}

const NYC_MODE_COLORS: Partial<Record<ModeId, string>> = {
  train: '#C4651A',
  bus: '#0039A6',
  lirr: '#808183',
  mnr: '#6F7D93',
};

const CITY_MODE_COLORS: Partial<Record<CityId, Partial<Record<ModeId, string>>>> = {
  'new-york': NYC_MODE_COLORS,
  philadelphia: {
    train: '#005DAA',
    trolley: '#6D3FA9',
    bus: '#17844B',
  },
  boston: {
    train: '#DA291C',
    bus: '#7C878E',
    'commuter-rail': '#7B61FF',
  },
  chicago: {
    train: '#00A1DE',
    bus: '#17844B',
  },
  'new-jersey': {
    train: '#0039A6',
    bus: '#0039A6',
  },
};

const getServiceDescription = (city: CityId, mode: ModeId) => {
  if (city === 'new-york') {
    if (mode === 'train') return 'Subway lines across New York City';
    if (mode === 'bus') return 'Local, limited, and Select Bus Service routes';
    if (mode === 'lirr') return 'Long Island Rail Road branches and stations';
    if (mode === 'mnr') return 'Metro-North lines and terminals';
  }
  if (city === 'boston') {
    if (mode === 'train') return 'Subway lines across the MBTA network';
    if (mode === 'bus') return 'Local and key MBTA bus routes';
    if (mode === 'commuter-rail') return 'Commuter rail lines and branches';
  }
  if (city === 'philadelphia') {
    if (mode === 'train') return 'Regional Rail and rapid transit service';
    if (mode === 'trolley') return 'Trolley routes across the SEPTA network';
    if (mode === 'bus') return 'Bus routes and neighborhood corridors';
  }
  if (city === 'chicago') {
    if (mode === 'train') return 'CTA rail lines across the city';
    if (mode === 'bus') return 'CTA bus routes and corridors';
  }
  if (city === 'new-jersey') {
    if (mode === 'train') return 'NJ Transit rail lines and transfer hubs';
  }
  return 'Choose the service you want to show on this display.';
};

const getLineStepTitle = (city: CityId, mode: ModeId) => {
  if (city === 'new-york' && mode === 'lirr') return 'Select branch';
  if (city === 'new-york' && mode === 'bus') return 'Select route';
  return 'Select line';
};

const getLineStepSubtitle = (city: CityId, mode: ModeId) => {
  if (city === 'new-york' && mode === 'train') return 'Pick the subway line this display should follow.';
  if (city === 'new-york' && mode === 'bus') return 'Choose the bus route this display should follow.';
  if (city === 'new-york' && mode === 'lirr') return 'Choose the LIRR branch this display should follow.';
  if (city === 'new-york' && mode === 'mnr') return 'Choose the Metro-North line this display should follow.';
  return 'Choose the service line this display should follow.';
};

const BOSTON_ROUTE_CARD_TITLES: Record<string, string> = {
  RED: 'Red Line',
  ORANGE: 'Orange Line',
  BLUE: 'Blue Line',
  'GREEN-B': 'Green Line B Branch',
  'GREEN-C': 'Green Line C Branch',
  'GREEN-D': 'Green Line D Branch',
  'GREEN-E': 'Green Line E Branch',
  MATTAPAN: 'Mattapan Line',
};

const getDefaultCollapsedLineGroupKeys = (city: CityId, mode: ModeId) => {
  if (city === 'new-york' && mode === 'bus') {
    return ['bronx', 'brooklyn', 'manhattan', 'queens', 'staten-island', 'other'];
  }

  if (city === 'boston' && mode === 'bus') {
    return ['silver-line', 'crosstown', 'local', 'quincy', 'northwest', 'north-shore', 'express', 'other'];
  }

  return [];
};

const getBostonRouteCardTitle = (mode: ModeId, route: RoutePickerItem) => {
  const normalizedId = route.id.trim().toUpperCase();
  const fallbackLabel = route.label.trim() || route.displayLabel;

  if (mode === 'train') {
    return BOSTON_ROUTE_CARD_TITLES[normalizedId] ?? fallbackLabel;
  }

  if (mode === 'commuter-rail') {
    return route.displayLabel.trim() || fallbackLabel;
  }

  return fallbackLabel;
};

const getBostonRouteCardSubtitle = (mode: ModeId, route: RoutePickerItem) => {
  const normalizedId = route.id.trim().toUpperCase();
  const fullLabel = route.label.trim();

  if (mode === 'train') {
    if (normalizedId.startsWith('GREEN-')) return 'Choose a specific Green Line branch';
    if (normalizedId === 'MATTAPAN') return 'Mattapan trolley service';
    return 'MBTA rapid transit line';
  }

  if (mode === 'commuter-rail') {
    if (fullLabel.length > 0 && fullLabel.toLowerCase() !== route.displayLabel.trim().toLowerCase()) {
      return fullLabel;
    }
    return 'MBTA commuter rail line';
  }

  return null;
};


function LinePickerStep({
  city,
  selectedMode,
  linesByMode,
  linesLoadingByMode,
  selectedRouteId,
  selectedPatternId,
  hasLinkedDevice,
  liveSupported,
  onSelectLine,
  onAddDevice,
}: {
  city: CityId;
  selectedMode: ModeId;
  linesByMode: Partial<Record<ModeId, Route[]>>;
  linesLoadingByMode: Partial<Record<ModeId, boolean>>;
  selectedRouteId: string;
  selectedPatternId: string;
  hasLinkedDevice: boolean;
  liveSupported: boolean;
  onSelectLine: (routeId: string, patternId?: string) => void;
  onAddDevice: () => void;
}) {
  const allRoutes = useMemo(() => linesByMode[selectedMode] ?? [], [linesByMode, selectedMode]);
  const isLoading = !!linesLoadingByMode[selectedMode];
  const [lineSearch, setLineSearch] = useState('');
  const [variantPickerEntry, setVariantPickerEntry] = useState<RoutePickerItem | null>(null);
  const [expandedPatternRouteId, setExpandedPatternRouteId] = useState<string | null>(
    selectedRouteId || null,
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(getDefaultCollapsedLineGroupKeys(city, selectedMode)),
  );
  const pulseAnims = useRef<Record<string, Animated.Value>>({}).current;

  const isBusGrouped = selectedMode === 'bus' && (city === 'new-york' || city === 'boston');
  const isNycSubwayGrid = city === 'new-york' && selectedMode === 'train';
  const isBostonRouteCardMode =
    city === 'boston' && (selectedMode === 'train' || selectedMode === 'commuter-rail');
  const isChicagoTrainListMode = city === 'chicago' && selectedMode === 'train';
  const isWidePillMode =
    (city === 'new-jersey' && selectedMode === 'train');
  const isBranchListMode =
    selectedMode === 'lirr' ||
    selectedMode === 'mnr' ||
    (city === 'philadelphia' && selectedMode === 'train') ||
    (city === 'new-jersey' && selectedMode === 'train');

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Show search bar when there are many lines (buses especially)
  const showSearch = selectedMode === 'bus' && allRoutes.length > 15;

  const routes = useMemo(() => {
    const term = lineSearch.trim().toLowerCase();
    const filtered = !term
      ? allRoutes
      : allRoutes.filter(r =>
      r.label.toLowerCase().includes(term) || r.id.toLowerCase().includes(term),
      );
    return prepareRouteEntriesForPicker(city, selectedMode, filtered);
  }, [allRoutes, city, lineSearch, selectedMode]);
  const isSearchingLines = lineSearch.trim().length > 0;

  const routeGroups = useMemo(() => buildRouteGroups(city, selectedMode, routes), [city, routes, selectedMode]);

  // Reset search and collapse groups when mode changes
  useEffect(() => {
    setLineSearch('');
    setCollapsedGroups(new Set(getDefaultCollapsedLineGroupKeys(city, selectedMode)));
  }, [city, selectedMode]);

  useEffect(() => {
    if (!isChicagoTrainListMode) {
      setExpandedPatternRouteId(null);
      return;
    }
    setExpandedPatternRouteId(selectedRouteId || null);
  }, [isChicagoTrainListMode, selectedRouteId]);

  const getPulseAnim = (id: string) => {
    if (!pulseAnims[id]) pulseAnims[id] = new Animated.Value(1);
    return pulseAnims[id];
  };

  const getPatternOptionLabel = (pattern: NonNullable<Route['patterns']>[number]) => {
    const start = pattern.firstStopName || pattern.terminal || '';
    const end = pattern.lastStopName || pattern.label || '';
    if (start && end) {
      return `${start} → ${end}`;
    }
    const destination = end || start || pattern.label;
    return destination.toLowerCase().startsWith('to ') ? destination : `To ${destination}`;
  };

  const getPatternEndpointLabels = (pattern: NonNullable<Route['patterns']>[number]) => ({
    start: pattern.firstStopName || pattern.terminal || '',
    end: pattern.lastStopName || pattern.label || '',
  });

  const handleSelectLine = (route: RoutePickerItem) => {
    const anim = getPulseAnim(route.id);
    Animated.sequence([
      Animated.spring(anim, {toValue: 1.15, tension: 200, friction: 8, useNativeDriver: true}),
      Animated.spring(anim, {toValue: 1, tension: 200, friction: 8, useNativeDriver: true}),
    ]).start();
    if (route.routes.length > 1) {
      setVariantPickerEntry(route);
      return;
    }
    const selectedRoute = route.routes[0];
    const patterns = selectedRoute?.patterns ?? [];
    if (isChicagoTrainListMode && patterns.length > 1) {
      setExpandedPatternRouteId(prev => (prev === route.id ? null : route.id));
      return;
    }
    onSelectLine(selectedRoute?.id ?? route.id, patterns[0]?.id);
  };

  return (
    <View style={[styles.stepContainer, styles.linePickerStepFull]}>
      {!hasLinkedDevice ? (
        <Pressable style={styles.noDeviceBar} onPress={onAddDevice}>
          <Text style={styles.noDeviceText}>No device linked — tap to add one</Text>
        </Pressable>
      ) : null}
      {!liveSupported ? (
        <View style={styles.liveDisabledCard}>
          <Text style={styles.liveDisabledTitle}>Live Transit Unavailable</Text>
          <Text style={styles.liveDisabledBody}>
            {CITY_LABELS[city]} does not support live stop and line lookups yet.
          </Text>
        </View>
      ) : null}
      <View style={styles.stepSection}>
        <Text style={styles.stepTitle}>{getLineStepTitle(city, selectedMode)}</Text>
        <Text style={styles.stepSubtitle}>{getLineStepSubtitle(city, selectedMode)}</Text>
      </View>
      {showSearch && !isLoading ? (
        <TextInput
          value={lineSearch}
          onChangeText={setLineSearch}
          placeholder="Search lines…"
          placeholderTextColor={colors.textMuted}
          style={styles.stepSearchInput}
          autoCorrect={false}
          autoCapitalize="characters"
        />
      ) : null}
      <ScrollView
        style={styles.linePickerListScroll}
        contentContainerStyle={styles.linePickerListContent}
        keyboardShouldPersistTaps="handled">
        {isLoading ? (
          <View style={styles.lineGridSkeleton}>
            {Array.from({length: 12}).map((_, i) => (
              <View key={i} style={styles.lineGridSkeletonTile} />
            ))}
          </View>
        ) : routes.length === 0 ? (
          <Text style={styles.sectionHint}>
            {lineSearch ? `No lines matching "${lineSearch}".` : 'No lines available for this mode.'}
          </Text>
        ) : (
          <View style={[styles.lineGroupList, isNycSubwayGrid && styles.lineGroupListSubway]}>
            {routeGroups.map(group => {
              const isCollapsed = isBusGrouped && !isSearchingLines && !!group.title && collapsedGroups.has(group.key);
              const hasSelected = group.routes.some(r => r.routes.some(item => item.id === selectedRouteId));
              const groupAccent: Record<string, string> = {
                bronx: '#A04D45', brooklyn: '#E8784A', manhattan: '#C4651A', queens: '#D1A27A', 'staten-island': '#8B775F',
                'silver-line': '#C4B4A4', crosstown: '#6F8B69', local: '#B25D2C', quincy: '#8F5A31', northwest: '#7A5B45',
                'north-shore': '#D18A3B', express: '#B5544C', other: colors.border,
              };
              const accentColor = groupAccent[group.key] ?? colors.border;
              return (
              <View key={group.key} style={[styles.lineGroup, isNycSubwayGrid && styles.lineGroupSubway]}>
                {group.title ? (
                  isBusGrouped ? (
                    <Pressable
                      style={[styles.boroughHeader, hasSelected && styles.boroughHeaderSelected]}
                      onPress={() => toggleGroup(group.key)}>
                      <View style={[styles.boroughAccentPip, {backgroundColor: accentColor}]} />
                      <Text style={[styles.boroughHeaderText, hasSelected && styles.boroughHeaderTextSelected]}>{group.title}</Text>
                      <Text style={styles.boroughHeaderMeta}>{group.routes.length} lines</Text>
                      <Text style={styles.boroughChevron}>{isCollapsed ? '›' : '⌄'}</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.lineGroupTitle}>{group.title}</Text>
                  )
                ) : null}
                {!isCollapsed ? (
                isBranchListMode ? (
                  <View style={styles.lirrBranchList}>
                    {group.routes.map(route => {
                      const isSelected = route.routes.some(item => item.id === selectedRouteId);
                      return (
                        <Pressable
                          key={route.id}
                          style={[
                            styles.lirrBranchRow,
                            {backgroundColor: route.color, borderColor: isSelected ? colors.text : route.color},
                            isSelected && styles.lirrBranchRowSelected,
                          ]}
                          onPress={() => handleSelectLine(route)}>
                          <Text
                            style={[
                              styles.lirrBranchName,
                              {color: route.textColor || colors.text},
                              isSelected && styles.lirrBranchNameSelected,
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}>
                            {route.displayLabel}
                          </Text>
                          {isSelected && <Text style={[styles.lirrBranchCheck, {color: route.textColor || colors.text}]}>✓</Text>}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : isChicagoTrainListMode ? (
                  <View style={styles.chicagoLineList}>
                    {group.routes.map(route => {
                      const isSelected = route.routes.some(item => item.id === selectedRouteId);
                      const selectedRoute = route.routes[0];
                      const patterns = selectedRoute?.patterns ?? [];
                      const showPatternOptions = patterns.length > 1 && expandedPatternRouteId === route.id;
                      const anim = getPulseAnim(route.id);
                      return (
                        <Animated.View
                          key={route.id}
                          style={[styles.chicagoLineOptionGroup, {transform: [{scale: anim}]}]}>
                          <Pressable
                            style={[
                              styles.chicagoLineRow,
                              {
                                backgroundColor: route.color,
                                borderColor: isSelected ? colors.text : route.color,
                              },
                              isSelected && styles.chicagoLineRowSelected,
                            ]}
                            onPress={() => handleSelectLine(route)}>
                            <Text
                              style={[
                                styles.chicagoLineRowText,
                                {color: route.textColor ?? colors.text},
                              ]}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.82}>
                              {route.label}
                            </Text>
                            {patterns.length > 1 ? (
                              <View
                                style={[
                                  styles.chicagoLineDropdownButton,
                                  {borderColor: route.textColor ?? colors.text},
                                ]}>
                                <Text
                                  style={[
                                    styles.chicagoLineRowChevron,
                                    {color: route.textColor ?? colors.text},
                                  ]}>
                                  {showPatternOptions ? '⌃' : '⌄'}
                                </Text>
                              </View>
                            ) : null}
                          </Pressable>
                          {showPatternOptions ? (
                            <View style={styles.chicagoPatternInlineList}>
                              {patterns.map(pattern => {
                                const active = selectedPatternId === pattern.id;
                                const {start, end} = getPatternEndpointLabels(pattern);
                                return (
                                  <Pressable
                                    key={pattern.id}
                                    style={[
                                      styles.chicagoPatternInlineOption,
                                      active && styles.chicagoPatternInlineOptionActive,
                                    ]}
                                    onPress={() => onSelectLine(selectedRoute?.id ?? route.id, pattern.id)}>
                                    <View style={styles.chicagoPatternOptionInner}>
                                      {start && end ? (
                                        <View style={styles.chicagoPatternRouteRow}>
                                          <Text
                                            style={styles.chicagoPatternEndpoint}
                                            numberOfLines={1}
                                            adjustsFontSizeToFit
                                            minimumFontScale={0.78}>
                                            {start}
                                          </Text>
                                          <Text style={styles.chicagoPatternArrow}>
                                            →
                                          </Text>
                                          <Text
                                            style={styles.chicagoPatternEndpoint}
                                            numberOfLines={1}
                                            adjustsFontSizeToFit
                                            minimumFontScale={0.78}>
                                            {end}
                                          </Text>
                                        </View>
                                      ) : (
                                        <Text
                                          style={styles.chicagoPatternInlineText}
                                          numberOfLines={1}
                                          adjustsFontSizeToFit
                                          minimumFontScale={0.84}>
                                          {getPatternOptionLabel(pattern)}
                                        </Text>
                                      )}
                                      <View style={[styles.chicagoPatternCheck, active && styles.chicagoPatternCheckActive]}>
                                        {active ? <Text style={styles.chicagoPatternCheckText}>✓</Text> : null}
                                      </View>
                                    </View>
                                  </Pressable>
                                );
                              })}
                            </View>
                          ) : null}
                        </Animated.View>
                      );
                    })}
                  </View>
                ) : isBostonRouteCardMode ? (
                  <View style={styles.bostonRouteCardList}>
                    {group.routes.map(route => {
                      const isSelected = route.routes.some(item => item.id === selectedRouteId);
                      const routeBadgeLabel = getLocalRouteBadgeLabel(city, selectedMode, route.id, route.label, route.shortName);
                      const title = getBostonRouteCardTitle(selectedMode, route);
                      const subtitle = getBostonRouteCardSubtitle(selectedMode, route);
                      const anim = getPulseAnim(route.id);
                      return (
                        <Animated.View
                          key={route.id}
                          style={{transform: [{scale: anim}]}}>
                          <Pressable
                            style={[styles.bostonRouteCard, isSelected && styles.bostonRouteCardActive]}
                            onPress={() => handleSelectLine(route)}>
                            <View
                              style={[
                                styles.bostonRouteCardAccent,
                                {backgroundColor: route.color},
                                isSelected && styles.bostonRouteCardAccentActive,
                              ]}
                            />
                            <View style={[styles.bostonRouteCardBadge, {backgroundColor: route.color}]}>
                              <Text
                                adjustsFontSizeToFit
                                minimumFontScale={0.72}
                                numberOfLines={1}
                                style={[
                                  styles.bostonRouteCardBadgeText,
                                  routeBadgeLabel.length >= 4 && styles.bostonRouteCardBadgeTextCompact,
                                  {color: route.textColor ?? colors.text},
                                ]}>
                                {routeBadgeLabel}
                              </Text>
                            </View>
                            <View style={styles.bostonRouteCardCopy}>
                              <Text style={[styles.bostonRouteCardTitle, isSelected && styles.bostonRouteCardTitleActive]}>
                                {title}
                              </Text>
                              {subtitle ? (
                                <Text
                                  style={[
                                    styles.bostonRouteCardSubtitle,
                                    isSelected && styles.bostonRouteCardSubtitleActive,
                                  ]}>
                                  {subtitle}
                                </Text>
                              ) : null}
                            </View>
                            <View style={[styles.choiceRowCheck, isSelected && styles.choiceRowCheckActive]}>
                              {isSelected ? <Text style={styles.choiceRowCheckText}>✓</Text> : null}
                            </View>
                          </Pressable>
                        </Animated.View>
                      );
                    })}
                  </View>
                ) : (
                <View
                  style={[
                    styles.lineGrid,
                    selectedMode === 'bus' && styles.lineGridBus,
                    isNycSubwayGrid && styles.lineGridSubway,
                    isWidePillMode && styles.lineGridChicagoTrain,
                  ]}>
                  {group.routes.map(route => {
                      const isSelected = route.routes.some(item => item.id === selectedRouteId);
                      const isBusBadge = isNycBusBadge(city, selectedMode);
                      const isChicagoTrainBadge = city === 'chicago' && selectedMode === 'train';
                      const isBostonWideBadge = city === 'boston' && selectedMode === 'train';
                      const isCommuterRailBadge = false;
                      const routeBadgeLabel = getLocalRouteBadgeLabel(city, selectedMode, route.id, route.label, route.shortName);
                      const isExpress = !isBusBadge && isExpressRouteBadge(city, selectedMode, route);
                      const useCompactBadgeText = isBusBadge && routeBadgeLabel.length >= 5;
                      const shouldAutoFitBadgeText = isBusBadge || isChicagoTrainBadge || isBostonWideBadge || isCommuterRailBadge || isExpress;
                      const anim = getPulseAnim(route.id);
                    return (
                      <Animated.View
                        key={route.id}
                        style={[
                          {transform: [{scale: anim}]},
                          isWidePillMode && styles.lineBadgeTileWrapChicagoTrain,
                        ]}>
                        <Pressable
                          style={[
                            styles.lineBadgeTile,
                            isBusBadge && styles.lineBadgeTileBus,
                            isNycSubwayGrid && styles.lineBadgeTileSubway,
                            isWidePillMode && styles.lineBadgeTileChicagoTrain,
                            isSelected && styles.lineBadgeTileActive,
                          ]}
                          onPress={() => handleSelectLine(route)}>
                            <View
                              style={[
                                styles.lineBadgeCircle,
                                isBusBadge && styles.lineBadgeBusPill,
                                (isChicagoTrainBadge || isBostonWideBadge) && styles.lineBadgeChicagoTrainPill,
                                isCommuterRailBadge && styles.lineBadgeCommuterRail,
                                {backgroundColor: route.color},
                                isExpress && styles.lineBadgeDiamond,
                              ]}>
                              <Text
                                adjustsFontSizeToFit={shouldAutoFitBadgeText}
                                minimumFontScale={0.74}
                                numberOfLines={isCommuterRailBadge ? 3 : 1}
                                style={[
                                  styles.lineBadgeText,
                                  isBusBadge && styles.lineBadgeBusText,
                                  (isChicagoTrainBadge || isBostonWideBadge) && styles.lineBadgeChicagoTrainText,
                                  isCommuterRailBadge && styles.lineBadgeCommuterRailText,
                                  useCompactBadgeText && styles.lineBadgeTextCompact,
                                  {color: route.textColor ?? colors.text},
                                  isExpress && styles.lineBadgeTextDiamond,
                                ]}>
                                {routeBadgeLabel}
                              </Text>
                            </View>
                          </Pressable>
                        </Animated.View>
                    );
                  })}
                </View>
                )) : null}
              </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      <SimplePicker
        visible={!!variantPickerEntry}
        options={(variantPickerEntry?.routes ?? []).map(route => ({
          id: route.id,
          label: isExpressVariant(route) ? `Express ${route.label}` : `Regular ${route.label}`,
          description: isExpressVariant(route)
            ? 'Faster pattern with fewer stops.'
            : 'Standard pattern with the regular stop sequence.',
        }))}
        value={selectedRouteId}
        onSelect={id => {
          setVariantPickerEntry(null);
          onSelectLine(id);
        }}
        onClose={() => setVariantPickerEntry(null)}
      />
    </View>
  );
}

function StopPickerStep({
  city,
  selectedMode,
  selectedRoute,
  stations,
  loading,
  selectedStationId,
  selectedRouteId,
  selectedDirection,
  search,
  onSearch,
  onSelectDirection,
  onSelectStation,
}: {
  city: CityId;
  selectedMode: ModeId;
  selectedRoute: Route | undefined;
  stations: Station[];
  loading: boolean;
  selectedStationId: string;
  selectedRouteId: string;
  selectedDirection: Direction;
  search: string;
  onSearch: (text: string) => void;
  onSelectDirection: (direction: Direction) => void;
  onSelectStation: (id: string) => void;
}) {
  const [expandedBoroughs, setExpandedBoroughs] = useState<Set<string>>(new Set());

  const handleSelect = (id: string) => {
    onSelectStation(id);
  };

  const toggleBorough = (area: string) => {
    setExpandedBoroughs(prev => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area); else next.add(area);
      return next;
    });
  };

  const term = search.trim().toLowerCase();
  const isBusGrouped = city === 'new-york' && selectedMode === 'bus';
  const hideDirectionToggle = city === 'chicago' && (selectedMode === 'bus' || selectedMode === 'train');
  const isChicagoTrainMode = city === 'chicago' && selectedMode === 'train';
  const isNycSubwayMode = city === 'new-york' && selectedMode === 'train';
  const isNycLirrMode = city === 'new-york' && selectedMode === 'lirr';
  const isNycBusMode = city === 'new-york' && selectedMode === 'bus';
  const isNycMnrMode = city === 'new-york' && selectedMode === 'mnr';
  const isPhiladelphiaTrainMode = city === 'philadelphia' && selectedMode === 'train';
  const isPhiladelphiaBusMode = city === 'philadelphia' && selectedMode === 'bus';
  const isPhiladelphiaTrolleyMode = city === 'philadelphia' && selectedMode === 'trolley';
  const isNjtTrainMode = city === 'new-jersey' && selectedMode === 'train';
  const isNjtBusMode = city === 'new-jersey' && selectedMode === 'bus';
  const isBostonTrainMode = city === 'boston' && selectedMode === 'train';
  const isBostonDirectionMode =
    city === 'boston' &&
    (selectedMode === 'train' || selectedMode === 'bus' || selectedMode === 'commuter-rail');
  const useWideDirectionToggle =
    isChicagoTrainMode ||
    isNycSubwayMode ||
    isNycLirrMode ||
    isNycBusMode ||
    isNycMnrMode ||
    isPhiladelphiaTrainMode ||
    isPhiladelphiaBusMode ||
    isPhiladelphiaTrolleyMode ||
    isNjtTrainMode ||
    isNjtBusMode ||
    isBostonTrainMode;
  const directionOptions = getLocalDirectionOptions(city, selectedMode, selectedRoute ?? selectedRouteId);

  const filtered = useMemo(() => {
    if (!term) return stations;
    return stations.filter(s =>
      s.name.toLowerCase().includes(term) || s.area?.toLowerCase().includes(term),
    );
  }, [stations, term]);

  const boroughGroups = useMemo(() => {
    if (!isBusGrouped || term) return null;
    const map: Record<string, Station[]> = {};
    for (const s of stations) {
      const area = s.area || 'Other';
      if (!map[area]) map[area] = [];
      map[area].push(s);
    }
    const ordered = BOROUGH_ORDER.filter(b => map[b]).map(b => ({area: b, stations: map[b]}));
    const rest = Object.entries(map).filter(([k]) => !BOROUGH_ORDER.includes(k)).map(([k, v]) => ({area: k, stations: v}));
    return [...ordered, ...rest];
  }, [stations, isBusGrouped, term]);

  return (
    <View style={[styles.stepContainer, styles.stopPickerStepFull]}>
      <View style={styles.stopPickerHeader}>
        {!hideDirectionToggle ? (
          <View style={[styles.stopPickerDirRow, useWideDirectionToggle && styles.stopPickerDirRowChicagoTrain]}>
            {directionOptions.map(dir => {
              const active = selectedDirection === dir;
              const label = getDirectionLabel(city, selectedMode, dir, selectedRoute ?? selectedRouteId);
              const terminal =
                getLocalDirectionTerminal(selectedRoute ?? selectedRouteId, dir)
                ?? getDirectionToggleLabel(city, selectedMode, dir, selectedRoute ?? selectedRouteId).split(': ')[1]
                ?? '';
              const terminalDisplayLabel = getDirectionTerminalDisplayLabel(label, terminal);
              return (
                <Pressable
                  key={dir}
                  style={[
                    styles.stopPickerDirPill,
                    useWideDirectionToggle && styles.stopPickerDirPillChicagoTrain,
                    active && styles.stopPickerDirPillActive,
                  ]}
                  onPress={() => onSelectDirection(dir)}>
                  <View style={styles.stopPickerDirCopy}>
                    <Text
                      style={[
                        styles.stopPickerDirText,
                        useWideDirectionToggle && styles.stopPickerDirTextChicagoTrain,
                        isBostonDirectionMode && styles.stopPickerDirTextBoston,
                        active && styles.stopPickerDirTextActive,
                      ]}
                      numberOfLines={1}>
                      {label}
                    </Text>
                    {terminalDisplayLabel ? (
                      <Text
                        style={[
                          styles.stopPickerDirTerminal,
                          active && styles.stopPickerDirTerminalActive,
                        ]}
                        numberOfLines={2}
                        ellipsizeMode="tail">
                        {terminalDisplayLabel}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <View style={styles.stepSearchField}>
        <Ionicons name="search-outline" size={18} color={colors.textTertiary} style={styles.stepSearchIcon} />
        <TextInput
          value={search}
          onChangeText={onSearch}
          placeholder="Search stops..."
          placeholderTextColor={colors.textTertiary}
          style={styles.stepSearchInputWithIcon}
        />
      </View>

      {loading ? (
        <Text style={styles.sectionHint}>Loading stops…</Text>
      ) : (
        <ScrollView style={styles.stopListFull} contentContainerStyle={styles.stopListContent} showsVerticalScrollIndicator={false}>
          {boroughGroups ? (
            boroughGroups.map(group => {
              const isExpanded = expandedBoroughs.has(group.area);
              const hasSelected = group.stations.some(s => s.id === selectedStationId);
              return (
                <View key={group.area}>
                  {group.area !== 'Other' ? (
                    <Pressable style={[styles.boroughHeader, hasSelected && styles.boroughHeaderSelected]} onPress={() => toggleBorough(group.area)}>
                      <Text style={[styles.boroughHeaderText, hasSelected && styles.boroughHeaderTextSelected]}>{group.area}</Text>
                      <Text style={styles.boroughHeaderMeta}>{group.stations.length} stops</Text>
                      <Text style={styles.boroughChevron}>{isExpanded ? '↑' : '↓'}</Text>
                    </Pressable>
                  ) : null}
                  {(group.area === 'Other' || isExpanded) ? group.stations.map(station => (
                    <StopRow
                      key={station.id}
                      station={station}
                      selected={station.id === selectedStationId}
                      accentColor={selectedRoute?.color}
                      onPress={() => handleSelect(station.id)}
                    />
                  )) : null}
                </View>
              );
            })
          ) : (
            <>
              {filtered.map(station => (
                <StopRow
                  key={station.id}
                  station={station}
                  selected={station.id === selectedStationId}
                  accentColor={selectedRoute?.color}
                  onPress={() => handleSelect(station.id)}
                />
              ))}
              {filtered.length === 0 ? <Text style={styles.sectionHint}>No stops found.</Text> : null}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function StopRow({
  station,
  selected,
  accentColor,
  onPress,
}: {
  station: Station;
  selected: boolean;
  accentColor?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.stopRow,
        accentColor ? {borderLeftColor: accentColor} : null,
        selected && styles.stopRowSelected,
      ]}
      onPress={onPress}>
      <View style={styles.stopRowInfo}>
        <Text style={styles.stationName}>{station.name}</Text>
        {station.area ? <Text style={styles.stationMeta}>{station.area}</Text> : null}
      </View>
      {!selected ? (
        <Text style={styles.chevron}>›</Text>
      ) : null}
    </Pressable>
  );
}

// ─── Wizard: LED Style Picker Step ───────────────────────────────────────────
// Tap = preview on fixed LED above. Confirm button locks in and advances.
function LedStylePickerStep({
  city,
  displayType,
  line,
  selectedRoute,
  selectedStation,
  onChangeLine,
  onPreview,
  onSelect,
}: {
  city: CityId;
  displayType: number;
  line: LinePick;
  selectedRoute: Route | undefined;
  selectedStation: Station | undefined;
  onChangeLine: (next: Partial<LinePick>) => void;
  onPreview: (preset: number) => void;
  onSelect: (preset: number) => void;
}) {
  const presetOptions = getDisplayPresetOptionsForMode(city, line.mode);
  const visibleDisplayType =
    presetOptions.some(option => option.id === displayType)
      ? displayType
      : (presetOptions[0]?.id ?? DEFAULT_DISPLAY_PRESET);
  const [localPreset, setLocalPreset] = useState(visibleDisplayType);
  const isTrainCountPreset = (id: number) => getPresetBehavior(id).displayFormat === 'times-line';
  const supportsDirectionContent = presetOptions.some(option => option.id === 2 || option.id === 5);
  const selectedArrivalCount = isTrainCountPreset(localPreset) ? Math.max(2, line.nextStops || 2) : 1;
  const selectedContent =
    localPreset === 2 || localPreset === 5
      ? 'direction'
      : localPreset === 3 || localPreset === 6
        ? 'destination'
        : 'station';
  const selectedStationLabel = selectedStation?.name?.trim() || 'Selected stop';
  const selectedPattern = getSelectedPatternForLine(selectedRoute, line);
  const selectedDirectionLabel = selectedPattern?.label ?? getDirectionLabel(city, line.mode, line.direction, selectedRoute ?? line.routeId);
  const selectedDirectionTerminal =
    selectedPattern?.terminal
    ?? getLocalDirectionTerminal(selectedRoute ?? line.routeId, line.direction)
    ?? getDirectionToggleLabel(city, line.mode, line.direction, selectedRoute ?? line.routeId).split(': ')[1]
    ?? '';
  const routeLabel = selectedRoute?.label ?? line.routeId ?? 'Route';
  const selectedDestinationLabel =
    selectedPattern?.lastStopName ??
    getHeadsignLabel(
      city,
      line.mode,
      line.direction,
      selectedRoute ?? line.routeId,
      routeLabel,
    );

  useEffect(() => {
    setLocalPreset(visibleDisplayType);
  }, [visibleDisplayType]);

  const getPresetIdForSelection = (
    content: 'station' | 'direction' | 'destination',
    arrivalCount: number,
  ) => {
    const useTimesLine = arrivalCount > 1;
    if (content === 'direction') return useTimesLine ? 5 : 2;
    if (content === 'destination') return useTimesLine ? 6 : 3;
    return useTimesLine ? 4 : 1;
  };

  const applyStyleSelection = (
    content: 'station' | 'direction' | 'destination',
    arrivalCount: number,
  ) => {
    const nextPreset = getPresetIdForSelection(content, arrivalCount);
    if (arrivalCount > 1 && line.nextStops !== arrivalCount) {
      onChangeLine({nextStops: arrivalCount});
    }
    onPreview(nextPreset);
    setLocalPreset(nextPreset);
    onSelect(nextPreset);
  };

  const contentOptions: Array<{
    id: 'station' | 'direction' | 'destination';
    label: string;
    value: string;
    description: string;
  }> = [
    {
      id: 'station',
      label: 'Your Station',
      value: selectedStationLabel,
      description: 'Shows the selected stop name on the LED.',
    },
    ...(supportsDirectionContent
      ? [{
          id: 'direction' as const,
          label: 'Direction',
          value: selectedDirectionLabel,
          description: 'Shows the direction you picked in the stop step.',
        }]
      : []),
    {
      id: 'destination',
      label: 'Destination',
      value: selectedDestinationLabel,
      description: 'Shows where the train or bus is going.',
    },
  ];

  return (
    <View style={styles.stepSection}>
      <Text style={styles.mockPreviewNote}>Note: Preview uses sample data for illustration only — ETA is estimated.</Text>
      <View style={styles.choiceList}>
        {contentOptions.map(option => {
          const isActive = selectedContent === option.id;
          return (
            <Pressable
              key={option.id}
              style={[styles.choiceRow, isActive && styles.choiceRowActive]}
              onPress={() => applyStyleSelection(option.id, selectedArrivalCount)}>
              <View style={styles.choiceRowCopy}>
                <Text style={[styles.choiceRowLabel, isActive && styles.choiceRowLabelActive]}>
                  {option.label}: {option.value}
                </Text>
                <Text style={[styles.choiceRowHint, isActive && styles.choiceRowHintActive]}>
                  {option.description}
                </Text>
              </View>
              <View style={[styles.choiceRowCheck, isActive && styles.choiceRowCheckActive]}>
                {isActive ? <Text style={styles.choiceRowCheckText}>✓</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.inlineCountPicker}>
        <Text style={styles.inlineCountLabel}>How many arrival times should be shown?</Text>
        <View style={styles.inlineCountRow}>
          {[1, 2, 3].map(count => {
            const countActive = selectedArrivalCount === count;
            const countLabel =
              count === 1
                ? '1 time'
                : `${count} times`;
            return (
              <Pressable
                key={count}
                style={[styles.inlineCountChip, countActive && styles.inlineCountChipActive]}
                onPress={() => applyStyleSelection(selectedContent, count)}>
                <Text style={[styles.inlineCountChipText, countActive && styles.inlineCountChipTextActive]}>
                  {countLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── Wizard: Review & Save Step ───────────────────────────────────────────────
// Step 4 — name, review summary, settings, save via SaveBar
// The LED preview is fixed above (in the parent), so no internal preview here.
function WizardReviewStep({
  city,
  line,
  displayPreset,
  selectedRoute,
  selectedStation,
  presetName,
  displayMetadata,
  onChangeLine,
  onClearLine,
  onClearStop,
  onClearDisplayType,
  onPresetNameChange,
  onBrightnessChange,
  onScrollingChange,
}: {
  city: CityId;
  line: LinePick;
  displayPreset: number;
  selectedRoute: Route | undefined;
  selectedStation: Station | undefined;
  presetName: string;
  displayMetadata: {brightness: number; scrolling: boolean; paused: boolean; priority: number; sortOrder: number};
  onChangeLine: (next: Partial<LinePick>) => void;
  onClearLine: () => void;
  onClearStop: () => void;
  onClearDisplayType: () => void;
  onPresetNameChange: (name: string) => void;
  onBrightnessChange: (brightness: number) => void;
  onScrollingChange: (scrolling: boolean) => void;
}) {
  const activePresetBehavior = getPresetBehavior(displayPreset);

  return (
    <View style={styles.wizardReviewContainer}>



      {/* Custom text */}
      <View style={styles.wizardSection}>
        <Text style={styles.wizardSectionLabel}>Custom Label Text (Optional)</Text>
        <View style={styles.wizardCard}>
          <View style={styles.wizardCardPadded}>
            <Text style={styles.wizardFieldLabel}>Top Line</Text>
            <TextInput
              value={line.label}
              onChangeText={text =>
                onChangeLine({
                  label: text,
                  primaryContent: text.trim().length > 0 ? 'custom' : activePresetBehavior.primaryContent,
                })
              }
              placeholder="Leave blank for default"
              placeholderTextColor={colors.textMuted}
              style={styles.wizardFieldInput}
              returnKeyType="done"
            />
          </View>
          {activePresetBehavior.supportsBottomCustom ? (
            <>
              <View style={styles.wizardCardDivider} />
              <View style={styles.wizardCardPadded}>
                <Text style={styles.wizardFieldLabel}>Bottom Line</Text>
                <TextInput
                  value={line.secondaryLabel}
                  onChangeText={text =>
                    onChangeLine({
                      secondaryLabel: text,
                      secondaryContent: text.trim().length > 0 ? 'custom' : activePresetBehavior.secondaryContent,
                    })
                  }
                  placeholder="Leave blank for default"
                  placeholderTextColor={colors.textMuted}
                  style={styles.wizardFieldInput}
                  returnKeyType="done"
                />
              </View>
            </>
          ) : null}
        </View>
      </View>

      {/* Settings */}
      <View style={styles.wizardSection}>
        <Text style={styles.wizardSectionLabel}>Settings</Text>
        <View style={styles.wizardCard}>
          {/* Brightness */}
          <View style={styles.wizardSettingRow}>
            <Text style={styles.wizardSettingLabel}>Brightness</Text>
            <View style={styles.wizardStepper}>
              <Pressable
                style={[styles.wizardStepperBtn, displayMetadata.brightness <= MIN_BRIGHTNESS && styles.wizardStepperBtnDisabled]}
                disabled={displayMetadata.brightness <= MIN_BRIGHTNESS}
                onPress={() => onBrightnessChange(Math.max(MIN_BRIGHTNESS, displayMetadata.brightness - 10))}>
                <Text style={styles.wizardStepperBtnText}>−</Text>
              </Pressable>
              <Text style={styles.wizardStepperValue}>{displayMetadata.brightness}%</Text>
              <Pressable
                style={[styles.wizardStepperBtn, displayMetadata.brightness >= MAX_BRIGHTNESS && styles.wizardStepperBtnDisabled]}
                disabled={displayMetadata.brightness >= MAX_BRIGHTNESS}
                onPress={() => onBrightnessChange(Math.min(MAX_BRIGHTNESS, displayMetadata.brightness + 10))}>
                <Text style={styles.wizardStepperBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.wizardCardDivider} />
          {/* Label overflow */}
          <View style={styles.wizardSettingRow}>
            <Text style={styles.wizardSettingLabel}>Label Overflow</Text>
            <View style={styles.wizardSegmented}>
              {[
                {id: 'truncate', label: 'Cut Off', active: !line.scrolling},
                {id: 'scroll', label: 'Scroll', active: line.scrolling},
              ].map(opt => (
                <Pressable
                  key={opt.id}
                  style={[styles.wizardSegment, opt.active && styles.wizardSegmentActive]}
                  onPress={() => onScrollingChange(opt.id === 'scroll')}>
                  <Text style={[styles.wizardSegmentText, opt.active && styles.wizardSegmentTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
