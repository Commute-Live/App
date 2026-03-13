import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {colors, radii, spacing} from '../../../theme';
import DashboardPreviewSection from '../components/DashboardPreviewSection';
import {useAppState} from '../../../state/appState';
import {CITY_LABELS, CITY_BRANDS, normalizeCityId, type CityId} from '../../../constants/cities';
import {getTransitArrivals, getTransitLines, getTransitStations, getGlobalTransitLines, getTransitStopsForLine} from '../../../lib/transitApi';
import type {TransitArrival, TransitUiMode, DisplayFormat} from '../../../types/transit';
import Display3DPreview from '../components/Display3DPreview';
import type {Display3DSlot} from '../components/Display3DPreview';
import {CITY_LINE_COLORS, FALLBACK_ROUTE_COLORS, hashLineColor} from '../../../lib/lineColors';

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
  textColor: string;
  nextStops: number;
  displayFormat: DisplayFormat;
};
type StationsByMode = Partial<Record<ModeId, Station[]>>;
type RoutesByStation = Record<string, Route[]>;
type EditorStep = 'format' | 'line-transition' | 'lines' | 'stop-transition' | 'stops' | 'done-transition' | 'done';

const DEFAULT_TEXT_COLOR = '#E9ECEF';
const DEFAULT_NEXT_STOPS = 3;
const MAX_NEXT_STOPS = 3;
const DEFAULT_LAYOUT_SLOTS = 2;
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
const MODE_ORDER: ModeId[] = ['train', 'bus', 'trolley', 'commuter-rail', 'ferry'];
const LIVE_SUPPORTED_CITIES: CityId[] = ['new-york', 'philadelphia', 'boston', 'chicago'];
const CITY_MODE_ORDER: Record<CityId, ModeId[]> = {
  'new-york': ['train', 'bus', 'commuter-rail'],
  philadelphia: ['train', 'trolley', 'bus'],
  boston: ['train', 'bus', 'commuter-rail', 'ferry'],
  chicago: ['train', 'bus'],
};

const Haptics = {selectionAsync: async () => {}, notificationAsync: async (_: any) => {}};
export default function DashboardScreen() {
  const router = useRouter();
  const {state: appState, setPreset, setSelectedStations, setArrivals: setAppArrivals} = useAppState();
  const params = useLocalSearchParams<{city?: string; from?: string; mode?: string}>();
  const city = normalizeCityIdParam(params.city ?? appState.selectedCity);
  const openConfigureStopOnLoad = params.mode === 'new';
  const fallbackRoute = params.from === 'presets' ? '/presets' : '/dashboard';
  const headerEnter = useRef(new Animated.Value(0)).current;
  const previewEnter = useRef(new Animated.Value(0)).current;
  const editorEnter = useRef(new Animated.Value(0)).current;
  const liveSupported = isLiveCitySupported(city);
  const [layoutSlots, setLayoutSlots] = useState<number>(DEFAULT_LAYOUT_SLOTS);
  const [lines, setLines] = useState<LinePick[]>(() => ensureLineCount([], city, DEFAULT_LAYOUT_SLOTS, {}, {}));
  const [selectedLineId, setSelectedLineId] = useState<string>(openConfigureStopOnLoad ? 'line-1' : '');
  const [stationSearch, setStationSearch] = useState<Record<string, string>>({});
  const [layoutExpanded, setLayoutExpanded] = useState(openConfigureStopOnLoad);
  const [slotEditorExpanded, setSlotEditorExpanded] = useState(false);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [customDisplayScheduleEnabled, setCustomDisplayScheduleEnabled] = useState(false);
  const [displaySchedule, setDisplaySchedule] = useState({start: '06:00', end: '09:00'});
  const [displayDays, setDisplayDays] = useState<DayId[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [presetName, setPresetName] = useState('Display 1');
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

  useEffect(() => {
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
    setLines(prev => ensureLineCount(prev, city, layoutSlots, {}, {}));
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

  const snapshotRef = useRef({city, layoutSlots, lines, displaySchedule, displayDays, presetName, customDisplayScheduleEnabled});
  const isDirty = useMemo(() => {
    const snap = snapshotRef.current;
    return (
      snap.city !== city ||
      snap.layoutSlots !== layoutSlots ||
      snap.presetName !== presetName ||
      snap.customDisplayScheduleEnabled !== customDisplayScheduleEnabled ||
      snap.displaySchedule.start !== displaySchedule.start ||
      snap.displaySchedule.end !== displaySchedule.end ||
      JSON.stringify(snap.displayDays) !== JSON.stringify(displayDays) ||
      JSON.stringify(snap.lines) !== JSON.stringify(lines)
    );
  }, [city, customDisplayScheduleEnabled, displayDays, displaySchedule.end, displaySchedule.start, layoutSlots, lines, presetName]);

  const handleSave = () => {
    if (!isDirty || saving) return;
    setSaving(true);
    setSaveDone(false);
    setTimeout(() => {
      snapshotRef.current = {city, layoutSlots, lines, displaySchedule, displayDays, presetName, customDisplayScheduleEnabled};
      setPreset(presetName.trim() || 'Display 1');
      setSelectedStations(
        lines
          .map(line => {
            const mode = normalizeMode(city, line.mode);
            const stations = stationsByMode[mode] ?? [];
            return stations.find(station => station.id === line.stationId)?.name ?? line.label.trim();
          })
          .filter(name => name.length > 0),
      );
      setAppArrivals(
        lines
          .map(line => {
            const mode = normalizeMode(city, line.mode);
            const routes = routesByStation[routeLookupKey(mode, line.stationId)] ?? [];
            const route = routes.find(item => item.id === line.routeId);
            const arrival = arrivals.find(item => item.lineId === line.id);
            return {
              line: route?.label ?? line.routeId,
              destination: arrival?.destination ?? (line.label.trim() || 'Selected stop'),
              minutes: arrival?.minutes ?? 0,
            };
          })
          .filter(item => item.line.trim().length > 0),
      );
      setSaving(false);
      setSaveDone(true);
      void Haptics.notificationAsync?.('success');
      setTimeout(() => setSaveDone(false), 1200);
    }, 1000);
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
    setEditorStep(transitionStep);
    setTimeout(() => setEditorStep(next), delayMs);
  };

  const previewSlots = useMemo(
    () =>
      lines.map(line => {
        const safeMode = normalizeMode(city, line.mode);
        const cityStations = stationsByMode[safeMode] ?? [];
        const station = cityStations.find(item => item.id === line.stationId);
        const lineRoutes = routesByStation[routeLookupKey(safeMode, line.stationId)] ?? [];
        const route = lineRoutes.find(item => item.id === line.routeId);
        const arrival = arrivals.find(item => item.lineId === line.id);

        const headsign = arrival?.destination ?? station?.name ?? (line.label.trim() || '—');
        const directionLabel = line.direction === 'uptown' ? 'Uptown' : 'Downtown';
        const t0 = arrival?.minutes != null ? String(arrival.minutes) : '—';
        const allTimes = buildNextArrivalTimes(arrival?.minutes ?? 0, 3);
        const subTimes = allTimes.slice(1).map(t => t.replace('m', '')).join(', ');

        let stopName: string;
        let subLine: string | undefined;

        switch (line.displayFormat) {
          case 'direction-single':
            stopName = directionLabel;
            break;
          case 'both-single':
            stopName = directionLabel;
            subLine = headsign;
            break;
          case 'headsign-multi':
            stopName = headsign;
            subLine = subTimes;
            break;
          case 'direction-multi':
            stopName = directionLabel;
            subLine = subTimes;
            break;
          default: // 'headsign-single'
            stopName = headsign;
        }

        return {
          id: line.id,
          color: route?.color ?? '#3A3A3A',
          textColor: line.textColor || route?.textColor || '#FFFFFF',
          routeLabel: route?.label ?? '?',
          selected: line.id === selectedLineId,
          stopName,
          subLine,
          times: t0,
        };
      }),
    [arrivals, city, lines, routesByStation, selectedLineId, stationsByMode],
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
      <ScrollView contentContainerStyle={styles.scroll} scrollEnabled={!previewDragging}>
        <Animated.View style={headerAnimatedStyle}>
          <TopBar
            layoutSlots={layoutSlots}
            presetName={presetName}
            onPresetNameChange={setPresetName}
            onLayoutOpen={() => setOpenLayoutPicker(true)}
            onBackPress={handleBackPress}
          />
        </Animated.View>

        <Animated.View style={previewAnimatedStyle}>
          <DashboardPreviewSection
            slots={previewSlots}
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
              <Pressable style={styles.collapsibleHeader} onPress={toggleLayoutEditor}>
                <Text style={styles.sectionLabel}>Choose Layout</Text>
                <View style={styles.collapsibleArrowBubble}>
                  <Text style={styles.collapsibleArrow}>{layoutExpanded ? '▲' : '▼'}</Text>
                </View>
              </Pressable>

              {layoutExpanded ? (
                <View style={styles.collapsibleBody}>
                  <FormatPickerStep
                    city={city}
                    selectedFormat={selectedLine?.displayFormat ?? lines[0]?.displayFormat}
                    onSelect={format => {
                      const targetId = selectedLine?.id ?? lines[0]?.id;
                      if (targetId) updateLine(targetId, {displayFormat: format});
                      setLayoutExpanded(false);
                      setSlotEditorExpanded(true);
                      if (!selectedLineId) {
                        const firstLine = lines[0];
                        setSelectedLineId(firstLine?.id ?? '');
                        setEditorStep(firstLine && firstLine.stationId && firstLine.routeId ? 'done' : 'lines');
                      }
                    }}
                  />
                </View>
              ) : null}
            </View>

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
                            800,
                          );
                        }}
                        onBack={() => { setSlotEditorExpanded(false); setLayoutExpanded(true); }}
                      />
                    )}

                    {editorStep === 'stops' && (
                      <StopPickerStep
                        selectedRoute={(linesByMode[normalizeMode(city, selectedLine.mode)] ?? []).find(r => r.id === selectedLine.routeId)}
                        stations={stationsByLine[selectedLine.routeId] ?? []}
                        loading={!!stationsLoadingByLine[selectedLine.routeId]}
                        selectedStationId={selectedLine.stationId}
                        selectedRouteId={selectedLine.routeId}
                        search={stationSearch[selectedLine.id] ?? ''}
                        onSearch={text => setStationSearch(prev => ({...prev, [selectedLine.id]: text}))}
                        onSelectStation={id => {
                          updateLine(selectedLine.id, {stationId: id});
                          playStepTransition('All set! Loading arrivals…', 'done', 600);
                        }}
                        onBack={() => setEditorStep('lines')}
                      />
                    )}

                    {editorStep === 'done' && (
                      <DoneStep
                        city={city}
                        line={selectedLine}
                        selectedRoute={
                          (routesByStation[routeLookupKey(normalizeMode(city, selectedLine.mode), selectedLine.stationId)] ?? []).find(
                            r => r.id === selectedLine.routeId,
                          )
                        }
                        selectedStation={
                          (stationsByMode[normalizeMode(city, selectedLine.mode)] ?? []).find(
                            s => s.id === selectedLine.stationId,
                          )
                        }
                        arrival={arrivals.find(a => a.lineId === selectedLine.id)}
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

      <SaveBar dirty={isDirty} loading={saving} success={saveDone} onPress={handleSave} />
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
            <Text style={styles.layoutIcon}>[]</Text>
            <Text style={styles.layoutPillTopRightText}>
              {LAYOUT_OPTIONS.find(option => option.slots === layoutSlots)?.label ?? 'Layout'} v
            </Text>
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

function SaveBar({dirty, loading, success, onPress}: {dirty: boolean; loading: boolean; success: boolean; onPress: () => void}) {
  return (
    <View style={styles.saveBar}>
      <Pressable
        disabled={!dirty || loading}
        onPress={onPress}
        style={[styles.saveButton, (!dirty || loading) && styles.saveButtonDisabled, success && styles.saveButtonSuccess]}>
        <Text style={styles.saveButtonText}>{loading ? 'Saving...' : success ? 'Synced' : 'Save to Device'}</Text>
      </Pressable>
      <Text style={styles.saveHint}>{success ? 'Last synced just now' : dirty ? 'Unsaved changes' : 'No changes'}</Text>
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

const FORMAT_GROUPS: Array<{
  label: string;
  options: Array<{id: DisplayFormat; name: string; desc: string}>;
}> = [
  {
    label: 'Single arrival',
    options: [
      {
        id: 'headsign-single',
        name: 'Destination',
        desc: 'Example: Woodlawn on the left with the next arrival on the right.',
      },
      {
        id: 'direction-single',
        name: 'Direction',
        desc: 'Example: Uptown on the left with the next arrival on the right.',
      },
    ],
  },
  {
    label: 'Two-line layouts',
    options: [
      {
        id: 'both-single',
        name: 'Direction + destination',
        desc: 'Example: Uptown on the first line and Woodlawn underneath.',
      },
      {
        id: 'headsign-multi',
        name: 'Destination + times',
        desc: 'Example: Woodlawn on top with more arrival times underneath.',
      },
      {
        id: 'direction-multi',
        name: 'Direction + times',
        desc: 'Example: Uptown on top with more arrival times underneath.',
      },
    ],
  },
];

// Skeleton: neutral = gray shapes; accent = the element unique to this format vs the baseline
function FormatSkeleton({format, accent}: {format: DisplayFormat; accent: string}) {
  const hasDirectionPill = format === 'direction-single' || format === 'both-single' || format === 'direction-multi';
  const hasSecondLine    = format === 'both-single';
  const hasNextTimes     = format === 'headsign-multi' || format === 'direction-multi';
  // Accent rule: only highlight the element that distinguishes this format from headsign-single
  const accentSecondLine = hasSecondLine;
  const accentChips    = hasNextTimes;
  const primaryLabel = hasDirectionPill ? 'Uptown' : 'Woodlawn';
  const secondaryLabel = hasSecondLine ? 'Woodlawn' : null;

  return (
    <View style={styles.fmtSkel}>
      <View style={styles.fmtSkelRow}>
        <View style={styles.fmtSkelBadge} />
        <View style={styles.fmtSkelBody}>
          <View style={styles.fmtSkelPrimaryWrap}>
            <Text style={styles.fmtSkelPrimaryText} numberOfLines={1}>
              {primaryLabel}
            </Text>
          </View>
          {hasSecondLine ? (
            <View style={[styles.fmtSkelSecondaryWrap, accentSecondLine && {backgroundColor: accent + '18'}]}>
              <Text style={styles.fmtSkelSecondaryText} numberOfLines={1}>
                {secondaryLabel}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.fmtSkelEta}>
          <Text style={styles.fmtSkelEtaText}>3m</Text>
        </View>
      </View>
      {hasNextTimes ? (
        <View style={styles.fmtSkelChipRow}>
          {['7m', '10m', '14m'].map(value => (
            <View
              key={value}
              style={[
                styles.fmtSkelChip,
                accentChips && {borderColor: accent, backgroundColor: accent + '18'},
              ]}>
              <Text style={styles.fmtSkelChipText}>{value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FormatPickerStep({
  city,
  selectedFormat,
  onSelect,
}: {
  city: CityId;
  selectedFormat: DisplayFormat;
  onSelect: (format: DisplayFormat) => void;
}) {
  const brand = CITY_BRANDS[city];
  const allOptions = FORMAT_GROUPS.flatMap(g => g.options);
  const scaleAnims = useRef(allOptions.map(() => new Animated.Value(1))).current;

  const handlePress = (format: DisplayFormat, globalIndex: number) => {
    Animated.sequence([
      Animated.timing(scaleAnims[globalIndex], {toValue: 0.96, duration: 80, useNativeDriver: true}),
      Animated.spring(scaleAnims[globalIndex], {toValue: 1, tension: 200, friction: 10, useNativeDriver: true}),
    ]).start(() => onSelect(format));
  };

  let globalIndex = 0;
  return (
    <View style={styles.stepSection}>
      <Text style={styles.stepTitle}>How should it look?</Text>
      <Text style={styles.stepSubtitle}>Choose a display format for this slot.</Text>
      <View style={styles.formatCardList}>
        {FORMAT_GROUPS.map((group, gi) => (
          <View key={group.label} style={[styles.formatGroup, gi > 0 && styles.formatGroupSpaced]}>
            <View style={styles.formatGroupHeader}>
              <View style={styles.formatGroupLine} />
              <Text style={styles.formatGroupLabel}>{group.label}</Text>
              <View style={styles.formatGroupLine} />
            </View>
            {group.options.map(option => {
              const idx = globalIndex++;
              const isSelected = option.id === selectedFormat;
              return (
                <Animated.View key={option.id} style={{transform: [{scale: scaleAnims[idx]}]}}>
                  <Pressable
                    style={[styles.formatCard, isSelected && {borderColor: brand.accent, borderWidth: 2}]}
                    onPress={() => handlePress(option.id, idx)}>
                    <FormatSkeleton format={option.id} accent={brand.accent} />
                    <View style={[styles.formatCardDivider, isSelected && {backgroundColor: brand.accent, opacity: 0.3}]} />
                    <View style={styles.formatCardInfo}>
                      <Text style={[styles.formatCardName, isSelected && {color: brand.accent}]}>{option.name}</Text>
                      <Text style={styles.formatCardDesc}>{option.desc}</Text>
                    </View>
                    {isSelected ? <View style={[styles.formatCardCheck, {backgroundColor: brand.accent}]}><Text style={styles.formatCardCheckText}>✓</Text></View> : null}
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        ))}
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
  const pulseAnims = useRef<Record<string, Animated.Value>>({}).current;

  // Show search bar when there are many lines (buses especially)
  const showSearch = allRoutes.length > 15;

  const routes = useMemo(() => {
    const term = lineSearch.trim().toLowerCase();
    if (!term) return allRoutes;
    return allRoutes.filter(r =>
      r.label.toLowerCase().includes(term) || r.id.toLowerCase().includes(term),
    );
  }, [allRoutes, lineSearch]);

  // Reset search when mode changes
  useEffect(() => { setLineSearch(''); }, [selectedMode]);

  const getPulseAnim = (id: string) => {
    if (!pulseAnims[id]) pulseAnims[id] = new Animated.Value(1);
    return pulseAnims[id];
  };

  const handleSelectLine = (routeId: string) => {
    const anim = getPulseAnim(routeId);
    Animated.sequence([
      Animated.spring(anim, {toValue: 1.15, tension: 200, friction: 8, useNativeDriver: true}),
      Animated.spring(anim, {toValue: 1, tension: 200, friction: 8, useNativeDriver: true}),
    ]).start(() => onSelectLine(routeId));
  };

  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepNavRow}>
        <Pressable style={styles.stepBackButton} onPress={onBack}>
          <Text style={styles.stepBackText}>← Back</Text>
        </Pressable>
      </View>
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
        <ScrollView showsVerticalScrollIndicator={false} style={styles.lineGridScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.lineGrid}>
            {routes.map(route => {
              const isSelected = route.id === selectedRouteId;
              const anim = getPulseAnim(route.id);
              return (
                <Animated.View key={route.id} style={{transform: [{scale: anim}]}}>
                  <Pressable
                    style={[styles.lineBadgeTile, isSelected && styles.lineBadgeTileActive]}
                    onPress={() => handleSelectLine(route.id)}>
                    <View style={[styles.lineBadgeCircle, {backgroundColor: route.color}]}>
                      <Text style={[styles.lineBadgeText, {color: route.textColor ?? '#fff'}]}>{route.label}</Text>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
            {routes.length === 0 && !isLoading ? (
              <Text style={styles.sectionHint}>
                {lineSearch ? `No lines matching "${lineSearch}".` : 'No lines available for this mode.'}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function StopPickerStep({
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

  const getCheckAnim = (id: string) => {
    if (!checkAnims[id]) checkAnims[id] = new Animated.Value(0);
    return checkAnims[id];
  };

  const handleSelect = (id: string) => {
    const anim = getCheckAnim(id);
    Animated.sequence([
      Animated.spring(anim, {toValue: 1.2, tension: 200, friction: 8, useNativeDriver: true}),
      Animated.spring(anim, {toValue: 1, tension: 200, friction: 8, useNativeDriver: true}),
    ]).start(() => onSelectStation(id));
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
          <View style={[styles.stopContextBadge, {backgroundColor: selectedRoute.color}]}>
            <Text style={[styles.stopContextBadgeText, {color: selectedRoute.textColor ?? '#fff'}]}>
              {selectedRoute.label}
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
  line,
  selectedRoute,
  selectedStation,
  arrival,
  liveStatusText,
  onChangeLine,
  onChangeStop,
  onChange,
}: {
  city: CityId;
  line: LinePick;
  selectedRoute: Route | undefined;
  selectedStation: Station | undefined;
  arrival: Arrival | undefined;
  liveStatusText: string;
  onChangeLine: () => void;
  onChangeStop: () => void;
  onChange: (id: string, next: Partial<LinePick>) => void;
}) {
  const canDecreaseNextStops = line.nextStops > 1;
  const canIncreaseNextStops = line.nextStops < MAX_NEXT_STOPS;

  return (
    <View style={styles.doneStepContainer}>
      <View style={styles.contextChipRow}>
        {selectedRoute ? (
          <Pressable style={styles.contextChip} onPress={onChangeLine}>
            <View style={[styles.contextChipBadge, {backgroundColor: selectedRoute.color}]}>
              <Text style={[styles.contextChipBadgeText, {color: selectedRoute.textColor ?? '#fff'}]}>
                {selectedRoute.label}
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
      {arrival !== undefined && selectedRoute ? (
        <View style={styles.doneArrivalRow}>
          <View style={[styles.doneArrivalBadge, {backgroundColor: selectedRoute.color}]}>
            <Text style={[styles.doneArrivalBadgeText, {color: selectedRoute.textColor ?? '#fff'}]}>
              {selectedRoute.label}
            </Text>
          </View>
          <View style={styles.doneArrivalInfo}>
            <Text style={styles.doneArrivalDest}>{arrival.destination ?? selectedStation?.name ?? '—'}</Text>
            <Text style={styles.doneArrivalTime}>{arrival.minutes != null ? `${arrival.minutes}m` : '—'}</Text>
          </View>
        </View>
      ) : null}

      <DirectionToggle value={line.direction} onChange={direction => onChange(line.id, {direction})} />

      <View style={styles.secondarySectionCard}>
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>Custom Name</Text>
          <TextInput
            value={line.label}
            onChangeText={value => onChange(line.id, {label: value})}
            placeholder={selectedStation?.name ?? 'Give this slot a name'}
            placeholderTextColor={colors.textMuted}
            style={styles.customInput}
          />
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>Next Arrivals To Show</Text>
          <View style={styles.stepperRow}>
            <Pressable
              disabled={!canDecreaseNextStops}
              style={[styles.stepperButton, !canDecreaseNextStops && styles.stepperButtonDisabled]}
              onPress={() => onChange(line.id, {nextStops: clampNextStops(line.nextStops - 1)})}>
              <Text style={[styles.stepperButtonText, !canDecreaseNextStops && styles.stepperButtonTextDisabled]}>-</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{line.nextStops}</Text>
            <Pressable
              disabled={!canIncreaseNextStops}
              style={[styles.stepperButton, !canIncreaseNextStops && styles.stepperButtonDisabled]}
              onPress={() => onChange(line.id, {nextStops: clampNextStops(line.nextStops + 1)})}>
              <Text style={[styles.stepperButtonText, !canIncreaseNextStops && styles.stepperButtonTextDisabled]}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionHint}>This controls how many upcoming times appear for this slot.</Text>
        </View>
      </View>
    </View>
  );
}

function normalizeCityIdParam(value: string | undefined): CityId {
  return normalizeCityId(value);
}

function isLiveCitySupported(city: CityId) {
  return LIVE_SUPPORTED_CITIES.includes(city);
}

function getAvailableModes(city: CityId): ModeId[] {
  const order = CITY_MODE_ORDER[city] ?? MODE_ORDER;
  return order.filter(mode => hasMode(city, mode));
}

function getModeLabel(city: CityId, mode: ModeId) {
  if (mode === 'train') return city === 'philadelphia' ? 'Rail' : 'Subway';
  if (mode === 'bus') return 'Bus';
  if (mode === 'trolley') return 'Trolley';
  if (mode === 'ferry') return 'Ferry';
  return 'Commuter Rail';
}

function hasMode(city: CityId, mode: ModeId) {
  const order = CITY_MODE_ORDER[city] ?? MODE_ORDER;
  return order.includes(mode);
}

function normalizeMode(city: CityId, mode: ModeId): ModeId {
  if (hasMode(city, mode)) return mode;
  return getAvailableModes(city)[0] ?? 'train';
}

function routeLookupKey(mode: ModeId, stationId: string) {
  return `${mode}:${stationId}`;
}

function areSameLinePicks(left: LinePick[], right: LinePick[]) {
  if (left.length !== right.length) return false;
  return left.every((line, idx) => {
    const other = right[idx];
    return (
      line.id === other.id &&
      line.mode === other.mode &&
      line.stationId === other.stationId &&
      line.routeId === other.routeId &&
      line.direction === other.direction &&
      line.label === other.label &&
      line.textColor === other.textColor &&
      line.nextStops === other.nextStops &&
      line.displayFormat === other.displayFormat
    );
  });
}

function lineColorFor(routeId: string) {
  let hash = 0;
  for (let idx = 0; idx < routeId.length; idx += 1) {
    hash = (hash * 31 + routeId.charCodeAt(idx)) >>> 0;
  }
  return FALLBACK_ROUTE_COLORS[hash % FALLBACK_ROUTE_COLORS.length];
}

function buildAreaFromName(name: string) {
  const splitAt = name.indexOf('-');
  if (splitAt === -1) return '';
  return name.slice(splitAt + 1).trim();
}

function toTransitUiMode(mode: ModeId): TransitUiMode {
  return mode;
}

async function loadStopsForLine(city: CityId, mode: ModeId, lineId: string): Promise<Station[]> {
  const response = await getTransitStopsForLine(city, toTransitUiMode(mode), lineId);
  return response.stations.map(station => ({
    id: station.id,
    name: station.name,
    area: station.area ?? buildAreaFromName(station.name),
    lines: station.lines,
  }));
}

async function loadStationsForCityMode(city: CityId, mode: ModeId): Promise<Station[]> {
  const response = await getTransitStations(city, toTransitUiMode(mode));
  return response.stations.map(station => ({
    id: station.id,
    name: station.name,
    area: station.area ?? buildAreaFromName(station.name),
    lines: station.lines,
  }));
}

function resolveRouteColor(city: CityId, lineId: string, apiColor: string | null): string {
  if (apiColor) return apiColor;
  return CITY_LINE_COLORS[city]?.[lineId]?.color ?? lineColorFor(lineId);
}

function resolveRouteTextColor(city: CityId, lineId: string, apiTextColor: string | null): string {
  if (apiTextColor) return apiTextColor;
  return CITY_LINE_COLORS[city]?.[lineId]?.textColor ?? '#FFFFFF';
}

async function loadRoutesForStation(city: CityId, mode: ModeId, stopId: string): Promise<Route[]> {
  const response = await getTransitLines(city, toTransitUiMode(mode), stopId);
  return response.lines.map(line => ({
    id: line.id,
    label: line.label || line.id,
    color: resolveRouteColor(city, line.id, line.color),
    textColor: resolveRouteTextColor(city, line.id, line.textColor),
  }));
}

async function loadGlobalLinesForCityMode(city: CityId, mode: ModeId): Promise<Route[]> {
  const response = await getGlobalTransitLines(city, toTransitUiMode(mode));
  return response.lines.map(line => ({
    id: line.id,
    label: line.label || line.id,
    color: resolveRouteColor(city, line.id, line.color),
    textColor: resolveRouteTextColor(city, line.id, line.textColor),
  }));
}

function statusFromArrival(arrival: TransitArrival): Arrival['status'] {
  const raw = (arrival.status ?? '').toUpperCase();
  if (raw.includes('DELAY')) return 'DELAYS';
  return 'GOOD';
}

async function loadArrivalForSelection(city: CityId, line: LinePick): Promise<Omit<Arrival, 'lineId'> | null> {
  if (!line.stationId.trim() || !line.routeId.trim()) return null;
  const response = await getTransitArrivals(city, toTransitUiMode(line.mode), line.stationId, [line.routeId]);
  if (response.arrivals.length === 0) return null;

  const matched = response.arrivals.filter(arrival => arrival.lineId === line.routeId);
  const candidates = matched.length > 0 ? matched : response.arrivals;
  const sorted = [...candidates].sort((a, b) => {
    const left = typeof a.minutes === 'number' ? a.minutes : Number.MAX_SAFE_INTEGER;
    const right = typeof b.minutes === 'number' ? b.minutes : Number.MAX_SAFE_INTEGER;
    return left - right;
  });
  const nextArrival = sorted[0];
  if (!nextArrival || typeof nextArrival.minutes !== 'number') return null;

  return {
    minutes: Math.max(0, Math.round(nextArrival.minutes)),
    status: statusFromArrival(nextArrival),
    destination: nextArrival.destination ?? null,
  };
}

function mergeArrivals(existing: Arrival[], updates: Arrival[], lines: LinePick[]): Arrival[] {
  const updateMap = new Map<string, Arrival>();
  updates.forEach(update => updateMap.set(update.lineId, update));
  return lines.map(line => {
    const fallback: Arrival = {lineId: line.id, minutes: 0, status: 'GOOD', destination: null};
    return updateMap.get(line.id) ?? existing.find(item => item.lineId === line.id) ?? fallback;
  });
}

function newLine(
  city: CityId,
  mode: ModeId,
  id: string,
  stationsByMode: StationsByMode,
  routesByStation: RoutesByStation,
): LinePick {
  const safeMode = normalizeMode(city, mode);
  const stations = stationsByMode[safeMode] ?? [];
  const firstStation = stations[0];
  const routes = firstStation ? routesByStation[routeLookupKey(safeMode, firstStation.id)] ?? [] : [];
  const firstRoute = routes[0];

  return normalizeLine(
    city,
    {
      id,
      mode: safeMode,
      stationId: firstStation?.id ?? '',
      routeId: firstRoute?.id ?? '',
      direction: 'uptown',
      label: '',
      textColor: DEFAULT_TEXT_COLOR,
      nextStops: DEFAULT_NEXT_STOPS,
      displayFormat: 'headsign-single' as DisplayFormat,
    },
    stationsByMode,
    routesByStation,
  );
}

function normalizeLine(
  city: CityId,
  line: LinePick,
  stationsByMode: StationsByMode,
  routesByStation: RoutesByStation,
): LinePick {
  const safeMode = normalizeMode(city, line.mode);
  const stations = stationsByMode[safeMode] ?? [];

  // Only snap to first station if the current stationId actually exists in the list.
  // Preserving an explicit '' (no station chosen yet) intentionally.
  const station = stations.find(item => item.id === line.stationId);
  const resolvedStationId = station?.id ?? line.stationId;

  const routeKey = resolvedStationId ? routeLookupKey(safeMode, resolvedStationId) : null;
  const routes = routeKey ? (routesByStation[routeKey] ?? []) : [];
  const allowedRoutes = station && station.lines.length > 0 ? routes.filter(route => station.lines.includes(route.id)) : routes;

  // Only snap to first route if routes are loaded for this station.
  // Otherwise preserve the current routeId (e.g. a globally-picked line).
  const routesLoaded = routes.length > 0;
  const routeMatch = allowedRoutes.find(item => item.id === line.routeId);
  const resolvedRouteId = routeMatch?.id ?? (routesLoaded ? (allowedRoutes[0]?.id ?? routes[0]?.id ?? line.routeId) : line.routeId);

  return {
    ...line,
    mode: safeMode,
    stationId: resolvedStationId,
    routeId: resolvedRouteId,
    direction: line.direction === 'downtown' ? 'downtown' : 'uptown',
    label: line.label ?? '',
    textColor: normalizeHexColor(line.textColor) ?? DEFAULT_TEXT_COLOR,
    nextStops: clampNextStops(line.nextStops),
    displayFormat: line.displayFormat ?? 'headsign-single',
  };
}

function seedDefaultLines(city: CityId, stationsByMode: StationsByMode, routesByStation: RoutesByStation): LinePick[] {
  const modes = getAvailableModes(city);
  const primary = modes[0] ?? 'train';
  const secondary = modes[1] ?? primary;
  const defaults = [newLine(city, primary, 'line-1', stationsByMode, routesByStation)];
  defaults.push(newLine(city, secondary, 'line-2', stationsByMode, routesByStation));
  return defaults;
}

function ensureLineCount(
  existing: LinePick[],
  city: CityId,
  slots: number,
  stationsByMode: StationsByMode,
  routesByStation: RoutesByStation,
): LinePick[] {
  const next: LinePick[] = [];
  const defaults = seedDefaultLines(city, stationsByMode, routesByStation);
  for (let index = 0; index < slots; index += 1) {
    const id = `line-${index + 1}`;
    const fromExisting = existing.find(line => line.id === id);
    if (fromExisting) {
      next.push(normalizeLine(city, {...fromExisting, id}, stationsByMode, routesByStation));
      continue;
    }

    const defaultLine = defaults[index] ?? defaults[0];
    if (defaultLine) {
      next.push({...defaultLine, id});
      continue;
    }
    next.push(newLine(city, 'train', id, stationsByMode, routesByStation));
  }
  return next;
}

function syncArrivals(existing: Arrival[], lines: LinePick[]): Arrival[] {
  return lines.map(line => {
    const found = existing.find(item => item.lineId === line.id);
    if (found) return found;
    return {
      lineId: line.id,
      minutes: 0,
      status: 'GOOD',
      destination: null,
    };
  });
}

function clampNextStops(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_NEXT_STOPS;
  return Math.min(MAX_NEXT_STOPS, Math.max(1, Math.round(value)));
}

function cycleTimeOption(current: string, delta: 1 | -1) {
  const index = TIME_OPTIONS.indexOf(current);
  const safeIndex = index === -1 ? 0 : index;
  const nextIndex = (safeIndex + delta + TIME_OPTIONS.length) % TIME_OPTIONS.length;
  return TIME_OPTIONS[nextIndex];
}

function normalizeHexColor(value: string | undefined | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return null;
  return `#${match[1].toUpperCase()}`;
}

function buildNextArrivalTimes(firstMinutes: number, count: number): string[] {
  const safeCount = clampNextStops(count);
  const times: string[] = [];
  let current = Math.max(1, Math.round(firstMinutes));
  for (let idx = 0; idx < safeCount; idx += 1) {
    times.push(`${current}m`);
    current += idx % 2 === 0 ? 2 : 3;
  }
  return times;
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {padding: spacing.lg, paddingBottom: 140, gap: spacing.md},
  topBarWrap: {gap: spacing.xs},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  topBarSideLeft: {
    width: 88,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  topBarSideRight: {
    width: 116,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  presetNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  presetNameTitle: {color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'center', maxWidth: 180},
  presetNameEditButton: {
    paddingHorizontal: 2,
    paddingVertical: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetNameEditEmoji: {fontSize: 14},
  renameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.xs,
  },
  renameInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  renameActionButton: {
    minHeight: 40,
    borderRadius: radii.md,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renameActionButtonText: {color: colors.text, fontSize: 12, fontWeight: '800'},
  renameCancelButton: {
    minHeight: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  backButtonText: {color: colors.text, fontSize: 13, fontWeight: '800'},
  confirmOverlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  confirmSheet: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  confirmTitle: {color: colors.text, fontSize: 16, fontWeight: '800'},
  confirmBody: {color: colors.textMuted, fontSize: 13, marginTop: spacing.xs},
  confirmActions: {flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs, marginTop: spacing.md},
  confirmStayButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  confirmStayText: {color: colors.text, fontSize: 13, fontWeight: '700'},
  confirmLeaveButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#5B1C1C',
    backgroundColor: '#2B1010',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  confirmLeaveText: {color: '#FCA5A5', fontSize: 13, fontWeight: '700'},
  modalOverlay: {flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-start', paddingTop: 72},
  modalSheet: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalOption: {padding: spacing.md},
  modalOptionActive: {backgroundColor: colors.accentMuted},
  modalOptionText: {color: colors.text, fontSize: 15, fontWeight: '700'},
  modalOptionTextActive: {color: colors.accent},
  previewWrapper: {marginBottom: spacing.xs},
  previewCard: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#0F131A',
    backgroundColor: '#020204',
    padding: spacing.md,
    minHeight: 180,
  },
  previewHeaderRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  previewStation: {color: '#E9F5FF', fontSize: 18, fontWeight: '900', flex: 1, marginRight: spacing.sm},
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.md,
  },
  statusGood: {backgroundColor: '#0B3B2E'},
  statusDotLarge: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#5CE1E6'},
  statusPillText: {color: '#fff', fontWeight: '800', fontSize: 11},
  previewList: {marginTop: spacing.sm, gap: spacing.sm},
  previewRowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#1E232B',
    padding: spacing.sm,
    backgroundColor: '#090C12',
  },
  previewRowButtonActive: {borderColor: colors.accent, backgroundColor: '#0E1720'},
  previewSlotBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#38414A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewSlotBadgeText: {color: '#C7CFD6', fontSize: 12, fontWeight: '800'},
  routeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeBadgeText: {fontWeight: '900', fontSize: 16},
  routeDir: {color: '#E9ECEF', fontSize: 11, fontWeight: '700', opacity: 0.8},
  previewMain: {flex: 1, gap: 2},
  previewStationName: {fontSize: 14, fontWeight: '800'},
  previewArea: {fontSize: 12, opacity: 0.75},
  previewTimes: {fontSize: 12, fontWeight: '700'},
  card: {
    backgroundColor: 'transparent',
    borderRadius: radii.lg,
    borderWidth: 0,
    padding: 0,
    gap: spacing.sm,
  },
  sectionLabel: {color: colors.text, fontSize: 14, fontWeight: '800'},
  layoutRow: {flexDirection: 'row', gap: spacing.xs},
  layoutDropdownLabel: {color: colors.textMuted, fontSize: 12, fontWeight: '700'},
  layoutDropdownButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  layoutDropdownButtonText: {color: colors.text, fontSize: 12, fontWeight: '700'},
  layoutPillTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-end',
  },
  layoutIcon: {color: colors.textMuted, fontSize: 12, fontWeight: '800'},
  layoutPillTopRightText: {color: colors.text, fontSize: 13, fontWeight: '700'},
  layoutPill: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  layoutPillActive: {borderColor: colors.accent, backgroundColor: colors.accentMuted},
  layoutPillText: {color: colors.text, fontWeight: '700', fontSize: 13},
  layoutPillTextActive: {color: colors.accent},
  layoutHint: {color: colors.textMuted, fontSize: 12},
  editorHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  sectionBlock: {gap: spacing.xs},
  sectionHint: {color: colors.textMuted, fontSize: 12},
  schedule24x7Card: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: 4,
  },
  schedule24x7Title: {color: colors.text, fontSize: 13, fontWeight: '800'},
  schedule24x7Body: {color: colors.textMuted, fontSize: 12},
  scheduleToggleRow: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  scheduleToggleLabel: {color: colors.text, fontSize: 13, fontWeight: '800'},
  scheduleToggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 2,
    justifyContent: 'center',
  },
  scheduleToggleOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  scheduleToggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.textMuted,
  },
  scheduleToggleThumbOn: {
    backgroundColor: colors.accent,
    transform: [{translateX: 18}],
  },
  collapsibleSection: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  collapsibleArrowBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsibleArrow: {color: colors.textMuted, fontSize: 12, fontWeight: '800'},
  collapsibleBody: {paddingTop: 2, gap: spacing.sm},
  selectorField: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectorValueText: {color: colors.text, fontSize: 14, fontWeight: '700'},
  selectorCaptionText: {color: colors.textMuted, fontSize: 12, marginTop: 2},
  selectorChevron: {color: colors.textMuted, fontSize: 12, fontWeight: '700'},
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  segment: {flex: 1, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 4},
  segmentActive: {backgroundColor: colors.accentMuted},
  segmentDisabled: {opacity: 0.4},
  segmentText: {color: colors.textMuted, fontWeight: '700', fontSize: 11, textAlign: 'center'},
  segmentTextActive: {color: colors.accent},
  searchRow: {flexDirection: 'row', alignItems: 'stretch', gap: spacing.xs},
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.text,
    marginBottom: spacing.xs,
    minHeight: 40,
  },
  searchInputInline: {flex: 1, marginBottom: 0},
  searchDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 38,
    minHeight: 40,
  },
  searchDropdownButtonCaret: {color: colors.textMuted, fontSize: 13, fontWeight: '700'},
  stationListInline: {maxHeight: 220},
  stationRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm},
  stationName: {color: colors.text, fontSize: 14, fontWeight: '800'},
  stationMeta: {color: colors.textMuted, fontSize: 12, marginTop: 2},
  chevron: {color: colors.textMuted, fontSize: 12, fontWeight: '700'},
  chevronSelected: {color: colors.accent},
  listDivider: {height: 1, backgroundColor: colors.border},
  routeGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  routeTile: {
    width: 70,
    height: 70,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  routeTileActive: {borderColor: colors.accent, backgroundColor: colors.accentMuted},
  routeCircle: {width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center'},
  routeCircleText: {fontWeight: '900', fontSize: 18},
  customInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
  },
  secondarySectionCard: {
    marginTop: spacing.xs,
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  stepperRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.md},
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {color: colors.text, fontSize: 18, fontWeight: '800'},
  stepperButtonDisabled: {opacity: 0.45},
  stepperButtonTextDisabled: {color: colors.textMuted},
  stepperValue: {color: colors.text, fontSize: 20, fontWeight: '900', minWidth: 20, textAlign: 'center'},
  timeRangeRow: {flexDirection: 'row', gap: spacing.xs},
  dayPillRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center'},
  dayPill: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    minWidth: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  dayPillActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  dayPillText: {color: colors.textMuted, fontSize: 12, fontWeight: '700'},
  dayPillTextActive: {color: colors.accent},
  timeStepper: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.xs,
    gap: 6,
  },
  timeStepperLabel: {color: colors.textMuted, fontSize: 11, fontWeight: '700'},
  timeStepperControls: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs},
  timeAdjustButton: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeAdjustButtonText: {color: colors.text, fontSize: 18, fontWeight: '800'},
  timeValue: {color: colors.text, fontSize: 13, fontWeight: '800'},
  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveButtonDisabled: {opacity: 0.4},
  saveButtonSuccess: {backgroundColor: colors.success},
  saveButtonText: {color: colors.background, fontWeight: '900', fontSize: 15},
  saveHint: {color: colors.textMuted, fontSize: 12, textAlign: 'center'},
  liveDisabledCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.md,
    gap: spacing.xs,
  },
  liveDisabledTitle: {color: colors.text, fontSize: 14, fontWeight: '800'},
  liveDisabledBody: {color: colors.textMuted, fontSize: 12},
  emptyHint: {color: colors.textMuted, fontSize: 12},
  // Onboarding step styles
  stepSection: {gap: spacing.sm},
  stepContainer: {gap: spacing.sm},
  stepNavRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  stepBackButton: {paddingVertical: 4, paddingRight: spacing.sm},
  stepBackText: {color: colors.textMuted, fontSize: 13, fontWeight: '700'},
  stepTitle: {color: colors.text, fontSize: 22, fontWeight: '900', marginBottom: 4},
  stepSubtitle: {color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm},
  formatCardList: {gap: spacing.sm, paddingBottom: spacing.md},
  formatCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#242933',
    backgroundColor: '#12161C',
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
    elevation: 2,
  },
  // ── Format skeleton ────────────────────────────────────────────────
  fmtSkel: {paddingVertical: spacing.sm, gap: 7},
  fmtSkelRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  fmtSkelBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#1C2330', flexShrink: 0,
  },
  fmtSkelBody: {flex: 1, gap: 5},
  fmtSkelPrimaryWrap: {
    flex: 1,
    minHeight: 22,
    borderRadius: 5,
    backgroundColor: '#1C2330',
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  fmtSkelPrimaryText: {color: '#D7DEE6', fontSize: 13, fontWeight: '700'},
  fmtSkelSecondaryWrap: {
    minHeight: 18,
    borderRadius: 5,
    backgroundColor: '#1C2330',
    paddingHorizontal: 8,
    justifyContent: 'center',
    width: '100%',
  },
  fmtSkelSecondaryText: {color: '#A9B3BE', fontSize: 13, fontWeight: '600'},
  fmtSkelEta: {
    minWidth: 30,
    height: 22,
    borderRadius: 5,
    backgroundColor: '#1C2330',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  fmtSkelEtaText: {color: '#D7DEE6', fontSize: 10, fontWeight: '700'},
  fmtSkelChipRow: {
    flexDirection: 'row', gap: 5,
    paddingLeft: 36, // indent to align under text body
  },
  fmtSkelChip: {
    minWidth: 34, height: 18, borderRadius: 4,
    borderWidth: 1, borderColor: '#1C2330', backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  fmtSkelChipText: {color: '#A9B3BE', fontSize: 9, fontWeight: '700'},
  // ── Format groups ──────────────────────────────────────────────────
  formatGroup: {gap: spacing.sm},
  formatGroupSpaced: {marginTop: spacing.lg},
  formatGroupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  formatGroupLine: {flex: 1, height: 1, backgroundColor: colors.border},
  formatGroupLabel: {
    color: colors.textMuted, fontSize: 11, fontWeight: '700',
  },
  formatCardDivider: {height: 1, backgroundColor: '#262C35', marginHorizontal: -spacing.md},
  formatCardInfo: {gap: 4},
  formatCardName: {color: colors.text, fontSize: 14, fontWeight: '800'},
  formatCardDesc: {color: colors.textMuted, fontSize: 12, lineHeight: 17},
  formatCardCheck: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatCardCheckText: {color: '#fff', fontSize: 12, fontWeight: '900'},
  transitionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  transitionBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transitionBadgeText: {color: '#fff', fontSize: 28, fontWeight: '900'},
  transitionSpinnerPlaceholder: {width: 80, height: 80},
  transitionMessage: {color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center'},
  transitionDots: {flexDirection: 'row', gap: 6},
  transitionDot: {width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted},
  lineGridScroll: {maxHeight: 320},
  lineGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.sm},
  lineGridSkeleton: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  lineGridSkeletonTile: {width: 64, height: 64, borderRadius: radii.md, backgroundColor: colors.surface},
  lineBadgeTile: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  lineBadgeTileActive: {borderColor: colors.accent, backgroundColor: colors.accentMuted},
  lineBadgeCircle: {width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center'},
  lineBadgeText: {fontWeight: '900', fontSize: 18},
  stepSearchInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 14,
  },
  stopListScroll: {maxHeight: 360},
  stopSectionHeader: {color: colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', paddingVertical: spacing.xs, letterSpacing: 0.5},
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stopRowSelected: {backgroundColor: colors.accentMuted},
  stopLineDot: {width: 8, height: 8, borderRadius: 4},
  stopLineDotEmpty: {width: 8, height: 8},
  stopRowInfo: {flex: 1},
  stopCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopCheckmarkText: {color: colors.background, fontSize: 12, fontWeight: '900'},
  stopContextBar: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  stopContextBadge: {width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  stopContextBadgeText: {fontWeight: '900', fontSize: 12},
  stopContextLabel: {color: colors.textMuted, fontSize: 12, fontWeight: '700'},
  verifyingBadge: {color: colors.textMuted, fontSize: 11, fontWeight: '700'},
  doneStepContainer: {gap: spacing.sm},
  contextChipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs},
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  contextChipBadge: {width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
  contextChipBadgeText: {fontWeight: '900', fontSize: 10},
  contextChipLabel: {color: colors.text, fontSize: 13, fontWeight: '700', maxWidth: 120},
  contextChipX: {color: colors.textMuted, fontSize: 11, fontWeight: '700'},
  doneArrivalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.sm,
  },
  doneArrivalBadge: {width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center'},
  doneArrivalBadgeText: {fontWeight: '900', fontSize: 16},
  doneArrivalInfo: {flex: 1, gap: 2},
  doneArrivalDest: {color: colors.text, fontSize: 14, fontWeight: '800'},
  doneArrivalTime: {color: colors.textMuted, fontSize: 12, fontWeight: '700'},
});
