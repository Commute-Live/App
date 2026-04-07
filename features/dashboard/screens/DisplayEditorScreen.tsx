import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Animated, Easing, Keyboard, KeyboardAvoidingView, LayoutAnimation, Modal, Platform, Pressable, ScrollView, Text, TextInput, UIManager, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
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
  cycleTimeOption,
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
type EditorStep = 'city' | 'format' | 'lines' | 'stops' | 'done';
type WizardStepDef = {id: EditorStep; label: string; complete: boolean; reachable: boolean};

const DEFAULT_TEXT_COLOR = colors.text;
const BOROUGH_ORDER = ['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island'];
const DEFAULT_NEXT_STOPS = 3;
const MIN_NEXT_STOPS = 1;
const MAX_NEXT_STOPS = 5;
const DEFAULT_LAYOUT_SLOTS = 1;
const DEFAULT_DISPLAY_PRESET = 1;
const DEFAULT_BRIGHTNESS = 40;
const MIN_BRIGHTNESS = 10;
const MAX_BRIGHTNESS = 100;
const MIN_STEP_SWIPE_DISTANCE = 56;
const TIME_OPTIONS = ['00:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '17:00', '18:00', '20:00', '22:00', '23:00'];
const DAY_OPTIONS = [
  {id: 'mon', label: 'M'},
  {id: 'tue', label: 'T'},
  {id: 'wed', label: 'W'},
  {id: 'thu', label: 'T'},
  {id: 'fri', label: 'F'},
  {id: 'sat', label: 'S'},
  {id: 'sun', label: 'S'},
] as const;
type DayId = (typeof DAY_OPTIONS)[number]['id'];
const LAYOUT_OPTIONS = [
  {id: 'layout-1', slots: 1, label: '1 line'},
  {id: 'layout-2', slots: 2, label: '2 lines'},
];
const withHexAlpha = (color: string, alpha: string) => (/^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color);
const getCityAgencyPillPalette = (city: CityId) => {
  const brand = CITY_BRANDS[city];

  if (city === 'new-york') {
    return {
      borderColor: brand.badgeBorder,
      textColor: colors.previewText,
      backgroundColor: withHexAlpha(brand.badgeBg, '38'),
    };
  }

  return {
    borderColor: brand.accent,
    textColor: brand.accent,
    backgroundColor: withHexAlpha(brand.accent, '16'),
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

const DISPLAY_PRESET_OPTIONS = [
  {id: 1, label: 'Your Station', description: 'The selected station on the left, next arrival on the right.'},
  {id: 2, label: 'Direction', description: 'Uptown or Downtown on the left, next arrival on the right.'},
  {id: 3, label: 'Destination', description: 'Route destination on the left, next arrival on the right.'},
  {id: 4, label: 'Your Station + Upcoming Trains', description: 'Selected station with upcoming arrivals.'},
  {id: 5, label: 'Direction + Upcoming Trains', description: 'Travel direction with upcoming arrivals.'},
  {id: 6, label: 'Destination + Upcoming Trains', description: 'Route destination with upcoming arrivals.'},
] as const;
const PRESET_CAROUSEL_ITEM_WIDTH = 292;
const Haptics = {selectionAsync: async () => {}, notificationAsync: async (_: any) => {}};

const isNewYorkRailDestinationOnlyMode = (city: CityId, mode: ModeId) =>
  city === 'new-york' && (mode === 'lirr' || mode === 'mnr');

const getDisplayPresetOptionsForMode = (city: CityId, mode: ModeId) =>
  isNewYorkRailDestinationOnlyMode(city, mode)
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
  if (city === 'new-jersey' && (mode === 'train' || mode === 'bus')) {
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

const getPresetIdForOffset = (
  offsetX: number,
  presetOptions: readonly (typeof DISPLAY_PRESET_OPTIONS)[number][] = DISPLAY_PRESET_OPTIONS,
) => {
  const nextIndex = Math.round(offsetX / PRESET_CAROUSEL_ITEM_WIDTH);
  const safeIndex = Math.max(0, Math.min(presetOptions.length - 1, nextIndex));
  return presetOptions[safeIndex]?.id ?? presetOptions[0]?.id ?? DISPLAY_PRESET_OPTIONS[0].id;
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
  {id: 'lines', label: isLirr ? 'Branch' : 'Line', complete: hasLine, reachable: true},
  {id: 'stops', label: isLirr ? 'Station' : 'Stop', complete: hasStop, reachable: hasLine},
  {id: 'format', label: 'Style', complete: hasPreset, reachable: hasLine && hasStop},
  {id: 'done', label: 'Save', complete: false, reachable: hasLine && hasStop && hasPreset},
];

const WIZARD_STEP_DEFAULT_COLOR = colors.accent;
const WIZARD_STEP_ACTIVE_COLOR = colors.editorStepComplete;

export default function DisplayEditorScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const {state: appState, setPreset, setSelectedStations, setArrivals: setAppArrivals, setSelectedCity} = useAppState();
  const params = useLocalSearchParams<{city?: string; from?: string; mode?: string; displayId?: string}>();
  const initialCity = normalizeCityIdParam(params.city ?? appState.selectedCity);
  const isCreateMode = params.mode === 'new';
  const [editorCity, setEditorCity] = useState<CityId>(initialCity);
  const city = editorCity;
  const fallbackRoute = params.from === 'presets' ? '/presets' : '/dashboard';
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
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [customDisplayScheduleEnabled, setCustomDisplayScheduleEnabled] = useState(false);
  const [displaySchedule, setDisplaySchedule] = useState({start: '06:00', end: '09:00'});
  const [displayDays, setDisplayDays] = useState<DayId[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
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
  const stationsByLineRef = useRef(new Set<string>());
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
    setEditorStep('lines');
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
    stationsByLineRef.current.clear();
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
    const requestedModes = [...new Set(lines.map(line => normalizeMode(city, line.mode)))];
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

  useEffect(() => {
    if (!liveSupported) return;
    const pending = lines
      .map(line => ({mode: normalizeMode(city, line.mode), routeId: line.routeId}))
      .filter(item => item.routeId.length > 0);

    pending.forEach(item => {
      const key = `${city}:${item.mode}:${item.routeId}`;
      if (stationsByLineRef.current.has(key)) return;
      stationsByLineRef.current.add(key);
      setStationsLoadingByLine(prev => ({...prev, [item.routeId]: true}));
      void queryClient.fetchQuery({
        queryKey: queryKeys.transitStopsForLine(city, item.mode, item.routeId),
        queryFn: () => loadStopsForLine(city, item.mode, item.routeId),
      })
        .then(stations => setStationsByLine(prev => ({...prev, [item.routeId]: stations})))
        .catch(() => setStationsByLine(prev => ({...prev, [item.routeId]: []})))
        .finally(() => setStationsLoadingByLine(prev => ({...prev, [item.routeId]: false})));
    });
  }, [city, lines, liveSupported, queryClient]);

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
        const nextLayoutSlots = citySavedLines.length > 1 ? 2 : 1;
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

        const hasCustomSchedule =
          !!sourceDisplay.scheduleStart ||
          !!sourceDisplay.scheduleEnd ||
          (Array.isArray(sourceDisplay.scheduleDays) && sourceDisplay.scheduleDays.length > 0);
        setCustomDisplayScheduleEnabled(hasCustomSchedule);
        setDisplaySchedule({
          start: sourceDisplay.scheduleStart ?? '06:00',
          end: sourceDisplay.scheduleEnd ?? '09:00',
        });
        setDisplayDays(
          Array.isArray(sourceDisplay.scheduleDays) && sourceDisplay.scheduleDays.length > 0
            ? sourceDisplay.scheduleDays
            : ['mon', 'tue', 'wed', 'thu', 'fri'],
        );

        if (!cancelled) {
          setLayoutSlots(nextLayoutSlots);
        }

        if (citySavedLines.length > 0) {
          const restoredLines: LinePick[] = citySavedLines.slice(0, 2).map((saved: any, i: number) => {
            const displayFormat = normalizeDisplayFormat(saved.displayFormat);
            const mapping = cityModeFromSavedLine(saved);
            const mode: ModeId = mapping?.mode ?? 'train';
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
              routeId: saved.line,
              direction: dir,
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
          const nextCustomScheduleEnabled =
            !!sourceDisplay.scheduleStart ||
            !!sourceDisplay.scheduleEnd ||
            (Array.isArray(sourceDisplay.scheduleDays) && sourceDisplay.scheduleDays.length > 0);
          const nextDisplaySchedule = {
            start: sourceDisplay.scheduleStart ?? '06:00',
            end: sourceDisplay.scheduleEnd ?? '09:00',
          };
          const nextDisplayDays =
            Array.isArray(sourceDisplay.scheduleDays) && sourceDisplay.scheduleDays.length > 0
              ? sourceDisplay.scheduleDays
              : ['mon', 'tue', 'wed', 'thu', 'fri'];
          const nextPresetName =
            typeof sourceDisplay.name === 'string' && sourceDisplay.name.trim().length > 0
              ? sourceDisplay.name
              : 'Display 1';
          setLines(nextLines);
          setCustomDisplayScheduleEnabled(nextCustomScheduleEnabled);
          setDisplaySchedule(nextDisplaySchedule);
          setDisplayDays(nextDisplayDays);
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
            displaySchedule: nextDisplaySchedule,
            displayDays: nextDisplayDays,
            presetName: nextPresetName,
            customDisplayScheduleEnabled: nextCustomScheduleEnabled,
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
    // Run once on mount when device is known
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        .map(line => `${line.id}:${line.mode}:${line.stationId}:${line.routeId}:${line.direction}`)
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
    displaySchedule,
    displayDays,
    presetName,
    customDisplayScheduleEnabled,
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
      snap.customDisplayScheduleEnabled !== customDisplayScheduleEnabled ||
      snap.scrolling !== displayMetadata.scrolling ||
      snap.brightness !== displayMetadata.brightness ||
      snap.displaySchedule.start !== displaySchedule.start ||
      snap.displaySchedule.end !== displaySchedule.end ||
      JSON.stringify(snap.displayDays) !== JSON.stringify(displayDays) ||
      JSON.stringify(snap.lines) !== JSON.stringify(lines)
    );
  }, [city, customDisplayScheduleEnabled, displayDays, displayMetadata.brightness, displayMetadata.scrolling, displayPresetsByLine, displaySchedule.end, displaySchedule.start, layoutSlots, lines, presetName]);

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

        return {
          ...(direction ? {direction} : {}),
          provider,
          providerMode,
          line: line.routeId,
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
      scheduleStart: customDisplayScheduleEnabled ? displaySchedule.start : null,
      scheduleEnd: customDisplayScheduleEnabled ? displaySchedule.end : null,
      scheduleDays: customDisplayScheduleEnabled ? displayDays : [],
      config: {
        brightness: displayMetadata.brightness,
        displayType: getPersistedDisplayType(displayPresetsByLine['line-1'] ?? DEFAULT_DISPLAY_PRESET),
        scrolling: displayMetadata.scrolling,
        arrivalsToDisplay: getPersistedArrivalsToDisplay(payloadLines),
        lines: payloadLines,
      },
    };
  }, [city, customDisplayScheduleEnabled, displayDays, displayMetadata.brightness, displayMetadata.paused, displayMetadata.priority, displayMetadata.scrolling, displayMetadata.sortOrder, displayPresetsByLine, displaySchedule.end, displaySchedule.start, lines, linesByMode, presetName, routesByStation, stationsByLine, stationsByMode]);

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
        let payloadToSave = saveDraftPayload;
        if (!editingDisplayId) {
          const cachedDisplays =
            queryClient.getQueryData<{displays: DeviceDisplay[]; activeDisplayId: string | null}>(
              queryKeys.displays(selectedDevice.id),
            ) ?? (await fetchDisplays(selectedDevice.id));
          const nextSortOrder =
            cachedDisplays.displays.length > 0
              ? Math.max(...cachedDisplays.displays.map(display => display.sortOrder)) + 1
              : 0;
          payloadToSave = {
            ...saveDraftPayload,
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
        displaySchedule,
        displayDays,
        presetName,
        customDisplayScheduleEnabled,
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
            const directionDestination = getRouteHeadsign(city, mode, route, line.direction);
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
            pathname: '/presets',
            params: {focusDisplayId: savedDisplayId},
          });
          return;
        }
        router.replace('/presets');
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
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    handleBackPress();
  };

  const applyLayout = (slots: number) => {
    animateSectionLayout();
    const safeSlots = slots === 1 ? 1 : 2;
    const nextLines =
      safeSlots === layoutSlots
        ? lines
        : safeSlots === 2 && layoutSlots === 1
          ? ensureLineCount(lines, city, 2, stationsByMode, routesByStation).map((line, index) =>
              index === 1
                ? normalizeLine(
                    city,
                    {
                      ...line,
                      routeId: '',
                      stationId: '',
                      label: '',
                      secondaryLabel: '',
                      primaryContent: 'destination',
                      secondaryContent: 'direction',
                    },
                    stationsByMode,
                    routesByStation,
                  )
                : line,
            )
          : ensureLineCount(lines, city, safeSlots, stationsByMode, routesByStation);

    if (safeSlots !== layoutSlots) {
      setLayoutSlots(safeSlots);
      setLines(nextLines);
      if (safeSlots === 2 && layoutSlots === 1) {
        setDisplayPresetsByLine(prev => {
          const next = {...prev};
          delete next['line-2'];
          return next;
        });
      }
    }

    const nextSelectedLineId =
      selectedLineId && nextLines.some(line => line.id === selectedLineId)
        ? selectedLineId
        : nextLines[0]?.id ?? 'line-1';
    const nextSelectedLine = nextLines.find(line => line.id === nextSelectedLineId);

    setSelectedLineId(nextSelectedLineId);
    setEditorStep(resolveEditorStepForLine(nextSelectedLine ?? null));

    void Haptics.selectionAsync();
  };

  const expandToTwoStops = () => {
    animateSectionLayout();
    const seededLines = ensureLineCount(lines, city, 2, stationsByMode, routesByStation).map((line, index) =>
      index === 1
        ? normalizeLine(
            city,
            {
              ...line,
              routeId: '',
              stationId: '',
              label: '',
              secondaryLabel: '',
              primaryContent: 'destination',
              secondaryContent: 'direction',
            },
            stationsByMode,
            routesByStation,
          )
        : line,
    );
    const nextLines = seededLines;
    const nextLine = nextLines[1] ?? nextLines[0];
    setLayoutSlots(2);
    setLines(nextLines);
    setDisplayPresetsByLine(prev => {
      const next = {...prev};
      delete next['line-2'];
      return next;
    });
    setSelectedLineId(nextLine?.id ?? 'line-2');
    setEditorStep(resolveEditorStepForLine(nextLine ?? null));
    void Haptics.selectionAsync();
  };

  const removeStopFromLayout = (id: string) => {
    if (layoutSlots < 2) return;
    animateSectionLayout();
    const remaining = lines.find(line => line.id !== id) ?? lines[0];
    const normalizedRemaining = normalizeLine(city, {...remaining, id: 'line-1'}, stationsByMode, routesByStation);
    const nextLines = ensureLineCount([normalizedRemaining], city, 1, stationsByMode, routesByStation);
    const preservedPreset = displayPresetsByLine[remaining.id];
    setLayoutSlots(1);
    setLines(nextLines);
    setDisplayPresetsByLine(preservedPreset != null ? {'line-1': preservedPreset} : {});
    setSelectedLineId('line-1');
    setEditorStep(resolveEditorStepForLine(nextLines[0] ?? null));
    void Haptics.selectionAsync();
  };

  const advanceToNextSlotIfNeeded = (completedLineId: string) => {
    if (layoutSlots < 2 || completedLineId !== lines[0]?.id) return false;

    const nextLine = lines[1];
    if (!nextLine || (nextLine.routeId && nextLine.stationId)) return false;

    setSelectedLineId(nextLine.id);
    setEditorStep(resolveEditorStepForLine(nextLine));
    return true;
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
    updateLine(id, {routeId: '', stationId: ''});
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

  const toggleScheduleEditor = () => {
    animateSectionLayout();
    setScheduleExpanded(prev => !prev);
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
        const arrival = arrivals.find(item => item.lineId === line.id);

        const isSelectedLine = line.id === selectedLineId;
        const confirmedPreset = displayPresetsByLine[line.id] ?? DEFAULT_DISPLAY_PRESET;
        const displayPreset = editorStep === 'format' && isSelectedLine && liveDisplayType !== null ? liveDisplayType : confirmedPreset;

        const etaMinutes = arrival?.minutes != null ? Math.max(0, Math.round(arrival.minutes)) : null;
        // Use mock values when in format step so all styles are visible
        const mockEta = editorStep === 'format' && isSelectedLine;
        const hideEtaDuringSetup = editorStep === 'lines' || editorStep === 'stops';
        const etaText = mockEta ? '3m' : hideEtaDuringSetup ? '--' : etaMinutes != null ? `${etaMinutes}m` : '--';
        const etaListText = mockEta
          ? buildNextArrivalTimes(3, line.nextStops).join(', ')
          : buildNextArrivalTimes(etaMinutes ?? 2, line.nextStops).join(', ');
        const routePreviewLabel = route?.label ?? line.routeId ?? '';
        const directionLabel = getDirectionCueLabel(city, safeMode, line.direction, route ?? line.routeId);
        const headsignLabel = getHeadsignLabel(city, safeMode, line.direction, route ?? line.routeId, routePreviewLabel);
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
            : displayPreset === 4 || displayPreset === 5 || displayPreset === 6
                ? etaListText
                : undefined;
        const previewSubLineColor =
          displayPreset === 4 || displayPreset === 5 || displayPreset === 6 ? colors.highlight : undefined;

        const badgeShape: Display3DSlot['badgeShape'] =
          city === 'new-york' && safeMode === 'train'
            ? 'circle'
            : 'pill';

        return {
          id: line.id,
          color: route?.color ?? colors.border,
          textColor: line.textColor || route?.textColor || colors.text,
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
          subLine: previewSubLine,
          subLineColor: previewSubLineColor,
          times: etaText,
        };
      }),
    [arrivals, city, displayPresetsByLine, editorStep, lines, linesByMode, liveDisplayType, routesByStation, selectedLineId, stationsByLine, stationsByMode],
  );

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
    ? (routesByStation[routeLookupKey(normalizeMode(city, selectedLine.mode), selectedLine.stationId)] ?? []).find(
      r => r.id === selectedLine.routeId,
    ) ?? (linesByMode[normalizeMode(city, selectedLine.mode)] ?? []).find(r => r.id === selectedLine.routeId)
    : undefined;
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
  const canSwipeBetweenSteps = true;
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
              if (targetStep === 'lines') { setEditorStep('lines'); return; }
              if (targetStep === 'stops' && selectedLine.routeId) { setEditorStep('stops'); return; }
              if (targetStep === 'format' && selectedLine.routeId && selectedLine.stationId) { setEditorStep('format'); return; }
              if (targetStep === 'done' && selectedLine.routeId && selectedLine.stationId && selectedLinePresetConfirmed) { setEditorStep('done'); return; }
            }}
          />
        </Animated.View>

        {/* ── Fixed preview — always visible, never scrolls ─────────────── */}
        {editorStep !== 'city' ? (
          <Animated.View style={[styles.wizardFixedPreview, previewAnimatedStyle]}>
            <DashboardPreviewSection
              slots={previewSlots}
              displayType={getPersistedDisplayType(liveDisplayType)}
              onSelectSlot={handleSelectSlotForEdit}
              onReorderSlot={reorderLineByHold}
              onDragStateChange={setPreviewDragging}
              showHint={false}
            />
          </Animated.View>
        ) : null}

        {editorStep === 'city' ? (
          <Animated.View style={[stepAnimatedStyle, styles.linePickerFullScreen]}>
            <CityPickerStep selectedCity={city} onSelectCity={handleCitySelect} />
          </Animated.View>
        ) : null}

        {/* ── Stop picker — fixed layout, lives outside the scroll view ── */}
        {editorStep === 'stops' && selectedLine ? (
          <Animated.View style={[stepAnimatedStyle, styles.stopPickerFullScreen]}>
            <StopPickerStep
              city={city}
              selectedMode={normalizeMode(city, selectedLine.mode)}
              selectedRoute={selectedRouteForEditor}
              stations={stationsByLine[selectedLine.routeId] ?? []}
              loading={!!stationsLoadingByLine[selectedLine.routeId]}
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

        {editorStep === 'lines' && selectedLine ? (
          <Animated.View style={[stepAnimatedStyle, styles.linePickerFullScreen]}>
            <LinePickerStep
              city={city}
              selectedMode={normalizeMode(city, selectedLine.mode)}
              linesByMode={linesByMode}
              linesLoadingByMode={linesLoadingByMode}
              selectedRouteId={selectedLine.routeId}
              hasLinkedDevice={hasLinkedDevice}
              liveSupported={liveSupported}
              onModeChange={mode => updateLine(selectedLine.id, {mode, stationId: '', routeId: ''})}
              onSelectLine={routeId => {
                updateLine(selectedLine.id, {routeId, stationId: ''});
                setEditorStep('stops');
              }}
              onAddDevice={() => router.push('/register-device')}
            />
          </Animated.View>
        ) : null}

        {/* ── Scrollable step content (format/save only) ─────────────────── */}
        {editorStep !== 'city' && editorStep !== 'stops' && editorStep !== 'lines' ? (
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
                  presetConfirmed={selectedLinePresetConfirmed}
                  selectedRoute={selectedRouteForEditor}
                  selectedStation={selectedStationForEditor}
                  presetName={presetName}
                  displayMetadata={displayMetadata}
                  customScheduleEnabled={customDisplayScheduleEnabled}
                  displaySchedule={displaySchedule}
                  displayDays={displayDays}
                  scheduleExpanded={scheduleExpanded}
                  layoutSlots={layoutSlots}
                  onChangeLine={next => updateLine(selectedLine.id, next)}
                  onClearLine={() => clearLineSelection(selectedLine.id)}
                  onClearStop={() => clearStopSelection(selectedLine.id)}
                  onClearDisplayType={() => clearDisplayPreset(selectedLine.id)}
                  onPresetNameChange={setPresetName}
                  onBrightnessChange={brightness => setDisplayMetadata(prev => ({...prev, brightness}))}
                  onScrollingChange={scrolling => updateLine(selectedLine.id, {scrolling})}
                  onScheduleEnabledChange={() => setCustomDisplayScheduleEnabled(prev => !prev)}
                  onScheduleStartChange={start => setDisplaySchedule(prev => ({...prev, start}))}
                  onScheduleEndChange={end => setDisplaySchedule(prev => ({...prev, end}))}
                  onToggleDay={day => setDisplayDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                  onToggleScheduleExpanded={toggleScheduleEditor}
                  onExpandToTwoStops={expandToTwoStops}
                  onRemoveStop={() => removeStopFromLayout(selectedLine.id)}
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
                setShowLayoutSelector(false);
                if (layoutSlots === 2 && slots === 1 && selectedLineId === 'line-2') {
                  removeStopFromLayout('line-2');
                  return;
                }
                applyLayout(slots);
              }}
            />
          </SafeAreaView>
      </PanGestureHandler>
    </GestureHandlerRootView>
  );
}

function TopBar({
  layoutSlots,
  presetName,
  onPresetNameChange,
  onLayoutOpen,
  onBackPress,
}: {
  layoutSlots: number;
  presetName: string;
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

        <View style={styles.topBarSideRight}>
          <Pressable style={styles.layoutPillTopRight} onPress={onLayoutOpen}>
            <Text style={styles.layoutPillTopRightText}>{layoutSlots === 1 ? '1 line' : '2 lines'}</Text>
            <Text style={styles.layoutPillChevron}>⌄</Text>
          </Pressable>
        </View>
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
      <Text style={styles.stepSubtitle}>Pick which transit provider family this display should use.</Text>
      <View style={styles.cityPickerList}>
        {CITY_OPTIONS.map(option => {
          const active = option.id === selectedCity;
          const brand = CITY_BRANDS[option.id];
          const pillPalette = getCityAgencyPillPalette(option.id);
          return (
            <Pressable
              key={option.id}
              style={[
                styles.cityPickerCard,
                !active && {
                  borderColor: withHexAlpha(brand.badgeBorder, '8A'),
                  backgroundColor: withHexAlpha(brand.badgeBg, '14'),
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
                        backgroundColor: active
                          ? option.id === 'new-york'
                            ? withHexAlpha(brand.badgeBg, '52')
                            : brand.accentSoft
                          : pillPalette.backgroundColor,
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
                  <Text style={[styles.cityPickerTitle, active && styles.cityPickerTitleActive]}>
                    {option.label}
                  </Text>
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
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.layoutSelectorOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Number of Lines</Text>
            <Pressable style={styles.modalCloseButton} onPress={onClose}>
              <Text style={styles.modalCloseButtonText}>X</Text>
            </Pressable>
          </View>
          {[1, 2].map(option => {
            const active = option === layoutSlots;
            return (
              <Pressable
                key={option}
                style={[styles.modalOption, active && styles.modalOptionActive]}
                onPress={() => onSelect(option)}>
                <Text style={[styles.modalOptionText, active && styles.modalOptionTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
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

function RouteGridPicker({
  routes,
  selected,
  onToggle,
}: {
  routes: Route[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <View style={styles.routeGrid}>
      {routes.map(route => {
        const active = selected.includes(route.id);
        return (
          <Pressable
            key={route.id}
            style={[styles.routeTile, active && styles.routeTileActive]}
            onPress={() => onToggle(route.id)}>
            <View style={[styles.routeCircle, {backgroundColor: route.color}]}>
              <Text style={[styles.routeCircleText, {color: route.textColor ?? colors.text}]}>{route.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function ScheduleTimingEditor({
  start,
  end,
  days,
  onStartChange,
  onEndChange,
  onToggleDay,
}: {
  start: string;
  end: string;
  days: DayId[];
  onStartChange: (next: string) => void;
  onEndChange: (next: string) => void;
  onToggleDay: (day: DayId) => void;
}) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionHint}>Choose when this display is allowed to show.</Text>
      <View style={styles.dayPillRow}>
        {DAY_OPTIONS.map(day => {
          const active = days.includes(day.id);
          return (
            <Pressable
              key={day.id}
              style={[styles.dayPill, active && styles.dayPillActive]}
              onPress={() => onToggleDay(day.id)}>
              <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>{day.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.timeRangeRow}>
        <TimeStepper
          label="From"
          value={start}
          onPrev={() => onStartChange(cycleTimeOption(start, -1))}
          onNext={() => onStartChange(cycleTimeOption(start, 1))}
        />
        <TimeStepper
          label="To"
          value={end}
          onPrev={() => onEndChange(cycleTimeOption(end, -1))}
          onNext={() => onEndChange(cycleTimeOption(end, 1))}
        />
      </View>
    </View>
  );
}

function TimeStepper({
  label,
  value,
  onPrev,
  onNext,
}: {
  label: string;
  value: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View style={styles.timeStepper}>
      <Text style={styles.timeStepperLabel}>{label}</Text>
      <View style={styles.timeStepperControls}>
        <Pressable style={styles.timeAdjustButton} onPress={onPrev}>
          <Text style={styles.timeAdjustButtonText}>-</Text>
        </Pressable>
        <Text style={styles.timeValue}>{value}</Text>
        <Pressable style={styles.timeAdjustButton} onPress={onNext}>
          <Text style={styles.timeAdjustButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SaveBar({
  dirty,
  loading,
  success,
  disabled,
  message,
  onPress,
}: {
  dirty: boolean;
  loading: boolean;
  success: boolean;
  disabled: boolean;
  message: string;
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

function SimplePicker({
  visible,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  options: {id: string; label: string}[];
  value: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Display Layout</Text>
            <Pressable style={styles.modalCloseButton} onPress={onClose}>
              <Text style={styles.modalCloseButtonText}>X</Text>
            </Pressable>
          </View>
          {options.map(option => (
            <Pressable
              key={option.id}
              style={[styles.modalOption, option.id === value && styles.modalOptionActive]}
              onPress={() => {
                onSelect(option.id);
                onClose();
              }}>
              <Text style={[styles.modalOptionText, option.id === value && styles.modalOptionTextActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function DisplayPresetPickerStep({
  city,
  selectedPreset,
  line,
  selectedRoute,
  selectedStation,
  arrival,
  showCompletionHint,
  onChangeLine,
  onSelect,
}: {
  city: CityId;
  selectedPreset: number | null;
  line: LinePick;
  selectedRoute: Route | undefined;
  selectedStation: Station | undefined;
  arrival: Arrival | undefined;
  showCompletionHint: boolean;
  onChangeLine: (next: Partial<LinePick>) => void;
  onSelect: (preset: number) => void;
}) {
  const presetOptions = getDisplayPresetOptionsForMode(city, line.mode);
  const visibleSelectedPreset =
    typeof selectedPreset === 'number' && presetOptions.some(option => option.id === selectedPreset)
      ? selectedPreset
      : (presetOptions[0]?.id ?? DEFAULT_DISPLAY_PRESET);
  const carouselRef = useRef<ScrollView | null>(null);
  const [visiblePresetId, setVisiblePresetId] = useState<number>(visibleSelectedPreset);
  const routeLabel = selectedRoute?.label ?? line.routeId ?? '?';
  const routeBadgeLabel = getLocalRouteBadgeLabel(city, line.mode, line.routeId, routeLabel, selectedRoute?.shortName);
  const directionLabel = getDirectionCueLabel(city, line.mode, line.direction, selectedRoute ?? line.routeId);
  const headsignLabel = getHeadsignLabel(city, line.mode, line.direction, selectedRoute ?? line.routeId, routeLabel);
  const routeColor = selectedRoute?.color ?? colors.routeFallback;
  const routeTextColor = selectedRoute?.textColor ?? colors.routeFallbackText;
  const stopLabel = selectedStation?.name?.trim() || 'Selected stop';
  const secondaryStopLabel = isRailLinePreviewMode(city, line.mode)
    ? getRailPreviewRouteLabel(city, line.mode, routeLabel, line.routeId)
    : selectedStation?.area?.trim() || selectedStation?.name?.trim() || routeLabel || 'Route';
  const etaText = arrival ? `${Math.max(0, Math.round(arrival.minutes))}m` : '3m';
  const etaListText = buildNextArrivalTimes(arrival?.minutes ?? 3, line.nextStops).join(', ');
  useEffect(() => {
    const index = Math.max(0, presetOptions.findIndex(option => option.id === visibleSelectedPreset));
    const presetId = presetOptions[index]?.id ?? presetOptions[0]?.id ?? DEFAULT_DISPLAY_PRESET;
    setVisiblePresetId(presetId);
    carouselRef.current?.scrollTo({x: index * PRESET_CAROUSEL_ITEM_WIDTH, animated: true});
  }, [visibleSelectedPreset, presetOptions]);

  return (
    <View style={styles.stepSection}>
      <Text style={styles.stepTitle}>Select display type</Text>
      <Text style={styles.stepSubtitle}>Choose the screen style that best fits this display.</Text>
      <ScrollView
        ref={carouselRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={PRESET_CAROUSEL_ITEM_WIDTH}
        decelerationRate="fast"
        onScroll={event => {
          const nextPresetId = getPresetIdForOffset(event.nativeEvent.contentOffset.x, presetOptions);
          setVisiblePresetId(prev => (prev === nextPresetId ? prev : nextPresetId));
        }}
        scrollEventThrottle={16}
        contentContainerStyle={styles.presetCarousel}>
        {presetOptions.map((option, index) => {
          const behavior = getPresetBehavior(option.id);
          const optionLabel = getPresetLabelForMode(city, line.mode, option.id, option.label);
          const optionDescription = getPresetDescriptionForMode(city, line.mode, option.id, option.description);
          const primaryText =
            resolveDisplayContent(
              line.label.trim().length > 0 ? 'custom' : behavior.primaryContent,
              stopLabel,
              directionLabel,
              headsignLabel,
              line.label,
            ) || routeLabel || 'Preview';
          const secondaryText =
            resolveDisplayContent(
              behavior.supportsBottomCustom && line.secondaryLabel.trim().length > 0 ? 'custom' : behavior.secondaryContent,
              secondaryStopLabel,
              directionLabel,
              headsignLabel,
              line.secondaryLabel,
            ) || routeLabel || 'Preview';

          return (
            <PresetChoiceCard
              key={option.id}
              option={option}
              optionLabel={optionLabel}
              optionDescription={optionDescription}
              index={index}
              active={option.id === visibleSelectedPreset}
              routeLabel={routeBadgeLabel}
              routeColor={routeColor}
              routeTextColor={routeTextColor}
              primaryText={primaryText}
              secondaryText={option.id === 3 ? secondaryText : secondaryText}
              etaText={etaText}
              etaListText={etaListText}
              onPress={() => onSelect(option.id)}
            />
          );
        })}
      </ScrollView>
      <View style={styles.presetCarouselIndicators}>
        {presetOptions.map(option => {
          const active = option.id === visiblePresetId;
          return <View key={option.id} style={[styles.presetCarouselIndicator, active && styles.presetCarouselIndicatorActive]} />;
        })}
      </View>
      <View style={styles.customTextEditor}>
        {getPresetBehavior(visibleSelectedPreset ?? visiblePresetId).displayFormat === 'times-line' ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>Additional Times</Text>
            <View style={styles.segmented}>
              {Array.from({length: MAX_NEXT_STOPS}, (_, idx) => idx + 1).map(count => {
                const active = line.nextStops === count;
                return (
                  <Pressable
                    key={count}
                    style={[styles.segment, active && styles.segmentActive]}
                    onPress={() => onChangeLine({nextStops: count})}>
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{count}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>
      {showCompletionHint ? (
        <Text style={styles.sectionHint}>Display is ready. Use steps above to go back and edit before saving.</Text>
      ) : null}
    </View>
  );
}

function BuilderProgress({
  items,
}: {
  items: ReadonlyArray<{
    id: string;
    label: string;
    value: string;
    state: 'complete' | 'active' | 'upcoming';
    onPress?: () => void;
  }>;
}) {
  return (
    <View style={styles.builderProgress}>
      {items.map((item, index) => {
        const complete = item.state === 'complete';
        const active = item.state === 'active';
        const editable = !!item.onPress;
        return (
          <Pressable
            key={item.id}
            style={[
              styles.builderProgressItem,
              editable && styles.builderProgressItemEditable,
            ]}
            onPress={item.onPress}
            disabled={!editable}>
            {index < items.length - 1 ? (
              <View style={[styles.builderProgressConnector, complete && styles.builderProgressConnectorComplete]} />
            ) : null}
            <View style={styles.builderProgressTopRow}>
              <View
                style={[
                  styles.builderProgressDot,
                  index === 1 && styles.builderProgressDotCenter,
                  complete && styles.builderProgressDotComplete,
                  active && styles.builderProgressDotActive,
                ]}>
                <Text style={[styles.builderProgressDotText, (complete || active) && styles.builderProgressDotTextActive]}>
                  {complete ? String.fromCharCode(10003) : index + 1}
                </Text>
              </View>
            </View>
            <Text style={[styles.builderProgressLabel, active && styles.builderProgressLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PresetChoiceCard({
  option,
  optionLabel,
  optionDescription,
  index,
  active,
  routeLabel,
  routeColor,
  routeTextColor,
  primaryText,
  secondaryText,
  etaText,
  etaListText,
  onPress,
}: {
  option: (typeof DISPLAY_PRESET_OPTIONS)[number];
  optionLabel: string;
  optionDescription: string;
  index: number;
  active: boolean;
  routeLabel: string;
  routeColor: string;
  routeTextColor: string;
  primaryText: string;
  secondaryText: string;
  etaText: string;
  etaListText: string;
  onPress: () => void;
}) {
  const enterAnim = useRef(new Animated.Value(0)).current;
  const activeAnim = useRef(new Animated.Value(active ? 1 : 0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 220,
      delay: index * 35,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enterAnim, index]);

  useEffect(() => {
    Animated.spring(activeAnim, {
      toValue: active ? 1 : 0,
      tension: 180,
      friction: 18,
      useNativeDriver: true,
    }).start();
  }, [active, activeAnim]);

  return (
    <Animated.View
      style={{
        opacity: enterAnim,
        transform: [
          {
            translateY: enterAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [10, 0],
            }),
          },
          {
            scale: activeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1],
            }),
          },
          {scale: pressAnim},
        ],
      }}>
      <Pressable
        style={[styles.presetChoiceCard, styles.presetCarouselCard, active && styles.presetChoiceCardActive]}
        onPress={onPress}
        onPressIn={() => {
          Animated.spring(pressAnim, {
            toValue: 0.985,
            tension: 220,
            friction: 16,
            useNativeDriver: true,
          }).start();
        }}
        onPressOut={() => {
          Animated.spring(pressAnim, {
            toValue: 1,
            tension: 220,
            friction: 14,
            useNativeDriver: true,
          }).start();
        }}>
        <View style={styles.presetChoiceHeader}>
          <Text style={[styles.presetChoiceLabel, active && styles.presetChoiceLabelActive]}>{optionLabel}</Text>
          <View style={[styles.choiceRowCheck, active && styles.choiceRowCheckActive]}>
            {active ? <Text style={styles.choiceRowCheckText}>✓</Text> : null}
          </View>
        </View>
        <Text style={styles.presetChoiceDescription}>{optionDescription}</Text>
        <PresetDiagram
          presetId={option.id}
          routeLabel={routeLabel}
          routeColor={routeColor}
          routeTextColor={routeTextColor}
          primaryText={primaryText}
          secondaryText={secondaryText}
          etaText={etaText}
          etaListText={etaListText}
        />
      </Pressable>
    </Animated.View>
  );
}

function PresetDiagram({
  presetId,
  routeLabel = '4',
  routeColor = colors.routeFallback,
  routeTextColor = colors.routeFallbackText,
  primaryText = 'Woodlawn',
  secondaryText = 'Uptown',
  etaText = '3m',
  etaListText = '3m, 5m, 8m',
}: {
  presetId: number;
  routeLabel?: string;
  routeColor?: string;
  routeTextColor?: string;
  primaryText?: string;
  secondaryText?: string;
  etaText?: string;
  etaListText?: string;
}) {
  const isDualLabel = false;
  const hasSecondaryEtaLine = presetId === 4 || presetId === 5 || presetId === 6;

  return (
    <View style={styles.presetDiagramFrame}>
      <View style={[styles.presetDiagramLineBadge, {backgroundColor: routeColor}]}>
        <Text style={[styles.presetDiagramLineBadgeText, {color: routeTextColor}]}>{routeLabel.slice(0, 4)}</Text>
      </View>

      <View style={styles.presetDiagramCenter}>
        {isDualLabel ? (
          <>
            <Text style={styles.presetDiagramPrimaryText} numberOfLines={1} ellipsizeMode="tail">{primaryText}</Text>
            <Text style={[styles.presetDiagramPrimaryText, styles.presetDiagramSecondaryTextMuted]} numberOfLines={1} ellipsizeMode="tail">{secondaryText}</Text>
          </>
        ) : (
          <Text style={styles.presetDiagramPrimaryText} numberOfLines={1} ellipsizeMode="tail">{primaryText}</Text>
        )}
        {hasSecondaryEtaLine ? <Text style={styles.presetDiagramSecondaryEta} numberOfLines={1} ellipsizeMode="tail">{etaListText}</Text> : null}
      </View>

      <Text style={styles.presetDiagramRightEta} numberOfLines={1}>{etaText}</Text>
    </View>
  );
}

function LayoutSlotsPickerStep({
  selectedSlots,
  onSelect,
}: {
  selectedSlots: number;
  onSelect: (slots: number) => void;
}) {
  return (
    <View style={styles.stepSection}>
      <Text style={styles.stepTitle}>How many stops?</Text>
      <Text style={styles.stepSubtitle}>Choose whether the device should show one line or two.</Text>
      <View style={styles.choiceList}>
        {LAYOUT_OPTIONS.map(option => {
          const active = option.slots === selectedSlots;
          return (
            <Pressable
              key={option.id}
              style={[styles.choiceRow, active && styles.choiceRowActive]}
              onPress={() => onSelect(option.slots)}>
              <View style={styles.choiceRowCopy}>
                <Text style={[styles.choiceRowLabel, active && styles.choiceRowLabelActive]}>{option.label}</Text>
                <Text style={[styles.choiceRowHint, active && styles.choiceRowHintActive]}>
                  {option.slots === 1 ? 'Single row with one saved service.' : 'Two active rows, one per saved service.'}
                </Text>
              </View>
              <View style={[styles.choiceRowCheck, active && styles.choiceRowCheckActive]}>
                {active ? <Text style={styles.choiceRowCheckText}>✓</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
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

function AnimatedChevron({expanded}: {expanded: boolean}) {
  const anim = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: expanded ? 1 : 0,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, expanded]);

  return (
    <Animated.View
      style={{
        transform: [
          {
            rotate: anim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '180deg'],
            }),
          },
        ],
      }}>
      <Text style={styles.collapsibleArrow}>▼</Text>
    </Animated.View>
  );
}

function ScheduleToggleControl({enabled}: {enabled: boolean}) {
  const anim = useRef(new Animated.Value(enabled ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: enabled ? 1 : 0,
      duration: 170,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, enabled]);

  return (
    <View style={[styles.scheduleToggle, enabled && styles.scheduleToggleOn]}>
      <Animated.View
        style={[
          styles.scheduleToggleThumb,
          enabled && styles.scheduleToggleThumbOn,
          {
            transform: [
              {
                translateX: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 18],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

const NYC_MODE_COLORS: Partial<Record<ModeId, string>> = {
  train: '#0039A6',
  bus: '#17844B',
  lirr: '#6D3FA9',
  mnr: '#00A1DE',
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
  hasLinkedDevice,
  liveSupported,
  onModeChange,
  onSelectLine,
  onAddDevice,
}: {
  city: CityId;
  selectedMode: ModeId;
  linesByMode: Partial<Record<ModeId, Route[]>>;
  linesLoadingByMode: Partial<Record<ModeId, boolean>>;
  selectedRouteId: string;
  hasLinkedDevice: boolean;
  liveSupported: boolean;
  onModeChange: (mode: ModeId) => void;
  onSelectLine: (routeId: string) => void;
  onAddDevice: () => void;
}) {
  const modeOptions = getAvailableModes(city);
  const allRoutes = linesByMode[selectedMode] ?? [];
  const isLoading = !!linesLoadingByMode[selectedMode];
  const [lineSearch, setLineSearch] = useState('');
  const [variantPickerEntry, setVariantPickerEntry] = useState<RoutePickerItem | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(getDefaultCollapsedLineGroupKeys(city, selectedMode)),
  );
  const pulseAnims = useRef<Record<string, Animated.Value>>({}).current;

  const isBusGrouped = selectedMode === 'bus' && (city === 'new-york' || city === 'boston');
  const isBostonRouteCardMode =
    city === 'boston' && (selectedMode === 'train' || selectedMode === 'commuter-rail');
  const isWidePillMode =
    (city === 'chicago' && selectedMode === 'train') ||
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

  const getPulseAnim = (id: string) => {
    if (!pulseAnims[id]) pulseAnims[id] = new Animated.Value(1);
    return pulseAnims[id];
  };

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
    onSelectLine(route.routes[0]?.id ?? route.id);
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
      <View style={styles.modePickerGrid}>
        {modeOptions.map(mode => {
          const active = selectedMode === mode;
          const accentColor = CITY_MODE_COLORS[city]?.[mode] ?? colors.accent;
          return (
            <Pressable
              key={mode}
              style={[styles.modeTile, active && styles.modeTileActive]}
              onPress={() => onModeChange(mode)}>
              <View style={[styles.modeTileBar, {backgroundColor: accentColor}, active && styles.modeTileBarActive]} />
              <View style={styles.modeTileContent}>
                <Text style={[styles.modeTileLabel, active && styles.modeTileLabelActive]}>{getModeLabel(city, mode)}</Text>
              </View>
            </Pressable>
          );
        })}
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
          <View style={styles.lineGroupList}>
            {routeGroups.map(group => {
              const isCollapsed = isBusGrouped && !isSearchingLines && !!group.title && collapsedGroups.has(group.key);
              const hasSelected = group.routes.some(r => r.routes.some(item => item.id === selectedRouteId));
              const groupAccent: Record<string, string> = {
                bronx: '#E63946', brooklyn: '#F4A261', manhattan: '#5CE1E6', queens: '#A8DADC', 'staten-island': '#6EE7B7',
                'silver-line': '#94A3B8', crosstown: '#22C55E', local: '#3B82F6', quincy: '#06B6D4', northwest: '#8B5CF6',
                'north-shore': '#F59E0B', express: '#EF4444', other: colors.border,
              };
              const accentColor = groupAccent[group.key] ?? colors.border;
              return (
              <View key={group.key} style={styles.lineGroup}>
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
                <View style={[styles.lineGrid, isWidePillMode && styles.lineGridChicagoTrain]}>
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
          label: isExpressVariant(route) ? `Express (${route.label})` : `Regular (${route.label})`,
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
  const checkAnims = useRef<Record<string, Animated.Value>>({}).current;
  const showBusBadge = isNycBusBadge(city, selectedMode);
  const selectedRouteBadgeLabel = selectedRoute ? formatRoutePickerLabel(city, selectedMode, selectedRoute) : '';
  const [expandedBoroughs, setExpandedBoroughs] = useState<Set<string>>(new Set());

  const getCheckAnim = (id: string) => {
    if (!checkAnims[id]) checkAnims[id] = new Animated.Value(0);
    return checkAnims[id];
  };

  const handleSelect = (id: string) => {
    const anim = getCheckAnim(id);
    Animated.sequence([
      Animated.spring(anim, {toValue: 1.2, tension: 200, friction: 8, useNativeDriver: true}),
      Animated.spring(anim, {toValue: 1, tension: 200, friction: 8, useNativeDriver: true}),
    ]).start();
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
  const hideDirectionToggle = city === 'chicago' && selectedMode === 'bus';
  const isChicagoTrainMode = city === 'chicago' && selectedMode === 'train';
  const isNycSubwayMode = city === 'new-york' && selectedMode === 'train';
  const isNycLirrMode = city === 'new-york' && selectedMode === 'lirr';
  const isNycBusMode = city === 'new-york' && selectedMode === 'bus';
  const isNycMnrMode = city === 'new-york' && selectedMode === 'mnr';
  const isNjtTrainMode = city === 'new-jersey' && selectedMode === 'train';
  const isNjtBusMode = city === 'new-jersey' && selectedMode === 'bus';
  const isBostonTrainMode = city === 'boston' && selectedMode === 'train';
  const isBostonDirectionMode =
    city === 'boston' &&
    (selectedMode === 'train' || selectedMode === 'bus' || selectedMode === 'commuter-rail');
  const useWideDirectionToggle =
    isChicagoTrainMode || isNycSubwayMode || isNycLirrMode || isNycBusMode || isNycMnrMode || isNjtTrainMode || isNjtBusMode || isBostonTrainMode;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, isBusGrouped, term]);

  return (
    <View style={[styles.stepContainer, styles.stopPickerStepFull]}>
      <View style={styles.stopPickerHeader}>
        {!hideDirectionToggle ? (
          <View style={[styles.stopPickerDirRow, useWideDirectionToggle && styles.stopPickerDirRowChicagoTrain]}>
            {directionOptions.map(dir => {
              const active = selectedDirection === dir;
              const label = getDirectionToggleLabel(city, selectedMode, dir, selectedRoute ?? selectedRouteId);
              return (
                <Pressable
                  key={dir}
                  style={[
                    styles.stopPickerDirPill,
                    useWideDirectionToggle && styles.stopPickerDirPillChicagoTrain,
                    active && styles.stopPickerDirPillActive,
                  ]}
                  onPress={() => onSelectDirection(dir)}>
                  <Text
                    style={[
                      styles.stopPickerDirText,
                      useWideDirectionToggle && styles.stopPickerDirTextChicagoTrain,
                      isBostonDirectionMode && styles.stopPickerDirTextBoston,
                      active && styles.stopPickerDirTextActive,
                    ]}
                    numberOfLines={isBostonDirectionMode ? 1 : useWideDirectionToggle ? 2 : 1}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <TextInput
        value={search}
        onChangeText={onSearch}
        placeholder="Search stops…"
        placeholderTextColor={colors.textMuted}
        style={styles.stepSearchInput}
      />

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
                      routeColor={selectedRoute?.color}
                      checkAnim={getCheckAnim(station.id)}
                      showDot
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
                  routeColor={selectedRoute?.color}
                  checkAnim={getCheckAnim(station.id)}
                  showDot
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

function formatStationLineSummary(lines: TransitStationLine[]) {
  const labels = lines
    .map(line => (line.shortName || line.id).trim())
    .filter(label => label.length > 0);
  if (labels.length === 0) return null;
  const visible = labels.slice(0, 6);
  const suffix = labels.length > visible.length ? ` +${labels.length - visible.length}` : '';
  return visible.join(' · ') + suffix;
}

function StopRow({
  station,
  selected,
  routeColor,
  checkAnim,
  showDot,
  onPress,
}: {
  station: Station;
  selected: boolean;
  routeColor: string | undefined;
  checkAnim: Animated.Value;
  showDot: boolean;
  onPress: () => void;
}) {
  const lineSummary = formatStationLineSummary(station.lines);

  return (
    <Pressable style={[styles.stopRow, selected && styles.stopRowSelected]} onPress={onPress}>
      {showDot && routeColor ? <View style={[styles.stopLineDot, {backgroundColor: routeColor}]} /> : <View style={styles.stopLineDotEmpty} />}
      <View style={styles.stopRowInfo}>
        <Text style={styles.stationName}>{station.name}</Text>
        {station.area ? <Text style={styles.stationMeta}>{station.area}</Text> : null}
        {lineSummary ? <Text style={styles.stationLineSummary}>Serves {lineSummary}</Text> : null}
      </View>
      {selected ? (
        <Animated.View style={[styles.stopCheckmark, {transform: [{scale: checkAnim}]}]}>
          <Text style={styles.stopCheckmarkText}>✓</Text>
        </Animated.View>
      ) : (
        <Text style={styles.chevron}>›</Text>
      )}
    </Pressable>
  );
}

function DoneStep({
  city,
  line,
  displayPreset,
  presetConfirmed,
  selectedRoute,
  selectedStation,
  onClearLine,
  onClearStop,
  onClearDisplayType,
}: {
  city: CityId;
  line: LinePick;
  displayPreset: number;
  presetConfirmed: boolean;
  selectedRoute: Route | undefined;
  selectedStation: Station | undefined;
  onClearLine: () => void;
  onClearStop: () => void;
  onClearDisplayType: () => void;
}) {
  const showBusBadge = false;
  const selectedRouteBadgeLabel = selectedRoute?.label ?? '';
  const onChangeLine = onClearLine;
  const onChangeStop = onClearStop;
  const onChangeDisplayType = onClearDisplayType;
  const liveStatusText = '';
  const presetOption = DISPLAY_PRESET_OPTIONS.find(option => option.id === displayPreset);
  const presetLabel = getPresetLabelForMode(city, line.mode, displayPreset, presetOption?.label ?? `Display Type ${displayPreset}`);
  const directionLabel = getDirectionSummaryLabel(city, line.mode, line.direction, selectedRoute ?? line.routeId);

  return (
    <View style={styles.doneStepContainer}>
      <View style={styles.contextChipRow} pointerEvents="none">
        {selectedRoute ? (
          <Pressable style={styles.contextChip} onPress={onChangeLine}>
            <View style={[styles.contextChipBadge, showBusBadge && styles.contextChipBadgeBus, {backgroundColor: selectedRoute.color}]}>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.74}
                numberOfLines={1}
                style={[styles.contextChipBadgeText, showBusBadge && styles.contextChipBadgeTextBus, {color: selectedRoute.textColor ?? colors.text}]}>
                {selectedRouteBadgeLabel}
              </Text>
            </View>
            <Text style={styles.contextChipLabel}>{selectedRoute.label} line</Text>
            <Text style={styles.contextChipX}>✕</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.contextChip} onPress={onChangeLine}>
            <Text style={styles.contextChipLabel}>Choose line</Text>
            <Text style={styles.contextChipX}>→</Text>
          </Pressable>
        )}
        {selectedStation ? (
          <Pressable style={styles.contextChip} onPress={onChangeStop}>
            <Text style={styles.contextChipLabel} numberOfLines={1}>{selectedStation.name}</Text>
            <Text style={styles.contextChipX}>✕</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.contextChip} onPress={onChangeStop}>
            <Text style={styles.contextChipLabel}>Choose stop</Text>
            <Text style={styles.contextChipX}>→</Text>
          </Pressable>
        )}
        <Pressable style={styles.contextChip} onPress={onChangeDisplayType}>
          <Text style={styles.contextChipLabel} numberOfLines={1}>
            {presetConfirmed ? presetLabel : 'Choose display type'}
          </Text>
          <Text style={styles.contextChipX}>{presetConfirmed ? 'x' : '>'}</Text>
        </Pressable>
      </View>

      {liveStatusText ? <Text style={styles.sectionHint}>{liveStatusText}</Text> : null}

      <View style={styles.secondarySectionCard}>
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>Device Preset</Text>
          <Text style={styles.sectionHint}>
            {presetConfirmed ? presetLabel : 'Not selected yet'}
          </Text>
          {presetConfirmed && presetOption?.description ? <Text style={styles.sectionHint}>{presetOption.description}</Text> : null}
          <PresetDiagram presetId={displayPreset} />
        </View>
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>Direction</Text>
          <Text style={styles.sectionHint}>{directionLabel}</Text>
        </View>
      </View>
    </View>
  );
}

function ReviewDoneStep({
  city,
  line,
  displayPreset,
  presetConfirmed,
  selectedRoute,
  selectedStation,
  onChangeLine,
  onClearLine,
  onClearStop,
  onClearDisplayType,
}: {
  city: CityId;
  line: LinePick;
  displayPreset: number;
  presetConfirmed: boolean;
  selectedRoute: Route | undefined;
  selectedStation: Station | undefined;
  onChangeLine: (next: Partial<LinePick>) => void;
  onClearLine: () => void;
  onClearStop: () => void;
  onClearDisplayType: () => void;
}) {
  const presetOption = DISPLAY_PRESET_OPTIONS.find(option => option.id === displayPreset);
  const presetLabel = getPresetLabelForMode(city, line.mode, displayPreset, presetOption?.label ?? `Display Type ${displayPreset}`);
  const directionLabel = getDirectionSummaryLabel(city, line.mode, line.direction, selectedRoute ?? line.routeId);
  const activePresetBehavior = getPresetBehavior(displayPreset);
  const routeLabel = selectedRoute?.label ?? line.routeId ?? 'Route';
  const previewDirectionLabel = getDirectionCueLabel(city, line.mode, line.direction, selectedRoute ?? line.routeId);
  const previewHeadsignLabel = getHeadsignLabel(city, line.mode, line.direction, selectedRoute ?? line.routeId, routeLabel);
  const topPlaceholder = resolveDisplayContent(
    activePresetBehavior.primaryContent,
    selectedStation?.name?.trim() || 'Selected stop',
    previewDirectionLabel,
    previewHeadsignLabel,
    '',
  );
  const bottomPlaceholder = resolveDisplayContent(
    activePresetBehavior.secondaryContent,
    isRailLinePreviewMode(city, line.mode)
      ? getRailPreviewRouteLabel(city, line.mode, routeLabel, line.routeId)
      : selectedStation?.area?.trim() || selectedStation?.name?.trim() || routeLabel || 'Route',
    previewDirectionLabel,
    previewHeadsignLabel,
    '',
  );

  return (
    <View style={styles.doneStepContainer}>
      <Text style={styles.reviewEyebrow}>Final Check</Text>
      <View style={styles.reviewControlsCard}>
        <View style={styles.reviewField}>
          <Text style={styles.reviewFieldLabel}>Top Text</Text>
          <TextInput
            value={line.label}
            onChangeText={text =>
              onChangeLine({
                label: text,
                primaryContent: text.trim().length > 0 ? 'custom' : activePresetBehavior.primaryContent,
              })
            }
            placeholder={topPlaceholder}
            placeholderTextColor={colors.textMuted}
            style={styles.reviewFieldInput}
            returnKeyType="done"
          />
        </View>
        {activePresetBehavior.supportsBottomCustom ? (
          <View style={styles.reviewField}>
            <Text style={styles.reviewFieldLabel}>Bottom Text</Text>
            <TextInput
              value={line.secondaryLabel}
              onChangeText={text =>
                onChangeLine({
                  secondaryLabel: text,
                  secondaryContent: text.trim().length > 0 ? 'custom' : activePresetBehavior.secondaryContent,
                })
              }
              placeholder={bottomPlaceholder}
              placeholderTextColor={colors.textMuted}
              style={styles.reviewFieldInput}
              returnKeyType="done"
            />
          </View>
        ) : null}
      </View>
      <View style={styles.doneReviewList}>
        <ReviewRow label="Line" value={selectedRoute?.label ? `${selectedRoute.label} line` : 'Not selected'} onClear={onClearLine} />
        <ReviewRow label="Stop" value={selectedStation?.name ?? 'Not selected'} onClear={onClearStop} />
        <ReviewRow label="Direction" value={directionLabel} onClear={onClearStop} />
        <ReviewRow
          label="Display Type"
          value={presetConfirmed ? presetLabel : 'Not selected'}
          onClear={onClearDisplayType}
        />
      </View>
    </View>
  );
}

function ReviewRow({label, value, onClear}: {label: string; value: string; onClear: () => void}) {
  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewRowAccent} />
      <View style={styles.reviewRowCopy}>
        <Text style={styles.reviewRowLabel}>{label}</Text>
        <Text style={styles.reviewRowValue} numberOfLines={1}>{value}</Text>
      </View>
      <Pressable style={styles.reviewRowClear} onPress={onClear}>
        <Text style={styles.reviewRowClearText}>X</Text>
      </Pressable>
    </View>
  );
}

// ─── Mini LED mockup inside each style row ────────────────────────────────────
function StyleMockLed({city, preset, routeColor, routeLabel, routeId, route, destinationLabel, active, mode, direction, nextStops = 2, branchLabel, badgeShape = 'circle', hideBadgeLabel = false}: {
  city: CityId;
  preset: number;
  routeColor: string;
  routeLabel: string;
  routeId?: string;
  route?: Route;
  destinationLabel: string;
  active: boolean;
  mode: ModeId;
  direction: Direction;
  nextStops?: number;
  branchLabel?: string;
  badgeShape?: 'circle' | 'pill' | 'rail' | 'bar';
  hideBadgeLabel?: boolean;
}) {
  const textOpacity = active ? 1 : 0.55;
  const dirLabel = getDirectionLabel(city, mode, direction, route ?? routeId);
  const headsignLabel = branchLabel ?? getHeadsignLabel(city, mode, direction, route ?? routeId, routeLabel);
  const destLabel = destinationLabel.trim().length > 0 ? destinationLabel : 'Selected stop';

  const badge = (
    <View
      style={[
        styles.mockBadge,
        badgeShape === 'pill' && styles.mockBadgePill,
        badgeShape === 'rail' && styles.mockBadgeRail,
        badgeShape === 'bar' && styles.mockBadgeBar,
        {backgroundColor: routeColor, opacity: active ? 1 : 0.65},
      ]}>
      {!hideBadgeLabel && badgeShape !== 'bar' ? (
        <Text
          style={[
            styles.mockBadgeText,
            badgeShape !== 'circle' && styles.mockBadgeTextCompact,
          ]}
          numberOfLines={badgeShape === 'circle' ? 1 : 2}>
          {routeLabel}
        </Text>
      ) : null}
    </View>
  );
  const destText = (
    <Text style={[styles.mockText, {opacity: textOpacity}]} numberOfLines={1}>{destLabel}</Text>
  );
  const dirText = (
    <Text style={[styles.mockText, {opacity: textOpacity}]} numberOfLines={1}>{dirLabel}</Text>
  );
  const headsignText = (
    <Text style={[styles.mockText, {opacity: textOpacity}]} numberOfLines={1}>{headsignLabel}</Text>
  );
  const timeText = (
    <Text style={[styles.mockTimeText, {opacity: textOpacity}]}>3m</Text>
  );
  const mockUpcomingTimes = buildNextArrivalTimes(3, nextStops);
  const arrivalChip = (label: string) => (
    <View style={[styles.mockMiniTag, {opacity: textOpacity}]}>
      <Text style={styles.mockMiniTagText}>{label}</Text>
    </View>
  );

  const layout: Record<number, React.ReactNode> = {
    // Your Station: badge · stop name · arrival time
    1: <>{badge}<View style={styles.mockFlex}>{destText}</View>{timeText}</>,
    // Direction: badge · direction · arrival time
    2: <>{badge}<View style={styles.mockFlex}>{dirText}</View>{timeText}</>,
    // Headsign: badge · destination · arrival time
    3: <>{badge}<View style={styles.mockFlex}>{headsignText}</View>{timeText}</>,
    // Your Station + Upcoming Trains: badge · [stop name / arrival chips] · next arrival
    4: (
      <>
        {badge}
        <View style={styles.mockCol}>
          {destText}
          <View style={styles.mockMiniTags}>
            {mockUpcomingTimes.map(label => (
              <React.Fragment key={`dest-upcoming-${label}`}>{arrivalChip(label)}</React.Fragment>
            ))}
          </View>
        </View>
        {timeText}
      </>
    ),
    // Direction + Upcoming Trains: badge · [direction / arrival chips] · next arrival
    5: (
      <>
        {badge}
        <View style={styles.mockCol}>
          {dirText}
          <View style={styles.mockMiniTags}>
            {mockUpcomingTimes.map(label => (
              <React.Fragment key={`dir-upcoming-${label}`}>{arrivalChip(label)}</React.Fragment>
            ))}
          </View>
        </View>
        {timeText}
      </>
    ),
    // Headsign + Upcoming Trains: badge · [headsign / arrival chips] · next arrival
    6: (
      <>
        {badge}
        <View style={styles.mockCol}>
          {headsignText}
          <View style={styles.mockMiniTags}>
            {mockUpcomingTimes.map(label => (
              <React.Fragment key={`headsign-upcoming-${label}`}>{arrivalChip(label)}</React.Fragment>
            ))}
          </View>
        </View>
        {timeText}
      </>
    ),
  };

  return (
    <View style={[styles.mockScreen, [4, 5, 6].includes(preset) && styles.mockScreenTall, active && styles.mockScreenActive]}>
      {layout[preset] ?? layout[1]}
    </View>
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

  useEffect(() => {
    setLocalPreset(visibleDisplayType);
  }, [visibleDisplayType]);

  const handleTap = (id: number) => {
    onPreview(id);
    setLocalPreset(id);
    if (!isTrainCountPreset(id)) {
      // Simple styles: complete immediately
      onSelect(id);
    } else {
      // Train-count styles: expand inline picker, default to 2 if not already valid
      if (line.nextStops < 2) {
        onChangeLine({nextStops: 2});
      }
    }
  };

  const handleCountSelect = (count: number) => {
    onChangeLine({nextStops: count});
    onSelect(localPreset);
  };

  const routeLabel = selectedRoute?.label ?? line.routeId;
  const routeColor = selectedRoute?.color ?? colors.routeFallback;
  const selectedStopLabel = selectedStation?.name?.trim() || 'Selected stop';
  const activeNextStops = line.nextStops >= 2 ? line.nextStops : 2;
  const isNycRail = isNycRailMode(line.mode);
  const isRailPreviewMode = isRailLinePreviewMode(city, line.mode);
  const shouldUseRailBranchLabel = isRailPreviewMode && !(city === 'new-york' && isNycRail);
  const routeBadgeLabel = getLocalRouteBadgeLabel(city, line.mode, line.routeId, routeLabel, selectedRoute?.shortName);
  const linePreviewLabel = getRailPreviewRouteLabel(city, line.mode, routeLabel, line.routeId);
  const getOptionLabel = (id: number, defaultLabel: string) =>
    getPresetLabelForMode(city, line.mode, id, defaultLabel);

  return (
    <View style={styles.stepSection}>
      <Text style={styles.mockPreviewNote}>Note: Previews use sample data for illustration only.</Text>
      <View style={styles.styleRowList}>
        {presetOptions.map(option => {
          const isActive = option.id === localPreset;
          const showCountPicker = isActive && isTrainCountPreset(option.id);
          return (
            <Pressable
              key={option.id}
              style={[styles.styleRow, isActive && styles.styleRowActive]}
              onPress={() => handleTap(option.id)}>
              <View style={[styles.styleRowBar, isActive && styles.styleRowBarActive]} />
              <View style={styles.styleRowBody}>
                <Text style={[styles.styleRowLabel, isActive && styles.styleRowLabelActive]}>
                  {getOptionLabel(option.id, option.label)}
                </Text>
                <StyleMockLed
                  city={city}
                  preset={option.id}
                  routeColor={routeColor}
                  routeLabel={routeBadgeLabel}
                  routeId={line.routeId}
                  route={selectedRoute}
                  destinationLabel={selectedStopLabel}
                  active={isActive}
                  mode={line.mode}
                  direction={line.direction}
                  nextStops={isActive ? activeNextStops : 2}
                  branchLabel={shouldUseRailBranchLabel ? linePreviewLabel : undefined}
                  badgeShape={city === 'new-york' && line.mode === 'train' ? 'circle' : 'pill'}
                  hideBadgeLabel={isNycRail}
                />
                {showCountPicker ? (
                  <View style={styles.inlineCountPicker}>
                    <Text style={styles.inlineCountLabel}>How many trains should be shown?</Text>
                    <View style={styles.inlineCountRow}>
                      {[2, 3].map(count => {
                        const countActive = activeNextStops === count;
                        return (
                          <Pressable
                            key={count}
                            style={[styles.inlineCountChip, countActive && styles.inlineCountChipActive]}
                            onPress={() => handleCountSelect(count)}>
                            <Text style={[styles.inlineCountChipText, countActive && styles.inlineCountChipTextActive]}>
                              {count} trains
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
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
  presetConfirmed,
  selectedRoute,
  selectedStation,
  presetName,
  displayMetadata,
  customScheduleEnabled,
  displaySchedule,
  displayDays,
  scheduleExpanded,
  layoutSlots,
  onChangeLine,
  onClearLine,
  onClearStop,
  onClearDisplayType,
  onPresetNameChange,
  onBrightnessChange,
  onScrollingChange,
  onScheduleEnabledChange,
  onScheduleStartChange,
  onScheduleEndChange,
  onToggleDay,
  onToggleScheduleExpanded,
  onExpandToTwoStops,
  onRemoveStop,
}: {
  city: CityId;
  line: LinePick;
  displayPreset: number;
  presetConfirmed: boolean;
  selectedRoute: Route | undefined;
  selectedStation: Station | undefined;
  presetName: string;
  displayMetadata: {brightness: number; scrolling: boolean; paused: boolean; priority: number; sortOrder: number};
  customScheduleEnabled: boolean;
  displaySchedule: {start: string; end: string};
  displayDays: DayId[];
  scheduleExpanded: boolean;
  layoutSlots: number;
  onChangeLine: (next: Partial<LinePick>) => void;
  onClearLine: () => void;
  onClearStop: () => void;
  onClearDisplayType: () => void;
  onPresetNameChange: (name: string) => void;
  onBrightnessChange: (brightness: number) => void;
  onScrollingChange: (scrolling: boolean) => void;
  onScheduleEnabledChange: () => void;
  onScheduleStartChange: (start: string) => void;
  onScheduleEndChange: (end: string) => void;
  onToggleDay: (day: DayId) => void;
  onToggleScheduleExpanded: () => void;
  onExpandToTwoStops: () => void;
  onRemoveStop: () => void;
}) {
  const presetOption = DISPLAY_PRESET_OPTIONS.find(o => o.id === displayPreset);
  const directionLabel = getDirectionSummaryLabel(city, line.mode, line.direction, selectedRoute ?? line.routeId);
  const activePresetBehavior = getPresetBehavior(displayPreset);

  return (
    <View style={styles.wizardReviewContainer}>



      {/* Custom text */}
      <View style={styles.wizardSection}>
        <Text style={styles.wizardSectionLabel}>Custom Text (Optional)</Text>
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
          {/* Long text */}
          <View style={styles.wizardSettingRow}>
            <Text style={styles.wizardSettingLabel}>Long Text</Text>
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

      {/* Schedule */}
      <View style={styles.wizardSection}>
        <Text style={styles.wizardSectionLabel}>Schedule</Text>
        <View style={styles.wizardCard}>
          <View style={styles.wizardScheduleHeader}>
            <Text style={styles.wizardSettingLabel}>Schedule</Text>
            <Pressable onPress={onScheduleEnabledChange}>
              <ScheduleToggleControl enabled={customScheduleEnabled} />
            </Pressable>
          </View>
          {customScheduleEnabled ? (
            <>
              <View style={styles.wizardCardDivider} />
              <View style={styles.wizardDayRow}>
                {DAY_OPTIONS.map(day => {
                  const active = displayDays.includes(day.id);
                  return (
                    <Pressable
                      key={day.id}
                      style={[styles.wizardDayPill, active && styles.wizardDayPillActive]}
                      onPress={() => onToggleDay(day.id)}>
                      <Text style={[styles.wizardDayPillText, active && styles.wizardDayPillTextActive]}>{day.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
          {customScheduleEnabled ? (
            <>
              <View style={styles.wizardCardDivider} />
              <View style={styles.wizardTimeRow}>
                <TimeStepper label="Start" value={displaySchedule.start} onPrev={() => onScheduleStartChange(cycleTimeOption(displaySchedule.start, -1))} onNext={() => onScheduleStartChange(cycleTimeOption(displaySchedule.start, 1))} />
                <TimeStepper label="End" value={displaySchedule.end} onPrev={() => onScheduleEndChange(cycleTimeOption(displaySchedule.end, -1))} onNext={() => onScheduleEndChange(cycleTimeOption(displaySchedule.end, 1))} />
              </View>
            </>
          ) : null}
        </View>
      </View>


    </View>
  );
}

function WizardReviewRow({label, value, onEdit}: {label: string; value: string; onEdit: () => void}) {
  return (
    <View style={styles.wizardReviewRow}>
      <View style={styles.wizardReviewRowCopy}>
        <Text style={styles.wizardReviewRowLabel}>{label}</Text>
        <Text style={styles.wizardReviewRowValue} numberOfLines={1}>{value}</Text>
      </View>
      <Pressable style={styles.wizardReviewEditBtn} onPress={onEdit}>
        <Text style={styles.wizardReviewEditText}>Edit</Text>
      </Pressable>
    </View>
  );
}
