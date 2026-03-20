import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Animated, Easing, Keyboard, KeyboardAvoidingView, LayoutAnimation, Modal, Platform, Pressable, ScrollView, Text, TextInput, UIManager, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {colors} from '../../../theme';
import DashboardPreviewSection from '../components/DashboardPreviewSection';
import {useAppState} from '../../../state/appState';
import {CITY_LABELS, type CityId} from '../../../constants/cities';
import type {DisplayContent, DisplayFormat} from '../../../types/transit';
import type {Display3DSlot} from '../components/Display3DPreview';
import {apiFetch} from '../../../lib/api';
import {createDisplay, fetchDisplay, fetchDisplays, updateDisplay, validateDisplayDraft} from '../../../lib/displays';
import {useAuth} from '../../../state/authProvider';
import {useSelectedDevice} from '../../../hooks/useSelectedDevice';
import {
  areSameLinePicks,
  buildNextArrivalTimes,
  buildRouteGroups,
  cityModeFromProvider,
  clampNextStops,
  cycleTimeOption,
  describePresetBehavior,
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
type EditorStep = 'format' | 'line-transition' | 'lines' | 'stop-transition' | 'stops' | 'done-transition' | 'done';
type RoutePickerItem = {id: string; label: string; displayLabel: string; color: string; textColor?: string; routes: Route[]};
type RouteGroup = {key: string; title?: string; routes: RoutePickerItem[]};

const DEFAULT_TEXT_COLOR = '#E9ECEF';
const DEFAULT_NEXT_STOPS = 3;
const MIN_NEXT_STOPS = 2;
const MAX_NEXT_STOPS = 5;
const DEFAULT_LAYOUT_SLOTS = 2;
const DEFAULT_DISPLAY_PRESET = 1;
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
  {id: 1, label: 'Preset 1', hint: 'Default destination with ETA on the right.'},
  {id: 2, label: 'Preset 2', hint: 'Direction-focused label with the same base layout.'},
  {id: 3, label: 'Preset 3', hint: 'Two-line compact label stack.'},
  {id: 4, label: 'Preset 4', hint: 'Destination with extra ETA line underneath.'},
  {id: 5, label: 'Preset 5', hint: 'Direction with extra ETA line underneath.'},
] as const;
const Haptics = {selectionAsync: async () => {}, notificationAsync: async (_: any) => {}};

export default function DisplayEditorScreen() {
  const router = useRouter();
  const {state: appState, setPreset, setSelectedStations, setArrivals: setAppArrivals} = useAppState();
  const params = useLocalSearchParams<{city?: string; from?: string; mode?: string; displayId?: string}>();
  const city = normalizeCityIdParam(params.city ?? appState.selectedCity);
  const isCreateMode = params.mode === 'new';
  const openConfigureStopOnLoad = params.mode === 'new';
  const fallbackRoute = params.from === 'presets' ? '/presets' : '/dashboard';
  const headerEnter = useRef(new Animated.Value(0)).current;
  const previewEnter = useRef(new Animated.Value(0)).current;
  const editorEnter = useRef(new Animated.Value(0)).current;
  const liveSupported = isLiveCitySupported(city);
  const {deviceId, deviceIds, setDeviceId} = useAuth();
  const selectedDevice = useSelectedDevice();
  const hasLinkedDevice = deviceIds.length > 0;
  const [layoutSlots, setLayoutSlots] = useState<number>(DEFAULT_LAYOUT_SLOTS);
  const [displayPreset, setDisplayPreset] = useState<number>(DEFAULT_DISPLAY_PRESET);
  const [lines, setLines] = useState<LinePick[]>(() => ensureLineCount([], city, DEFAULT_LAYOUT_SLOTS, {}, {}));
  const [selectedLineId, setSelectedLineId] = useState<string>(openConfigureStopOnLoad ? 'line-1' : '');
  const [stationSearch, setStationSearch] = useState<Record<string, string>>({});
  const [layoutExpanded, setLayoutExpanded] = useState(openConfigureStopOnLoad);
  const [slotEditorExpanded, setSlotEditorExpanded] = useState(isCreateMode);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [customDisplayScheduleEnabled, setCustomDisplayScheduleEnabled] = useState(false);
  const [displaySchedule, setDisplaySchedule] = useState({start: '06:00', end: '09:00'});
  const [displayDays, setDisplayDays] = useState<DayId[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [presetName, setPresetName] = useState('Display 1');
  const [editingDisplayId, setEditingDisplayId] = useState<string | null>(
    typeof params.displayId === 'string' ? params.displayId : null,
  );
  const [displayMetadata, setDisplayMetadata] = useState({paused: false, priority: 0, sortOrder: 0});
  const [saving, setSaving] = useState(false);
  const [saveDone, setSaveDone] = useState(false);
  const [openLayoutPicker, setOpenLayoutPicker] = useState(false);
  const [previewDragging, setPreviewDragging] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [stationsByMode, setStationsByMode] = useState<StationsByMode>({});
  const [stationsLoadingByMode, setStationsLoadingByMode] = useState<Partial<Record<ModeId, boolean>>>({});
  const [stationsByLine, setStationsByLine] = useState<Partial<Record<string, Station[]>>>({});
  const [stationsLoadingByLine, setStationsLoadingByLine] = useState<Partial<Record<string, boolean>>>({});
  const [routesByStation, setRoutesByStation] = useState<RoutesByStation>({});
  const [routesLoadingByStation, setRoutesLoadingByStation] = useState<Record<string, boolean>>({});
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [liveStatusText, setLiveStatusText] = useState('');
  const [editorStep, setEditorStep] = useState<EditorStep>(openConfigureStopOnLoad ? 'lines' : 'done');
  const [transitionLabel, setTransitionLabel] = useState('');
  const [linesByMode, setLinesByMode] = useState<Partial<Record<ModeId, Route[]>>>({});
  const [linesLoadingByMode, setLinesLoadingByMode] = useState<Partial<Record<ModeId, boolean>>>({});
  const stepAnim = useRef(new Animated.Value(1)).current;
  const stationsByLineRef = useRef(new Set<string>());
  const linesRequestedRef = useRef(new Set<string>());
  const stationsRequestedRef = useRef(new Set<string>());
  const routesRequestedRef = useRef(new Set<string>());
  const previousCityRef = useRef(city);
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
    setLines(prev => ensureLineCount(cityChanged ? [] : prev, city, layoutSlots, {}, {}));
  }, [city, layoutSlots]);

  useEffect(() => {
    setLines(prev => {
      const normalized = ensureLineCount(prev, city, layoutSlots, stationsByMode, routesByStation);
      return areSameLinePicks(prev, normalized) ? prev : normalized;
    });
  }, [city, layoutSlots, routesByStation, stationsByMode]);

  useEffect(() => {
    if (!liveSupported) return;
    const requestedModes = [...new Set(lines.map(line => normalizeMode(city, line.mode)))];
    requestedModes.forEach(mode => {
      const key = `${city}:${mode}`;
      if (stationsRequestedRef.current.has(key)) return;
      stationsRequestedRef.current.add(key);
      setStationsLoadingByMode(prev => ({...prev, [mode]: true}));
      void loadStationsForCityMode(city, mode)
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
  }, [city, lines, liveSupported]); // stationsRequestedRef guards against duplicates

  useEffect(() => {
    if (!liveSupported) return;
    const uniqueModes = [...new Set(lines.map(line => normalizeMode(city, line.mode)))];
    uniqueModes.forEach(mode => {
      const key = `${city}:${mode}`;
      if (linesRequestedRef.current.has(key)) return;
      linesRequestedRef.current.add(key);
      setLinesLoadingByMode(prev => ({...prev, [mode]: true}));
      void loadGlobalLinesForCityMode(city, mode)
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
  }, [city, lines, liveSupported]); // linesRequestedRef guards against duplicates — no cancellation needed

  const selectedLine = lines.find(line => line.id === selectedLineId) ?? null;
  const selectedLineIndex = selectedLine ? lines.findIndex(line => line.id === selectedLine.id) : -1;

  useEffect(() => {
    if (!liveSupported || !selectedLine?.routeId) return;
    const safeMode = normalizeMode(city, selectedLine.mode);
    const routeId = selectedLine.routeId;
    const key = `${city}:${safeMode}:${routeId}`;
    if (stationsByLineRef.current.has(key)) return;
    stationsByLineRef.current.add(key);
    setStationsLoadingByLine(prev => ({...prev, [routeId]: true}));
    void loadStopsForLine(city, safeMode, routeId)
      .then(stations => setStationsByLine(prev => ({...prev, [routeId]: stations})))
      .catch(() => setStationsByLine(prev => ({...prev, [routeId]: []})))
      .finally(() => setStationsLoadingByLine(prev => ({...prev, [routeId]: false})));
  }, [city, liveSupported, selectedLine?.routeId, selectedLine?.mode]);

  useEffect(() => {
    if (!isCreateMode || !deviceId) return;
    fetchDisplays(deviceId)
      .then(({displays}) => {
        const names = new Set(displays.map(d => d.name));
        let n = displays.length + 1;
        while (names.has(`Display ${n}`)) n++;
        setPresetName(`Display ${n}`);
      })
      .catch(() => {});
  }, [isCreateMode, deviceId]);

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
      void loadRoutesForStation(city, item.mode, item.stationId)
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
  }, [city, lines, liveSupported]); // routesRequestedRef guards against duplicates

  useEffect(() => {
    setArrivals(prev => syncArrivals(prev, lines));
  }, [lines]);

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
          sourceDisplay = await fetchDisplay(selectedDevice.id, editingDisplayId);
        } else if (!isCreateMode) {
          const res = await apiFetch(`/device/${selectedDevice.id}/config`);
          if (!res.ok || cancelled) return;
          const data = await res.json();
          sourceDisplay = data?.display ?? null;
        }
        if (!sourceDisplay || cancelled) return;

        const savedLines: Array<any> = Array.isArray(sourceDisplay?.config?.lines) ? sourceDisplay.config.lines : [];
        const savedDisplayType = Number(sourceDisplay?.config?.displayType);
        const nextDisplayPreset = Number.isFinite(savedDisplayType)
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
          setDisplayPreset(nextDisplayPreset);
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
          snapshotRef.current = {
            city,
            layoutSlots: nextLayoutSlots,
            displayPreset: nextDisplayPreset,
            lines: nextLines,
            displaySchedule: nextDisplaySchedule,
            displayDays: nextDisplayDays,
            presetName: nextPresetName,
            customDisplayScheduleEnabled: nextCustomScheduleEnabled,
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
  }, [city, editingDisplayId, hasLinkedDevice, isCreateMode, selectedDevice.id]);

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
            const liveArrival = await loadArrivalForSelection(city, line);
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
  }, [activeSelectionKey, activeLiveSelections, city, lines, liveSupported]);

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

  const snapshotRef = useRef({city, layoutSlots, displayPreset, lines, displaySchedule, displayDays, presetName, customDisplayScheduleEnabled});
  const isDirty = useMemo(() => {
    const snap = snapshotRef.current;
    return (
      snap.city !== city ||
      snap.layoutSlots !== layoutSlots ||
      snap.displayPreset !== displayPreset ||
      snap.presetName !== presetName ||
      snap.customDisplayScheduleEnabled !== customDisplayScheduleEnabled ||
      snap.displaySchedule.start !== displaySchedule.start ||
      snap.displaySchedule.end !== displaySchedule.end ||
      JSON.stringify(snap.displayDays) !== JSON.stringify(displayDays) ||
      JSON.stringify(snap.lines) !== JSON.stringify(lines)
    );
  }, [city, customDisplayScheduleEnabled, displayDays, displayPreset, displaySchedule.end, displaySchedule.start, layoutSlots, lines, presetName]);

  const draftPayload = useMemo(() => {
    const payloadLines = lines
      .filter(line => line.stationId && line.routeId)
      .map(line => ({
        provider: resolveBackendProvider(city, line.mode),
        line: line.routeId,
        stop: line.stationId,
        ...(line.direction ? {direction: line.direction === 'uptown' ? 'N' : 'S'} : {}),
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
        brightness: 60,
        displayType: displayPreset,
        scrolling: false,
        arrivalsToDisplay: Math.max(1, Math.min(3, lines.length)),
        lines: payloadLines,
      },
    };
  }, [city, customDisplayScheduleEnabled, displayDays, displayMetadata.paused, displayMetadata.priority, displayMetadata.sortOrder, displayPreset, displaySchedule.end, displaySchedule.start, lines, presetName]);

  const displayValidationError = useMemo(() => validateDisplayDraft(draftPayload), [draftPayload]);

  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    setSaveDone(false);

    try {
      if (hasLinkedDevice && selectedDevice.id) {
        if (displayValidationError) {
          setLiveStatusText(displayValidationError);
          setSaving(false);
          return;
        }

        try {
          const result = editingDisplayId
            ? await updateDisplay(selectedDevice.id, editingDisplayId, draftPayload)
            : await createDisplay(selectedDevice.id, draftPayload);
          const nextDisplayId =
            typeof result?.displayId === 'string'
              ? result.displayId
              : typeof result?.display?.displayId === 'string'
                ? result.display.displayId
                : editingDisplayId;
          if (nextDisplayId) {
            setEditingDisplayId(nextDisplayId);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Save failed';
          setLiveStatusText(msg);
          setSaving(false);
          return;
        }
        await apiFetch(`/refresh/device/${selectedDevice.id}`, {method: 'POST'});
      }

      snapshotRef.current = {city, layoutSlots, displayPreset, lines, displaySchedule, displayDays, presetName, customDisplayScheduleEnabled};
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
      setLiveStatusText('Network error — config not saved');
    } finally {
      setSaving(false);
    }
  };

  const handleBackPress = () => {
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
    const safeSlots = slots === 1 ? 1 : 2;
    if (safeSlots === layoutSlots) return;
    setLayoutSlots(safeSlots);
    setLines(prev => ensureLineCount(prev, city, safeSlots, stationsByMode, routesByStation));
    setSelectedLineId('line-1');
    void Haptics.selectionAsync();
  };

  const updateLine = (id: string, next: Partial<LinePick>) => {
    setLines(prev =>
      prev.map(line =>
        line.id === id ? normalizeLine(city, {...line, ...next}, stationsByMode, routesByStation) : line,
      ),
    );
  };

  const handleSelectSlotForEdit = (id: string) => {
    if (slotEditorExpanded && selectedLineId === id) {
      setSlotEditorExpanded(false);
      setSelectedLineId('');
      return;
    }
    const line = lines.find(l => l.id === id);
    setSelectedLineId(id);
    setLayoutExpanded(false);
    setSlotEditorExpanded(true);
    setEditorStep(line && line.stationId && line.routeId ? 'done' : 'lines');
  };

  const toggleLayoutEditor = () => {
    setLayoutExpanded(prev => {
      if (!prev) setSlotEditorExpanded(false);
      return !prev;
    });
  };

  const toggleSlotEditor = () => {
    setSlotEditorExpanded(prev => {
      const next = !prev;
      if (!next) {
        setSelectedLineId('');
        return next;
      }
      setLayoutExpanded(false);
      if (!selectedLineId) {
        const firstLine = lines[0];
        setSelectedLineId(firstLine?.id ?? '');
        setEditorStep(firstLine && firstLine.stationId && firstLine.routeId ? 'done' : 'lines');
      }
      return next;
    });
  };

  const toggleScheduleEditor = () => {
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

  const playStepTransition = (message: string, next: EditorStep, delayMs = 700) => {
    const transitionStep: EditorStep =
      next === 'lines' ? 'line-transition' :
      next === 'stops' ? 'stop-transition' : 'done-transition';
    setTransitionLabel(message);
    if (delayMs <= 0) {
      setEditorStep(next);
      return;
    }
    setEditorStep(transitionStep);
    setTimeout(() => setEditorStep(next), delayMs);
  };

  const previewSlots = useMemo(
    () =>
      lines.map(line => {
        const safeMode = normalizeMode(city, line.mode);
        const station = resolveSelectedStationForLine(line, city, stationsByMode, stationsByLine);
        const lineRoutes = routesByStation[routeLookupKey(safeMode, line.stationId)] ?? [];
        const route = lineRoutes.find(item => item.id === line.routeId);
        const arrival = arrivals.find(item => item.lineId === line.id);

        const t0 = arrival?.minutes != null ? String(arrival.minutes) : '—';

        return {
          id: line.id,
          color: route?.color ?? '#3A3A3A',
          textColor: line.textColor || route?.textColor || '#FFFFFF',
          routeLabel: route?.label ?? '?',
          selected: line.id === selectedLineId,
          stopName: station?.name || 'Select stop',
          subLine: undefined,
          times: t0,
        };
      }),
    [arrivals, city, displayPreset, lines, routesByStation, selectedLineId, stationsByLine, stationsByMode],
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
      <ScrollView contentContainerStyle={styles.scroll} scrollEnabled={!previewDragging} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Animated.View style={headerAnimatedStyle}>
          <TopBar
            layoutSlots={layoutSlots}
            displayPreset={displayPreset}
            presetName={presetName}
            onPresetNameChange={setPresetName}
            onLayoutOpen={() => setOpenLayoutPicker(true)}
            onBackPress={handleBackPress}
          />
        </Animated.View>

        {hasLinkedDevice ? (
          <View style={styles.deviceBar}>
            <View style={[styles.deviceDot, selectedDevice.status === 'Online' ? styles.deviceDotOnline : styles.deviceDotOffline]} />
            {deviceIds.length > 1 ? (
              deviceIds.map(id => (
                <Pressable
                  key={id}
                  style={[styles.deviceChip, deviceId === id && styles.deviceChipActive]}
                  onPress={() => setDeviceId(id)}>
                  <Text style={[styles.deviceChipText, deviceId === id && styles.deviceChipTextActive]}>{id}</Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.deviceLabel}>{deviceId ?? selectedDevice.id}</Text>
            )}
            <Text style={[styles.deviceStatus, selectedDevice.status === 'Online' ? styles.deviceStatusOnline : styles.deviceStatusOffline]}>
              {selectedDevice.status}
            </Text>
          </View>
        ) : (
          <Pressable style={styles.noDeviceBar} onPress={() => router.push('/register-device')}>
            <Text style={styles.noDeviceText}>No device linked — tap to add one</Text>
          </Pressable>
        )}

        <Animated.View style={previewAnimatedStyle}>
          <DashboardPreviewSection
            slots={previewSlots}
            displayType={displayPreset}
            onSelectSlot={handleSelectSlotForEdit}
            onReorderSlot={reorderLineByHold}
            onDragStateChange={setPreviewDragging}
          />
        </Animated.View>

        {!liveSupported ? (
          <View style={styles.liveDisabledCard}>
            <Text style={styles.liveDisabledTitle}>Live Transit Unavailable</Text>
            <Text style={styles.liveDisabledBody}>
              Real-time transit is currently supported in New York and Philadelphia only. {CITY_LABELS[city]} does
              not support live stop/line lookups yet.
            </Text>
          </View>
        ) : null}

        <SimplePicker
          visible={openLayoutPicker}
          options={LAYOUT_OPTIONS.map(option => ({id: String(option.slots), label: option.label}))}
          value={String(layoutSlots)}
          onSelect={val => {
            applyLayout(Number(val));
            setOpenLayoutPicker(false);
          }}
          onClose={() => setOpenLayoutPicker(false)}
        />

        <Animated.View style={editorAnimatedStyle}>
          <View style={styles.card}>
            <View style={styles.collapsibleSection}>
              <Pressable style={styles.collapsibleHeader} onPress={toggleSlotEditor}>
                <Text style={styles.sectionLabel}>
                  {selectedLine ? `Configure Stop ${selectedLineIndex + 1}` : 'Configure Stop'}
                </Text>
                <View style={styles.collapsibleArrowBubble}>
                  <Text style={styles.collapsibleArrow}>{slotEditorExpanded ? '▲' : '▼'}</Text>
                </View>
              </Pressable>

              {slotEditorExpanded ? (
                selectedLine ? (
                  <View style={styles.collapsibleBody}>
                    {(editorStep === 'line-transition' || editorStep === 'stop-transition' || editorStep === 'done-transition') && (
                      <StepTransitionMessage
                        message={transitionLabel}
                        badgeLabel={
                          editorStep !== 'line-transition'
                            ? (linesByMode[normalizeMode(city, selectedLine.mode)] ?? []).find(r => r.id === selectedLine.routeId)?.label
                            : undefined
                        }
                        badgeColor={
                          editorStep !== 'line-transition'
                            ? (linesByMode[normalizeMode(city, selectedLine.mode)] ?? []).find(r => r.id === selectedLine.routeId)?.color
                            : undefined
                        }
                      />
                    )}

                    {editorStep === 'lines' && (
                      <LinePickerStep
                        city={city}
                        selectedMode={normalizeMode(city, selectedLine.mode)}
                        linesByMode={linesByMode}
                        linesLoadingByMode={linesLoadingByMode}
                        selectedRouteId={selectedLine.routeId}
                        onModeChange={mode => updateLine(selectedLine.id, {mode, stationId: '', routeId: ''})}
                        onSelectLine={routeId => {
                          const safeMode = normalizeMode(city, selectedLine.mode);
                          const route = (linesByMode[safeMode] ?? []).find(r => r.id === routeId);
                          updateLine(selectedLine.id, {routeId, stationId: ''});
                          playStepTransition(
                            `Loading stops for the ${route?.label ?? routeId}…`,
                            'stops',
                            0,
                          );
                        }}
                        onBack={() => { setSlotEditorExpanded(false); setLayoutExpanded(true); }}
                      />
                    )}

                      {editorStep === 'stops' && (
                        <StopPickerStep
                          city={city}
                          selectedMode={normalizeMode(city, selectedLine.mode)}
                          selectedRoute={(linesByMode[normalizeMode(city, selectedLine.mode)] ?? []).find(r => r.id === selectedLine.routeId)}
                          stations={stationsByLine[selectedLine.routeId] ?? []}
                          loading={!!stationsLoadingByLine[selectedLine.routeId]}
                        selectedStationId={selectedLine.stationId}
                        selectedRouteId={selectedLine.routeId}
                        search={stationSearch[selectedLine.id] ?? ''}
                        onSearch={text => setStationSearch(prev => ({...prev, [selectedLine.id]: text}))}
                        onSelectStation={id => {
                          updateLine(selectedLine.id, {stationId: id});
                          playStepTransition('All set! Loading arrivals…', 'done', 0);
                        }}
                        onBack={() => setEditorStep('lines')}
                      />
                    )}

                    {editorStep === 'done' && (
                      <DoneStep
                        city={city}
                        displayPreset={displayPreset}
                        line={selectedLine}
                        selectedRoute={
                          (routesByStation[routeLookupKey(normalizeMode(city, selectedLine.mode), selectedLine.stationId)] ?? []).find(
                            r => r.id === selectedLine.routeId,
                          )
                        }
                        selectedStation={resolveSelectedStationForLine(selectedLine, city, stationsByMode, stationsByLine)}
                        liveStatusText={liveStatusText}
                        onChangeLine={() => setEditorStep('lines')}
                        onChangeStop={() => setEditorStep('stops')}
                        onChange={updateLine}
                      />
                    )}
                  </View>
                ) : (
                  <Text style={styles.emptyHint}>Select a slot in the preview to start editing.</Text>
                )
              ) : null}
            </View>

            <View style={styles.collapsibleSection}>
              <Pressable style={styles.collapsibleHeader} onPress={toggleLayoutEditor}>
                <Text style={styles.sectionLabel}>Layout + Preset</Text>
                <View style={styles.collapsibleArrowBubble}>
                  <Text style={styles.collapsibleArrow}>{layoutExpanded ? '▲' : '▼'}</Text>
                </View>
              </Pressable>

              {layoutExpanded ? (
                <View style={styles.collapsibleBody}>
                  <DisplayPresetPickerStep selectedPreset={displayPreset} onSelect={setDisplayPreset} />
                </View>
              ) : null}
            </View>

            <View style={styles.collapsibleSection}>
              <Pressable style={styles.collapsibleHeader} onPress={toggleScheduleEditor}>
                <Text style={styles.sectionLabel}>Display Schedule</Text>
                <View style={styles.collapsibleArrowBubble}>
                  <Text style={styles.collapsibleArrow}>{scheduleExpanded ? '▲' : '▼'}</Text>
                </View>
              </Pressable>
              {scheduleExpanded ? (
                <View style={styles.collapsibleBody}>
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionHint}>Turn on custom schedule to choose specific days and times. Turn it off to display 24/7.</Text>
                    <Pressable
                      style={styles.scheduleToggleRow}
                      onPress={() => setCustomDisplayScheduleEnabled(prev => !prev)}>
                      <Text style={styles.scheduleToggleLabel}>Custom Schedule</Text>
                      <View style={[styles.scheduleToggle, customDisplayScheduleEnabled && styles.scheduleToggleOn]}>
                        <View
                          style={[
                            styles.scheduleToggleThumb,
                            customDisplayScheduleEnabled && styles.scheduleToggleThumbOn,
                          ]}
                        />
                      </View>
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
                      <Text style={styles.schedule24x7Body}>This display will show 24/7 and ignore custom day/time scheduling.</Text>
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          </View>
        </Animated.View>
      </ScrollView>
      </KeyboardAvoidingView>

      <SaveBar
        dirty={isDirty}
        loading={saving}
        success={saveDone}
        disabledReason={displayValidationError}
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
    </SafeAreaView>
  );
}

function TopBar({
  layoutSlots,
  displayPreset,
  presetName,
  onPresetNameChange,
  onLayoutOpen,
  onBackPress,
}: {
  layoutSlots: number;
  displayPreset: number;
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
            <Text style={styles.layoutPillTopRightText}>
              {layoutSlots === 1 ? '1 Stop' : '2 Stops'}
            </Text>
            <Text style={styles.layoutPillChevron}>▾</Text>
          </Pressable>
        </View>
      </View>

      {renameOpen ? (
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
      ) : null}
    </View>
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
  disabledReason,
  onPress,
}: {
  dirty: boolean;
  loading: boolean;
  success: boolean;
  disabledReason?: string | null;
  onPress: () => void;
}) {
  const disabled = !dirty || loading || !!disabledReason;
  return (
    <View style={styles.saveBar}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        style={[styles.saveButton, disabled && styles.saveButtonDisabled, success && styles.saveButtonSuccess]}>
        <Text style={styles.saveButtonText}>{loading ? 'Saving...' : success ? 'Synced' : 'Save to Device'}</Text>
      </Pressable>
      <Text style={styles.saveHint}>
        {success ? 'Last synced just now' : disabledReason ? disabledReason : dirty ? 'Unsaved changes' : 'No changes'}
      </Text>
    </View>
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
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalSheet}>
          {options.map(option => (
            <Pressable
              key={option.id}
              style={[styles.modalOption, option.id === value && styles.modalOptionActive]}
              onPress={() => onSelect(option.id)}>
              <Text style={[styles.modalOptionText, option.id === value && styles.modalOptionTextActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

function DisplayPresetPickerStep({
  selectedPreset,
  onSelect,
}: {
  selectedPreset: number;
  onSelect: (preset: number) => void;
}) {
  return (
    <View style={styles.stepSection}>
      <Text style={styles.stepTitle}>Which device preset?</Text>
      <Text style={styles.stepSubtitle}>This maps directly to the ESP render preset.</Text>
      <View style={styles.choiceList}>
        {DISPLAY_PRESET_OPTIONS.map(option => {
          const active = option.id === selectedPreset;
          return (
            <Pressable
              key={option.id}
              style={[styles.choiceRow, active && styles.choiceRowActive]}
              onPress={() => onSelect(option.id)}>
              <View style={styles.choiceRowCopy}>
                <Text style={[styles.choiceRowLabel, active && styles.choiceRowLabelActive]}>{option.label}</Text>
                <Text style={[styles.choiceRowHint, active && styles.choiceRowHintActive]}>{option.hint}</Text>
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
      <Text style={styles.stepTitle}>Pick a line</Text>
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
  search,
  onSearch,
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
  search: string;
  onSearch: (text: string) => void;
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

      <Text style={styles.stepTitle}>Which stop?</Text>

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
  city,
  displayPreset,
  line,
  selectedRoute,
  selectedStation,
  liveStatusText,
  onChangeLine,
  onChangeStop,
  onChange,
}: {
  city: CityId;
  displayPreset: number;
  line: LinePick;
  selectedRoute: Route | undefined;
  selectedStation: Station | undefined;
  liveStatusText: string;
  onChangeLine: () => void;
  onChangeStop: () => void;
  onChange: (id: string, next: Partial<LinePick>) => void;
}) {
  const mode = normalizeMode(city, line.mode);
  const showBusBadge = isNycBusBadge(city, mode);
  const selectedRouteBadgeLabel = selectedRoute ? formatRoutePickerLabel(city, mode, selectedRoute) : '';
  const presetOption = DISPLAY_PRESET_OPTIONS.find(option => option.id === displayPreset);
  const presetBehavior = describePresetBehavior(displayPreset);

  return (
    <View style={styles.doneStepContainer}>
      <View style={styles.contextChipRow}>
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
      </View>

      {liveStatusText ? <Text style={styles.sectionHint}>{liveStatusText}</Text> : null}

      <View style={styles.secondarySectionCard}>
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>Device Preset</Text>
          <Text style={styles.sectionHint}>
            {presetOption ? `${presetOption.label}: ${presetOption.hint}` : `Preset ${displayPreset}`}
          </Text>
        </View>
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>What The ESP Shows</Text>
          <Text style={styles.sectionHint}>{presetBehavior.primary}</Text>
          {presetBehavior.secondary ? <Text style={styles.sectionHint}>{presetBehavior.secondary}</Text> : null}
        </View>
        <DirectionToggle value={line.direction} onChange={direction => onChange(line.id, {direction})} />
        <Text style={styles.sectionHint}>
          Direction is saved to the backend and controls which service/platform the display follows.
        </Text>
      </View>
    </View>
  );
}
