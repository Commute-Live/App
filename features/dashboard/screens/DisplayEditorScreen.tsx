import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Animated, Easing, Keyboard, KeyboardAvoidingView, LayoutAnimation, Modal, Platform, Pressable, ScrollView, Text, TextInput, UIManager, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {colors} from '../../../theme';
import DashboardPreviewSection from '../components/DashboardPreviewSection';
import {useAppState} from '../../../state/appState';
import {CITY_LABELS, type CityId} from '../../../constants/cities';
import type {DisplayContent, DisplayFormat} from '../../../types/transit';
import type {Display3DSlot} from '../components/Display3DPreview';
import {apiFetch} from '../../../lib/api';
import {queryKeys} from '../../../lib/queryKeys';
import {createDisplay, fetchDisplay, fetchDisplays, updateDisplay, validateDisplayDraft, type DisplaySavePayload} from '../../../lib/displays';
import {useAuth} from '../../../state/authProvider';
import {useSelectedDevice} from '../../../hooks/useSelectedDevice';
import {
  areSameLinePicks,
  buildNextArrivalTimes,
  buildRouteGroups,
  cityModeFromProvider,
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
  resolveDisplayContent,
  resolveSelectedStationForLine,
  routeLookupKey,
  syncArrivals,
} from './DashboardEditor.helpers';
import {styles} from './DisplayEditor.styles';

type ModeId = 'train' | 'bus' | 'trolley' | 'commuter-rail' | 'ferry';
type Direction = 'uptown' | 'downtown';
type Station = {id: string; name: string; area: string; lines: string[]};
type Route = {id: string; label: string; color: string; textColor?: string};
type Arrival = {lineId: string; minutes: number; status: 'GOOD' | 'DELAYS'; destination: string | null};
type LinePick = {
  id: string;
  mode: ModeId;
  stationId: string;
  routeId: string;
  direction: Direction;
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
type EditorStep = 'format' | 'lines' | 'stops' | 'done';
type RoutePickerItem = {id: string; label: string; displayLabel: string; color: string; textColor?: string; routes: Route[]};
type RouteGroup = {key: string; title?: string; routes: RoutePickerItem[]};

const DEFAULT_TEXT_COLOR = '#E9ECEF';
const DEFAULT_NEXT_STOPS = 3;
const MIN_NEXT_STOPS = 1;
const MAX_NEXT_STOPS = 5;
const DEFAULT_LAYOUT_SLOTS = 1;
const DEFAULT_DISPLAY_PRESET = 1;
const DEFAULT_BRIGHTNESS = 60;
const MIN_BRIGHTNESS = 10;
const MAX_BRIGHTNESS = 100;
const TIME_OPTIONS = ['00:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '17:00', '18:00', '20:00', '22:00', '23:00'];
const DAY_OPTIONS = [
  {id: 'mon', label: 'Mon'},
  {id: 'tue', label: 'Tue'},
  {id: 'wed', label: 'Wed'},
  {id: 'thu', label: 'Thu'},
  {id: 'fri', label: 'Fri'},
  {id: 'sat', label: 'Sat'},
  {id: 'sun', label: 'Sun'},
] as const;
type DayId = (typeof DAY_OPTIONS)[number]['id'];
const LAYOUT_OPTIONS = [
  {id: 'layout-1', slots: 1, label: '1 stop'},
  {id: 'layout-2', slots: 2, label: '2 stops'},
];
const DISPLAY_PRESET_OPTIONS = [
  {id: 1, label: 'Destination + ETA', description: 'Single destination name with next arrival time on the right.'},
  {id: 2, label: 'Direction + ETA', description: 'Direction-focused row with next arrival time on the right.'},
  {id: 3, label: 'Stacked Destinations', description: 'Two destination lines stacked in one row with no extra ETA line.'},
  {id: 4, label: 'Destination + Multi ETA', description: 'Single destination with additional ETA values under the main text.'},
  {id: 5, label: 'Direction + Multi ETA', description: 'Direction-focused row with additional ETA values under the main text.'},
] as const;
const PRESET_CAROUSEL_ITEM_WIDTH = 292;
const Haptics = {selectionAsync: async () => {}, notificationAsync: async (_: any) => {}};

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

const getPresetIdForOffset = (offsetX: number) => {
  const nextIndex = Math.round(offsetX / PRESET_CAROUSEL_ITEM_WIDTH);
  const safeIndex = Math.max(0, Math.min(DISPLAY_PRESET_OPTIONS.length - 1, nextIndex));
  return DISPLAY_PRESET_OPTIONS[safeIndex]?.id ?? DISPLAY_PRESET_OPTIONS[0].id;
};

const getPresetBehavior = (presetId: number) => {
  switch (presetId) {
    case 2:
      return {displayFormat: 'single-line' as DisplayFormat, primaryContent: 'direction' as DisplayContent, secondaryContent: 'direction' as DisplayContent, supportsBottomCustom: false};
    case 3:
      return {displayFormat: 'two-line' as DisplayFormat, primaryContent: 'destination' as DisplayContent, secondaryContent: 'direction' as DisplayContent, supportsBottomCustom: true};
    case 4:
      return {displayFormat: 'times-line' as DisplayFormat, primaryContent: 'destination' as DisplayContent, secondaryContent: 'direction' as DisplayContent, supportsBottomCustom: false};
    case 5:
      return {displayFormat: 'times-line' as DisplayFormat, primaryContent: 'direction' as DisplayContent, secondaryContent: 'direction' as DisplayContent, supportsBottomCustom: false};
    case 1:
    default:
      return {displayFormat: 'single-line' as DisplayFormat, primaryContent: 'destination' as DisplayContent, secondaryContent: 'direction' as DisplayContent, supportsBottomCustom: false};
  }
};

const inferDisplayPreset = (
  line: Pick<LinePick, 'displayFormat' | 'primaryContent' | 'secondaryContent'>,
  fallbackPreset = DEFAULT_DISPLAY_PRESET,
) => {
  if (line.displayFormat === 'two-line') return 3;
  if (line.displayFormat === 'times-line') {
    return line.primaryContent === 'direction' ? 5 : 4;
  }
  if (line.primaryContent === 'direction') return 2;
  return fallbackPreset;
};

export default function DisplayEditorScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const {state: appState, setPreset, setSelectedStations, setArrivals: setAppArrivals} = useAppState();
  const params = useLocalSearchParams<{city?: string; from?: string; mode?: string; displayId?: string}>();
  const city = normalizeCityIdParam(params.city ?? appState.selectedCity);
  const isCreateMode = params.mode === 'new';
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
  const [editorStep, setEditorStep] = useState<EditorStep>(isCreateMode ? 'lines' : 'done');
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
  const animateSectionLayout = () => {
    LayoutAnimation.configureNext({
      duration: 180,
      create: {type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity},
      update: {type: LayoutAnimation.Types.easeInEaseOut},
      delete: {type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity},
    });
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
        .then(routes => {
          setRoutesByStation(prev => ({...prev, [key]: routes}));
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
          ? Math.max(1, Math.min(5, Math.trunc(savedDisplayType)))
          : DEFAULT_DISPLAY_PRESET;
        const citySavedLines = savedLines.filter((saved: any) => cityModeFromProvider(saved.provider)?.city === city);
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
            const mapping = cityModeFromProvider(saved.provider);
            let mode: ModeId = mapping?.mode ?? 'train';
            if (saved.provider === 'mbta' && saved.stop) {
              const stopId = saved.stop.trim();
              if (/^Boat-/i.test(stopId)) mode = 'ferry';
              else if (/^\d+$/.test(stopId)) mode = 'bus';
              else if (!/^place-/i.test(stopId)) mode = 'commuter-rail';
            }
            const normalizedSavedStop = saved.stop.trim().toUpperCase();
            const dir: Direction =
              saved.direction === 'S' || (!saved.direction && normalizedSavedStop.endsWith('S')) ? 'downtown' : 'uptown';
            return {
              id: `line-${i + 1}`,
              mode,
              stationId: normalizeSavedStationId(saved.provider, normalizedSavedStop),
              routeId: saved.line,
              direction: dir,
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
            acc[line.id] = Number.isFinite(lineDisplayType)
              ? Math.max(1, Math.min(5, Math.trunc(lineDisplayType)))
              : inferDisplayPreset(line, fallbackDisplayPreset);
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
    () => lines.filter(line => line.stationId.trim().length > 0 && line.routeId.trim().length > 0),
    [lines],
  );
  const activeSelectionKey = useMemo(
    () =>
      activeLiveSelections
        .map(line => `${line.id}:${line.mode}:${line.stationId}:${line.routeId}:${line.direction}`)
        .join('|'),
    [activeLiveSelections],
  );

  useEffect(() => {
    if (!liveSupported || activeLiveSelections.length === 0) return;
    let cancelled = false;

    const pollLiveArrivals = async () => {
      try {
        const updates = await Promise.all(
          activeLiveSelections.map(async line => {
            const liveArrival = await queryClient.fetchQuery({
              queryKey: queryKeys.transitArrivalsForSelection(city, line.mode, line.stationId, line.routeId),
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
      .map(line => ({
        provider: resolveBackendProvider(city, line.mode),
        line: line.routeId,
        stop: line.stationId,
        ...(line.direction ? {direction: line.direction === 'uptown' ? 'N' : 'S'} : {}),
        displayType: displayPresetsByLine[line.id] ?? inferDisplayPreset(line),
        label: line.label.trim() || undefined,
        secondaryLabel: line.secondaryLabel.trim() || undefined,
        textColor: line.textColor || undefined,
        nextStops: line.displayFormat === 'times-line' ? line.nextStops : undefined,
        displayFormat: line.displayFormat,
        primaryContent: line.primaryContent,
        secondaryContent: line.displayFormat === 'two-line' ? line.secondaryContent : undefined,
      }));

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
        displayType: displayPresetsByLine['line-1'] ?? DEFAULT_DISPLAY_PRESET,
        scrolling: displayMetadata.scrolling,
        arrivalsToDisplay: Math.max(1, Math.min(3, payloadLines.length)),
        lines: payloadLines,
      },
    };
  }, [city, customDisplayScheduleEnabled, displayDays, displayMetadata.brightness, displayMetadata.paused, displayMetadata.priority, displayMetadata.scrolling, displayMetadata.sortOrder, displayPresetsByLine, displaySchedule.end, displaySchedule.start, lines, presetName]);

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
              displayType: saveDisplayPresetsByLine['line-1'] ?? DEFAULT_DISPLAY_PRESET,
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
        const result = await saveDisplayMutation.mutateAsync({
          nextDeviceId: selectedDevice.id,
          nextEditingDisplayId: editingDisplayId,
          payload: saveDraftPayload,
        });
        const nextDisplayId = result.nextDisplayId;
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
            return {
              line: route?.label ?? line.routeId,
              destination: arrival?.destination ?? stationName ?? (line.label.trim() || 'Selected stop'),
              minutes: arrival?.minutes ?? 0,
            };
          })
          .filter(item => item.line.trim().length > 0),
      );

      setSaveDone(true);
      void Haptics.notificationAsync?.('success');
      setTimeout(() => setSaveDone(false), 1200);
    } catch {
      setLiveStatusText('We could not save this display right now. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleBackPress = () => {
    if (saveDone) {
      if ((router as any).canGoBack?.()) {
        router.back();
        return;
      }
      router.replace(fallbackRoute);
      return;
    }
    if (isDirty) {
      Alert.alert(
        'Unsaved changes?',
        'Leave without saving? Your changes will be lost.',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => {
              if ((router as any).canGoBack?.()) {
                router.back();
                return;
              }
              router.replace(fallbackRoute);
            },
          },
        ],
        {cancelable: true},
      );
      return;
    }
    if ((router as any).canGoBack?.()) {
      router.back();
      return;
    }
    router.replace(fallbackRoute);
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

  const previewSlots = useMemo(
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

        const displayPreset = displayPresetsByLine[line.id] ?? DEFAULT_DISPLAY_PRESET;
        const etaMinutes = arrival?.minutes != null ? Math.max(0, Math.round(arrival.minutes)) : null;
        const etaText = etaMinutes != null ? `${etaMinutes}m` : '--';
        const etaListText = buildNextArrivalTimes(etaMinutes ?? 2, line.nextStops).join(', ');
        const directionLabel = line.direction === 'downtown' ? 'Downtown' : 'Uptown';
        const stopName = station?.name ?? '';
        const secondaryStopLabel = arrival?.destination ?? station?.area ?? route?.label ?? '';
        const primaryPreviewText = resolveDisplayContent(line.primaryContent, stopName, directionLabel, line.label);
        const secondaryPreviewText = resolveDisplayContent(line.secondaryContent, stopName, directionLabel, line.secondaryLabel);
        const previewTitle = stopName ? primaryPreviewText : '';
        const previewSubLine =
          !stopName
            ? undefined
            : displayPreset === 3
              ? secondaryPreviewText
              : displayPreset === 4 || displayPreset === 5
                ? etaListText
                : undefined;
        const previewSubLineColor = displayPreset === 4 || displayPreset === 5 ? '#E5C15A' : undefined;

        const isBusBadge = city === 'new-york' && safeMode === 'bus';
        const isCommuterRailBadge = safeMode === 'commuter-rail';

        return {
          id: line.id,
          color: route?.color ?? '#3A3A3A',
          textColor: line.textColor || route?.textColor || '#FFFFFF',
          routeLabel: route?.label ?? '?',
          badgeShape: isBusBadge ? 'pill' : isCommuterRailBadge ? 'rail' : 'circle',
          selected: line.id === selectedLineId,
          stopName: previewTitle,
          subLine: previewSubLine,
          subLineColor: previewSubLineColor,
          times: etaText,
        };
      }),
    [arrivals, city, displayPresetsByLine, lines, linesByMode, routesByStation, selectedLineId, stationsByLine, stationsByMode],
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
        ? DISPLAY_PRESET_OPTIONS.find(option => option.id === selectedDisplayPreset)?.label ?? 'Choose style'
        : 'Choose style',
      onPress: selectedLine?.routeId && selectedLine?.stationId ? () => setEditorStep('format') : undefined,
    },
  ] as const;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        scrollEnabled={!previewDragging}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        stickyHeaderIndices={[0]}>
        <View style={styles.stickyTopShell}>
          <Animated.View style={headerAnimatedStyle}>
            <TopBar
              layoutSlots={layoutSlots}
              presetName={presetName}
              onPresetNameChange={setPresetName}
              onLayoutOpen={() => setShowLayoutSelector(true)}
              onBackPress={handleBackPress}
            />
          </Animated.View>

          <Animated.View style={[styles.stickyPreviewShell, previewAnimatedStyle]}>
            <View>
              <View style={styles.stickyPreviewHeader}>
                <Text style={styles.stickyPreviewEyebrow}>Live Display Preview</Text>
              </View>
              <DashboardPreviewSection
                slots={previewSlots}
                displayType={selectedDisplayPreset}
                onSelectSlot={handleSelectSlotForEdit}
                onReorderSlot={reorderLineByHold}
                onDragStateChange={setPreviewDragging}
                showHint={false}
              />
            </View>
          </Animated.View>
        </View>

        {!hasLinkedDevice ? (
          <Pressable style={styles.noDeviceBar} onPress={() => router.push('/register-device')}>
            <Text style={styles.noDeviceText}>No device linked — tap to add one</Text>
          </Pressable>
        ) : null}

        {!liveSupported ? (
          <View style={styles.liveDisabledCard}>
            <Text style={styles.liveDisabledTitle}>Live Transit Unavailable</Text>
            <Text style={styles.liveDisabledBody}>
              Real-time transit is currently supported in New York and Philadelphia only. {CITY_LABELS[city]} does
              not support live stop/line lookups yet.
            </Text>
          </View>
        ) : null}

        <Animated.View style={editorAnimatedStyle}>
          <View style={styles.card}>
            <View style={styles.builderSection}>
              <View style={styles.builderHeader}>
                <View style={styles.builderHeaderCopy}>
                  <Text style={styles.builderTitle}>Build your Display!</Text>
                </View>
              </View>

              <BuilderProgress items={builderProgressItems} />

              {selectedLine ? (
                <Animated.View style={[styles.builderStepPanel, stepAnimatedStyle]}>
                  {editorStep === 'lines' && (
                    <LinePickerStep
                      city={city}
                      selectedMode={normalizeMode(city, selectedLine.mode)}
                      linesByMode={linesByMode}
                      linesLoadingByMode={linesLoadingByMode}
                      selectedRouteId={selectedLine.routeId}
                      onModeChange={mode => updateLine(selectedLine.id, {mode, stationId: '', routeId: ''})}
                      onSelectLine={routeId => {
                        updateLine(selectedLine.id, {routeId, stationId: ''});
                        setEditorStep('stops');
                      }}
                      onBack={handleBackPress}
                    />
                  )}

                  {editorStep === 'stops' && (
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
                      onBack={() => setEditorStep('lines')}
                    />
                  )}

                  {editorStep === 'format' && (
                    <DisplayPresetPickerStep
                      selectedPreset={selectedLinePresetConfirmed ? selectedDisplayPreset : null}
                      line={selectedLine}
                      selectedRoute={selectedRouteForEditor}
                      selectedStation={selectedStationForEditor}
                      arrival={arrivals.find(item => item.lineId === selectedLine.id)}
                      showCompletionHint={false}
                      onChangeLine={next => updateLine(selectedLine.id, next)}
                      onSelect={preset => {
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
                        if (advanceToNextSlotIfNeeded(selectedLine.id)) {
                          return;
                        }
                        setEditorStep('done');
                      }}
                    />
                  )}

                  {editorStep === 'done' && (
                    <ReviewDoneStep
                      line={selectedLine}
                      displayPreset={selectedDisplayPreset}
                      presetConfirmed={selectedLinePresetConfirmed}
                      selectedRoute={selectedRouteForEditor}
                      selectedStation={selectedStationForEditor}
                      onChangeLine={next => updateLine(selectedLine.id, next)}
                      onClearLine={() => clearLineSelection(selectedLine.id)}
                      onClearStop={() => clearStopSelection(selectedLine.id)}
                      onClearDisplayType={() => clearDisplayPreset(selectedLine.id)}
                    />
                  )}
                  {(layoutSlots === 1 || layoutSlots === 2) && selectedLine ? (
                    <View style={styles.stepFooterActionRow}>
                      {layoutSlots === 1 && selectedLine.id === 'line-1' ? (
                        <Pressable style={styles.reviewActionButton} onPress={expandToTwoStops}>
                          <Text style={styles.reviewActionButtonText}>Add Display</Text>
                        </Pressable>
                      ) : null}
                      {layoutSlots === 2 ? (
                        <Pressable style={styles.reviewRemoveButton} onPress={() => removeStopFromLayout(selectedLine.id)}>
                          <Text style={styles.reviewRemoveButtonText}>Remove This Display</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </Animated.View>
              ) : (
                <Text style={styles.emptyHint}>Select a slot in the preview to start editing.</Text>
              )}
            </View>

            <View style={styles.additionalSettingsSection}>
              <Text style={styles.additionalSettingsTitle}>Additional Settings</Text>
              <Text style={styles.additionalSettingsHint}>Optional display controls.</Text>

              <View style={styles.additionalSettingsCard}>
                <View style={styles.additionalSettingsHeader}>
                  <View style={styles.additionalSettingsCopy}>
                    <Text style={styles.sectionLabel}>Display Brightness</Text>
                    <Text style={styles.sectionHint}>Adjust the screen brightness on the device.</Text>
                  </View>
                </View>
                <View style={styles.stepperRow}>
                  <Pressable
                    style={[styles.stepperButton, displayMetadata.brightness <= MIN_BRIGHTNESS && styles.stepperButtonDisabled]}
                    disabled={displayMetadata.brightness <= MIN_BRIGHTNESS}
                    onPress={() =>
                      setDisplayMetadata(prev => ({
                        ...prev,
                        brightness: Math.max(MIN_BRIGHTNESS, prev.brightness - 10),
                      }))
                    }>
                    <Text
                      style={[
                        styles.stepperButtonText,
                        displayMetadata.brightness <= MIN_BRIGHTNESS && styles.stepperButtonTextDisabled,
                      ]}>
                      -
                    </Text>
                  </Pressable>
                  <Text style={styles.stepperValue}>{displayMetadata.brightness}%</Text>
                  <Pressable
                    style={[styles.stepperButton, displayMetadata.brightness >= MAX_BRIGHTNESS && styles.stepperButtonDisabled]}
                    disabled={displayMetadata.brightness >= MAX_BRIGHTNESS}
                    onPress={() =>
                      setDisplayMetadata(prev => ({
                        ...prev,
                        brightness: Math.min(MAX_BRIGHTNESS, prev.brightness + 10),
                      }))
                    }>
                    <Text
                      style={[
                        styles.stepperButtonText,
                        displayMetadata.brightness >= MAX_BRIGHTNESS && styles.stepperButtonTextDisabled,
                      ]}>
                      +
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.additionalSettingsCard}>
                <View style={styles.additionalSettingsHeader}>
                  <View style={styles.additionalSettingsCopy}>
                    <Text style={styles.sectionLabel}>Long Text Scroll</Text>
                    <Text style={styles.sectionHint}>Scroll long text on the device.</Text>
                  </View>
                </View>
                <View style={styles.segmented}>
                  {[
                    {id: 'truncate', label: 'Cut Off', active: !displayMetadata.scrolling},
                    {id: 'scroll', label: 'Scroll', active: displayMetadata.scrolling},
                  ].map(option => (
                    <Pressable
                      key={option.id}
                      style={[styles.segment, option.active && styles.segmentActive]}
                      onPress={() => setDisplayMetadata(prev => ({...prev, scrolling: option.id === 'scroll'}))}>
                      <Text style={[styles.segmentText, option.active && styles.segmentTextActive]}>{option.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.additionalSettingsCard}>
                <Pressable style={styles.collapsibleHeader} onPress={toggleScheduleEditor}>
                  <View style={styles.additionalSettingsCopy}>
                    <Text style={styles.sectionLabel}>Edit Schedule</Text>
                    <Text style={styles.sectionHint}>Set active days and hours.</Text>
                  </View>
                  <View style={styles.collapsibleArrowBubble}>
                    <AnimatedChevron expanded={scheduleExpanded} />
                  </View>
                </Pressable>
                <FadeSection visible={scheduleExpanded}>
                  <View style={styles.collapsibleBody}>
                    <View style={styles.sectionBlock}>
                      <Text style={styles.sectionHint}>Turn this on to limit when the display runs.</Text>
                      <Pressable
                        style={styles.scheduleToggleRow}
                        onPress={() => setCustomDisplayScheduleEnabled(prev => !prev)}>
                        <Text style={styles.scheduleToggleLabel}>Custom Schedule</Text>
                        <ScheduleToggleControl enabled={customDisplayScheduleEnabled} />
                      </Pressable>
                    </View>
                    {customDisplayScheduleEnabled ? (
                      <ScheduleTimingEditor
                        start={displaySchedule.start}
                        end={displaySchedule.end}
                        days={displayDays}
                        onStartChange={start => setDisplaySchedule(prev => ({...prev, start}))}
                        onEndChange={end => setDisplaySchedule(prev => ({...prev, end}))}
                        onToggleDay={day =>
                          setDisplayDays(prev =>
                            prev.includes(day) ? prev.filter(item => item !== day) : [...prev, day],
                          )
                        }
                      />
                    ) : (
                      <View style={styles.schedule24x7Card}>
                        <Text style={styles.schedule24x7Title}>Always On</Text>
                        <Text style={styles.schedule24x7Body}>This display runs all day, every day.</Text>
                      </View>
                    )}
                  </View>
                </FadeSection>
              </View>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
      </KeyboardAvoidingView>

      <SaveBar
        dirty={isDirty}
        loading={saving}
        success={saveDone}
        disabled={!canSaveToDevice}
        message={liveStatusText}
        onPress={handleSave}
      />
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
            <Text style={styles.backButtonText}>Back</Text>
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
              <Text style={styles.presetNameEditEmoji}>✏️</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.topBarSideRight}>
          <Pressable style={styles.layoutPillTopRight} onPress={onLayoutOpen}>
            <Text style={styles.layoutPillTopRightText}>{layoutSlots === 1 ? '1 Display' : '2 Displays'}</Text>
            <Text style={styles.layoutPillChevron}>v</Text>
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
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Number of Displays</Text>
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
              <Text style={[styles.routeCircleText, {color: route.textColor ?? '#fff'}]}>{route.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function DirectionToggle({value, onChange}: {value: Direction; onChange: (direction: Direction) => void}) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionLabel}>Direction</Text>
      <View style={styles.segmented}>
        {(['uptown', 'downtown'] as Direction[]).map(direction => {
          const active = direction === value;
          return (
            <Pressable
              key={direction}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => onChange(direction)}>
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {direction === 'uptown' ? 'Uptown / North' : 'Downtown / South'}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
  selectedPreset,
  line,
  selectedRoute,
  selectedStation,
  arrival,
  showCompletionHint,
  onChangeLine,
  onSelect,
}: {
  selectedPreset: number | null;
  line: LinePick;
  selectedRoute: Route | undefined;
  selectedStation: Station | undefined;
  arrival: Arrival | undefined;
  showCompletionHint: boolean;
  onChangeLine: (next: Partial<LinePick>) => void;
  onSelect: (preset: number) => void;
}) {
  const carouselRef = useRef<ScrollView | null>(null);
  const [visiblePresetId, setVisiblePresetId] = useState<number>(selectedPreset ?? DISPLAY_PRESET_OPTIONS[0].id);
  const directionLabel = line.direction === 'downtown' ? 'Downtown' : 'Uptown';
  const routeLabel = selectedRoute?.label ?? line.routeId ?? '?';
  const routeColor = selectedRoute?.color ?? '#0C7A59';
  const routeTextColor = selectedRoute?.textColor ?? '#E8FFF8';
  const stopLabel = selectedStation?.name?.trim() || 'Selected stop';
  const secondaryStopLabel = selectedStation?.area?.trim() || selectedStation?.name?.trim() || routeLabel || 'Route';
  const etaText = arrival ? `${Math.max(0, Math.round(arrival.minutes))}m` : '2m';
  const etaListText = buildNextArrivalTimes(arrival?.minutes ?? 2, line.nextStops).join(', ');
  useEffect(() => {
    const index = Math.max(0, DISPLAY_PRESET_OPTIONS.findIndex(option => option.id === selectedPreset));
    const presetId = DISPLAY_PRESET_OPTIONS[index]?.id ?? DISPLAY_PRESET_OPTIONS[0].id;
    setVisiblePresetId(presetId);
    carouselRef.current?.scrollTo({x: index * PRESET_CAROUSEL_ITEM_WIDTH, animated: true});
  }, [selectedPreset]);

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
          const nextPresetId = getPresetIdForOffset(event.nativeEvent.contentOffset.x);
          setVisiblePresetId(prev => (prev === nextPresetId ? prev : nextPresetId));
        }}
        scrollEventThrottle={16}
        contentContainerStyle={styles.presetCarousel}>
        {DISPLAY_PRESET_OPTIONS.map((option, index) => {
          const behavior = getPresetBehavior(option.id);
          const primaryText =
            resolveDisplayContent(
              line.label.trim().length > 0 ? 'custom' : behavior.primaryContent,
              stopLabel,
              directionLabel,
              line.label,
            ) || routeLabel || 'Preview';
          const secondaryText =
            resolveDisplayContent(
              behavior.supportsBottomCustom && line.secondaryLabel.trim().length > 0 ? 'custom' : behavior.secondaryContent,
              secondaryStopLabel,
              directionLabel,
              line.secondaryLabel,
            ) || routeLabel || 'Preview';

          return (
            <PresetChoiceCard
              key={option.id}
              option={option}
              index={index}
              active={option.id === selectedPreset}
              routeLabel={routeLabel}
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
        {DISPLAY_PRESET_OPTIONS.map(option => {
          const active = option.id === visiblePresetId;
          return <View key={option.id} style={[styles.presetCarouselIndicator, active && styles.presetCarouselIndicatorActive]} />;
        })}
      </View>
      <View style={styles.customTextEditor}>
        {getPresetBehavior(selectedPreset ?? visiblePresetId).displayFormat === 'times-line' ? (
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
          <Text style={[styles.presetChoiceLabel, active && styles.presetChoiceLabelActive]}>{option.label}</Text>
          <View style={[styles.choiceRowCheck, active && styles.choiceRowCheckActive]}>
            {active ? <Text style={styles.choiceRowCheckText}>✓</Text> : null}
          </View>
        </View>
        <Text style={styles.presetChoiceDescription}>{option.description}</Text>
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
  routeColor = '#0C7A59',
  routeTextColor = '#E8FFF8',
  primaryText = 'Woodlawn',
  secondaryText = 'Uptown',
  etaText = '2m',
  etaListText = '5m, 10m',
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
  const isDirection = presetId === 2 || presetId === 5;
  const isDualLabel = presetId === 3;
  const hasSecondaryEtaLine = presetId === 4 || presetId === 5;

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
      <Text style={styles.stepSubtitle}>Choose whether the device should show one tracked stop or two.</Text>
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
        <View style={[styles.transitionBadge, {backgroundColor: badgeColor ?? '#333'}]}>
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

function LinePickerStep({
  city,
  selectedMode,
  linesByMode,
  linesLoadingByMode,
  selectedRouteId,
  onModeChange,
  onSelectLine,
  onBack,
}: {
  city: CityId;
  selectedMode: ModeId;
  linesByMode: Partial<Record<ModeId, Route[]>>;
  linesLoadingByMode: Partial<Record<ModeId, boolean>>;
  selectedRouteId: string;
  onModeChange: (mode: ModeId) => void;
  onSelectLine: (routeId: string) => void;
  onBack: () => void;
}) {
  const modeOptions = getAvailableModes(city);
  const allRoutes = linesByMode[selectedMode] ?? [];
  const isLoading = !!linesLoadingByMode[selectedMode];
  const [lineSearch, setLineSearch] = useState('');
  const [variantPickerEntry, setVariantPickerEntry] = useState<RoutePickerItem | null>(null);
  const pulseAnims = useRef<Record<string, Animated.Value>>({}).current;

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

  const routeGroups = useMemo(() => buildRouteGroups(city, selectedMode, routes), [city, routes, selectedMode]);

  // Reset search when mode changes
  useEffect(() => { setLineSearch(''); }, [selectedMode]);

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
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Select line</Text>
      <View style={styles.segmented}>
        {modeOptions.map(mode => {
          const active = selectedMode === mode;
          return (
            <Pressable
              key={mode}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => onModeChange(mode)}>
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{getModeLabel(city, mode)}</Text>
            </Pressable>
          );
        })}
      </View>
      {showSearch && !isLoading ? (
        <TextInput
          value={lineSearch}
          onChangeText={setLineSearch}
          placeholder="Filter lines…"
          placeholderTextColor={colors.textMuted}
          style={styles.stepSearchInput}
          autoCorrect={false}
          autoCapitalize="characters"
        />
      ) : null}
      {isLoading ? (
        <View style={styles.lineGridSkeleton}>
          {Array.from({length: 12}).map((_, i) => (
            <View key={i} style={styles.lineGridSkeletonTile} />
          ))}
        </View>
      ) : (
        <View>
          {routes.length === 0 && !isLoading ? (
            <Text style={styles.sectionHint}>
              {lineSearch ? `No lines matching "${lineSearch}".` : 'No lines available for this mode.'}
            </Text>
          ) : (
            <View style={styles.lineGroupList}>
              {routeGroups.map(group => (
                <View key={group.key} style={styles.lineGroup}>
                  {group.title ? <Text style={styles.lineGroupTitle}>{group.title}</Text> : null}
                  <View style={styles.lineGrid}>
                    {group.routes.map(route => {
                      const isSelected = route.routes.some(item => item.id === selectedRouteId);
                      const isBusBadge = city === 'new-york' && selectedMode === 'bus';
                      const isCommuterRailBadge = selectedMode === 'commuter-rail';
                      const isExpress = !isBusBadge && isExpressRouteBadge(city, selectedMode, route);
                      const useCompactBadgeText = isBusBadge && route.displayLabel.length >= 5;
                      const anim = getPulseAnim(route.id);
                      return (
                        <Animated.View key={route.id} style={{transform: [{scale: anim}]}}>
                          <Pressable
                            style={[styles.lineBadgeTile, isSelected && styles.lineBadgeTileActive]}
                            onPress={() => handleSelectLine(route)}>
                              <View
                                style={[
                                  styles.lineBadgeCircle,
                                  isBusBadge && styles.lineBadgeBusPill,
                                  isCommuterRailBadge && styles.lineBadgeCommuterRail,
                                  {backgroundColor: route.color},
                                  isExpress && styles.lineBadgeDiamond,
                                ]}>
                                <Text
                                  adjustsFontSizeToFit={!isCommuterRailBadge}
                                  minimumFontScale={0.74}
                                  numberOfLines={isCommuterRailBadge ? 3 : 1}
                                  style={[
                                    styles.lineBadgeText,
                                    isBusBadge && styles.lineBadgeBusText,
                                    isCommuterRailBadge && styles.lineBadgeCommuterRailText,
                                    useCompactBadgeText && styles.lineBadgeTextCompact,
                                    {color: route.textColor ?? '#fff'},
                                    isExpress && styles.lineBadgeTextDiamond,
                                  ]}>
                                  {route.displayLabel}
                                </Text>
                              </View>
                            </Pressable>
                          </Animated.View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
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
  onBack,
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
  onBack: () => void;
}) {
  const checkAnims = useRef<Record<string, Animated.Value>>({}).current;
  const showBusBadge = isNycBusBadge(city, selectedMode);
  const selectedRouteBadgeLabel = selectedRoute ? formatRoutePickerLabel(city, selectedMode, selectedRoute) : '';

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

  const term = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!term) return stations;
    return stations.filter(s =>
      s.name.toLowerCase().includes(term) || s.area?.toLowerCase().includes(term),
    );
  }, [stations, term]);

  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepNavRow}>
        <Pressable style={styles.stepBackButton} onPress={onBack}>
          <Text style={styles.stepBackText}>← Back</Text>
        </Pressable>
      </View>

      {selectedRoute ? (
        <View style={styles.stopContextBar}>
          <View style={[styles.stopContextBadge, showBusBadge && styles.stopContextBadgeBus, {backgroundColor: selectedRoute.color}]}>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.74}
              numberOfLines={1}
              style={[styles.stopContextBadgeText, showBusBadge && styles.stopContextBadgeTextBus, {color: selectedRoute.textColor ?? '#fff'}]}>
              {selectedRouteBadgeLabel}
            </Text>
          </View>
          <Text style={styles.stopContextLabel}>{selectedRoute.label} line</Text>
        </View>
      ) : null}

      <Text style={styles.stepTitle}>Select stop</Text>
      <DirectionToggle value={selectedDirection} onChange={onSelectDirection} />

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
        <ScrollView style={styles.stopListScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
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
        </ScrollView>
      )}
    </View>
  );
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
  return (
    <Pressable style={[styles.stopRow, selected && styles.stopRowSelected]} onPress={onPress}>
      {showDot && routeColor ? <View style={[styles.stopLineDot, {backgroundColor: routeColor}]} /> : <View style={styles.stopLineDotEmpty} />}
      <View style={styles.stopRowInfo}>
        <Text style={styles.stationName}>{station.name}</Text>
        {station.area ? <Text style={styles.stationMeta}>{station.area}</Text> : null}
      </View>
      {selected ? (
        <Animated.View style={[styles.stopCheckmark, {transform: [{scale: checkAnim}]}]}>
          <Text style={styles.stopCheckmarkText}>✓</Text>
        </Animated.View>
      ) : (
        <Text style={styles.chevron}>Tap</Text>
      )}
    </Pressable>
  );
}

function DoneStep({
  line,
  displayPreset,
  presetConfirmed,
  selectedRoute,
  selectedStation,
  onClearLine,
  onClearStop,
  onClearDisplayType,
}: {
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
  const directionLabel = line.direction === 'downtown' ? 'Downtown / South' : 'Uptown / North';

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
                style={[styles.contextChipBadgeText, showBusBadge && styles.contextChipBadgeTextBus, {color: selectedRoute.textColor ?? '#fff'}]}>
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
            {presetConfirmed ? presetOption?.label ?? `Display Type ${displayPreset}` : 'Choose display type'}
          </Text>
          <Text style={styles.contextChipX}>{presetConfirmed ? 'x' : '>'}</Text>
        </Pressable>
      </View>

      {liveStatusText ? <Text style={styles.sectionHint}>{liveStatusText}</Text> : null}

      <View style={styles.secondarySectionCard}>
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>Device Preset</Text>
          <Text style={styles.sectionHint}>
            {presetConfirmed ? presetOption?.label ?? `Display Type ${displayPreset}` : 'Not selected yet'}
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
  const directionLabel = line.direction === 'downtown' ? 'Downtown / South' : 'Uptown / North';
  const activePresetBehavior = getPresetBehavior(displayPreset);
  const topPlaceholder = resolveDisplayContent(
    activePresetBehavior.primaryContent,
    selectedStation?.name?.trim() || 'Selected stop',
    line.direction === 'downtown' ? 'Downtown' : 'Uptown',
    '',
  );
  const bottomPlaceholder = resolveDisplayContent(
    activePresetBehavior.secondaryContent,
    selectedStation?.area?.trim() || selectedStation?.name?.trim() || selectedRoute?.label || 'Route',
    line.direction === 'downtown' ? 'Downtown' : 'Uptown',
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
          value={presetConfirmed ? presetOption?.label ?? `Display Type ${displayPreset}` : 'Not selected'}
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

