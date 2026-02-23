import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {colors, radii, spacing} from '../../../theme';
import DashboardPreviewSection from '../components/DashboardPreviewSection';

type CityId = 'new-york' | 'philadelphia' | 'boston' | 'chicago';
type ModeId = 'train' | 'bus';
type Direction = 'uptown' | 'downtown';
type Station = {id: string; name: string; area: string; lines: string[]};
type Route = {id: string; label: string; color: string; textColor?: string};
type Arrival = {lineId: string; minutes: number; status: 'GOOD' | 'DELAYS'};
type LinePick = {
  id: string;
  mode: ModeId;
  stationId: string;
  routeId: string;
  direction: Direction;
  label: string;
  textColor: string;
  nextStops: number;
};
type CityConfig = {
  recents: string[];
  modes: Partial<Record<ModeId, {stations: Station[]; routes: Route[]}>>;
};

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

const cityData: Record<CityId, CityConfig> = {
  'new-york': {
    recents: ['Times Sq - 42 St', 'Hoyt-Schermerhorn', '149 St-Grand Concourse'],
    modes: {
      train: {
        stations: [
          {id: 'tsq', name: 'Times Sq - 42 St', area: 'Manhattan', lines: ['N', 'Q', 'R', '1', '2', '3', '7']},
          {id: 'hoyt', name: 'Hoyt-Schermerhorn', area: 'Brooklyn', lines: ['A', 'C', 'G']},
          {id: '149', name: '149 St-Grand Concourse', area: 'Bronx', lines: ['2', '5', '4']},
          {id: 'gct', name: 'Grand Central - 42 St', area: 'Manhattan', lines: ['4', '5', '6', '7']},
          {id: 'fulton', name: 'Fulton St', area: 'Manhattan', lines: ['A', 'C', '2', '3', '4', '5']},
          {id: 'atl', name: 'Atlantic Av-Barclays Ctr', area: 'Brooklyn', lines: ['2', '3', '4', '5', 'B', 'D', 'N', 'Q', 'R']},
          {id: '34h', name: '34 St-Herald Sq', area: 'Manhattan', lines: ['B', 'D', 'N', 'Q', 'R']},
          {id: '59c', name: '59 St-Columbus Circle', area: 'Manhattan', lines: ['A', 'B', 'C', 'D', '1']},
          {id: '14u', name: '14 St-Union Sq', area: 'Manhattan', lines: ['4', '5', '6', 'N', 'Q', 'R']},
          {id: 'w4', name: 'W 4 St-Wash Sq', area: 'Manhattan', lines: ['A', 'C', 'B', 'D']},
          {id: 'jkf', name: 'Jackson Hts-Roosevelt Av', area: 'Queens', lines: ['E', 'F', 'R', '7']},
          {id: 'fls', name: 'Flushing-Main St', area: 'Queens', lines: ['7']},
          {id: '125', name: '125 St', area: 'Manhattan', lines: ['4', '5', '6']},
          {id: '96b', name: '96 St', area: 'Upper West Side', lines: ['1', '2', '3']},
        ],
        routes: [
          {id: '1', label: '1', color: '#EE352E'},
          {id: '2', label: '2', color: '#EE352E'},
          {id: '3', label: '3', color: '#EE352E'},
          {id: '4', label: '4', color: '#00933C'},
          {id: '5', label: '5', color: '#00933C'},
          {id: '6', label: '6', color: '#00933C'},
          {id: '7', label: '7', color: '#B933AD'},
          {id: 'A', label: 'A', color: '#0039A6'},
          {id: 'C', label: 'C', color: '#0039A6'},
          {id: 'E', label: 'E', color: '#0039A6'},
          {id: 'B', label: 'B', color: '#FF6319'},
          {id: 'D', label: 'D', color: '#FF6319'},
          {id: 'N', label: 'N', color: '#FCCC0A', textColor: '#0C0C0C'},
          {id: 'Q', label: 'Q', color: '#FCCC0A', textColor: '#0C0C0C'},
          {id: 'R', label: 'R', color: '#FCCC0A', textColor: '#0C0C0C'},
        ],
      },
      bus: {
        stations: [
          {id: 'm15', name: '1 Av & E 14 St', area: 'Manhattan', lines: ['M15', 'M15-SBS']},
          {id: 'bx12', name: 'Fordham Rd & Grand Concourse', area: 'Bronx', lines: ['Bx12', 'Bx12-SBS']},
          {id: 'm14a', name: '14 St & 1 Av', area: 'Manhattan', lines: ['M14A-SBS']},
          {id: 'm14d', name: '14 St & 8 Av', area: 'Manhattan', lines: ['M14D-SBS']},
          {id: 'm34', name: '34 St & 5 Av', area: 'Manhattan', lines: ['M34', 'M34A-SBS']},
          {id: 'q44', name: 'Main St & Archer Av', area: 'Queens', lines: ['Q44-SBS']},
          {id: 'b41', name: 'Flatbush Av & Nostrand Av', area: 'Brooklyn', lines: ['B41']},
          {id: 's79', name: 'Hylan Blvd & Richmond Av', area: 'Staten Island', lines: ['S79-SBS']},
        ],
        routes: [
          {id: 'M15', label: 'M15', color: '#00933C'},
          {id: 'M15-SBS', label: 'M15', color: '#00933C', textColor: '#0A0A0A'},
          {id: 'Bx12', label: 'Bx12', color: '#0039A6'},
          {id: 'Bx12-SBS', label: 'Bx12', color: '#0039A6', textColor: '#0A0A0A'},
          {id: 'M14A-SBS', label: 'M14A', color: '#0039A6', textColor: '#0A0A0A'},
          {id: 'M14D-SBS', label: 'M14D', color: '#0039A6', textColor: '#0A0A0A'},
          {id: 'M34', label: 'M34', color: '#00933C'},
          {id: 'M34A-SBS', label: 'M34A', color: '#00933C', textColor: '#0A0A0A'},
          {id: 'Q44-SBS', label: 'Q44', color: '#0039A6', textColor: '#0A0A0A'},
          {id: 'B41', label: 'B41', color: '#EE352E'},
          {id: 'S79-SBS', label: 'S79', color: '#FCCC0A', textColor: '#0C0C0C'},
        ],
      },
    },
  },
  philadelphia: {
    recents: ['30th Street', 'Suburban Station'],
    modes: {
      train: {
        stations: [
          {id: '30th', name: '30th Street Station', area: 'University City', lines: ['TR', 'ME', 'AP']},
          {id: 'suburban', name: 'Suburban Station', area: 'Center City', lines: ['ME', 'AP']},
        ],
        routes: [
          {id: 'TR', label: 'Tr', color: '#0061AA'},
          {id: 'ME', label: 'Me', color: '#FF8200'},
          {id: 'AP', label: 'Ap', color: '#009B3A'},
        ],
      },
      bus: {
        stations: [
          {id: '15', name: 'Girard & Front', area: 'Fishtown', lines: ['15', '5']},
          {id: '47', name: '8th & Market', area: 'Center City', lines: ['47', '47M']},
        ],
        routes: [
          {id: '15', label: '15', color: '#0061AA'},
          {id: '5', label: '5', color: '#009B3A'},
          {id: '47', label: '47', color: '#FF8200'},
          {id: '47M', label: '47M', color: '#9C27B0'},
        ],
      },
    },
  },
  boston: {
    recents: ['Downtown Crossing'],
    modes: {
      train: {
        stations: [
          {id: 'dc', name: 'Downtown Crossing', area: 'Boston', lines: ['Red', 'Orange']},
          {id: 'kenmore', name: 'Kenmore', area: 'Boston', lines: ['Green']},
        ],
        routes: [
          {id: 'Red', label: 'Red', color: '#DA291C'},
          {id: 'Orange', label: 'Org', color: '#ED8B00'},
          {id: 'Green', label: 'Grn', color: '#00843D'},
          {id: 'Blue', label: 'Blu', color: '#003DA5'},
        ],
      },
      bus: {
        stations: [{id: '1', name: 'Mass Ave @ Harvard Bridge', area: 'Cambridge', lines: ['1', 'CT1']}],
        routes: [
          {id: '1', label: '1', color: '#003DA5'},
          {id: 'CT1', label: 'CT1', color: '#DA291C'},
        ],
      },
    },
  },
  chicago: {
    recents: ['Clark/Lake', 'Fullerton'],
    modes: {
      train: {
        stations: [
          {id: 'clk', name: 'Clark/Lake', area: 'Loop', lines: ['Blue', 'Green', 'Orange', 'Pink']},
          {id: 'ful', name: 'Fullerton', area: 'Lincoln Park', lines: ['Red', 'Brown', 'Purple']},
        ],
        routes: [
          {id: 'Red', label: 'Red', color: '#C60C30'},
          {id: 'Blue', label: 'Blu', color: '#00A1DE'},
          {id: 'Green', label: 'Grn', color: '#009B3A'},
          {id: 'Brown', label: 'Brn', color: '#62361B'},
          {id: 'Orange', label: 'Org', color: '#F9461C'},
          {id: 'Purple', label: 'Pur', color: '#522398'},
          {id: 'Pink', label: 'Pnk', color: '#E27EA6'},
        ],
      },
    },
  },
};

const Haptics = {selectionAsync: async () => {}, notificationAsync: async (_: any) => {}};
export default function DashboardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{city?: string; from?: string}>();
  const city = normalizeCityIdParam(params.city);
  const fallbackRoute = params.from === 'presets' ? '/presets' : '/dashboard';
  const headerEnter = useRef(new Animated.Value(0)).current;
  const previewEnter = useRef(new Animated.Value(0)).current;
  const editorEnter = useRef(new Animated.Value(0)).current;
  const [layoutSlots, setLayoutSlots] = useState<number>(DEFAULT_LAYOUT_SLOTS);
  const [lines, setLines] = useState<LinePick[]>(() => ensureLineCount(seedDefaultLines(city), city, DEFAULT_LAYOUT_SLOTS));
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [stationSearch, setStationSearch] = useState<Record<string, string>>({});
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

  const [arrivals, setArrivals] = useState<Arrival[]>(() => seedArrivals(lines));

  useEffect(() => {
    setArrivals(prev => syncArrivals(prev, lines));
  }, [lines]);

  useEffect(() => {
    const timer = setInterval(() => {
      setArrivals(prev => tickArrivals(prev));
    }, 1800);
    return () => clearInterval(timer);
  }, []);

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
    setLines(prev => ensureLineCount(prev, city, safeSlots));
    setSelectedLineId('line-1');
    void Haptics.selectionAsync();
  };

  const updateLine = (id: string, next: Partial<LinePick>) => {
    setLines(prev => prev.map(line => (line.id === id ? normalizeLine(city, {...line, ...next}) : line)));
  };
  const handleSelectSlotForEdit = (id: string) => {
    if (slotEditorExpanded && selectedLineId === id) {
      setSlotEditorExpanded(false);
      setSelectedLineId('');
      return;
    }
    setSelectedLineId(id);
    setSlotEditorExpanded(true);
  };
  const toggleSlotEditor = () => {
    setSlotEditorExpanded(prev => {
      const next = !prev;
      if (!next) {
        setSelectedLineId('');
        return next;
      }
      if (!selectedLineId) {
        setSelectedLineId(lines[0]?.id ?? '');
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

  const selectedLine = lines.find(line => line.id === selectedLineId) ?? null;
  const selectedLineIndex = selectedLine ? lines.findIndex(line => line.id === selectedLine.id) : -1;
  const previewSlots = useMemo(
    () =>
      lines.map(line => {
        const cityStations = cityData[city].modes[line.mode]?.stations ?? [];
        const cityRoutes = cityData[city].modes[line.mode]?.routes ?? [];
        const station = cityStations.find(item => item.id === line.stationId);
        const route = cityRoutes.find(item => item.id === line.routeId);
        const arrival = arrivals.find(item => item.lineId === line.id);
        const stopName = line.label.trim() || station?.name || 'Select stop';
        const times = buildNextArrivalTimes(arrival?.minutes ?? 7, line.nextStops)
          .map(item => item.replace('m', ''))
          .join(', ');
        return {
          id: line.id,
          color: route?.color ?? '#3A3A3A',
          textColor: line.textColor || route?.textColor || '#FFFFFF',
          routeLabel: route?.label ?? '?',
          selected: line.id === selectedLineId,
          stopName,
          times,
        };
      }),
    [arrivals, city, lines, selectedLineId],
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
                    <SlotEditor
                      city={city}
                      line={selectedLine}
                      stationSearch={stationSearch[selectedLine.id] ?? ''}
                      onStationSearch={text => setStationSearch(prev => ({...prev, [selectedLine.id]: text}))}
                      recents={cityData[city].recents}
                      onChange={updateLine}
                    />
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
function SlotEditor({
  city,
  line,
  stationSearch,
  onStationSearch,
  recents,
  onChange,
}: {
  city: CityId;
  line: LinePick;
  stationSearch: string;
  onStationSearch: (value: string) => void;
  recents: string[];
  onChange: (id: string, next: Partial<LinePick>) => void;
}) {
  const switchAnim = useRef(new Animated.Value(1)).current;
  const cityModes = cityData[city].modes;
  const trainAvailable = !!cityModes.train;
  const busAvailable = !!cityModes.bus;
  const stations = cityModes[line.mode]?.stations ?? [];
  const routes = cityModes[line.mode]?.routes ?? [];
  const station = stations.find(s => s.id === line.stationId) ?? stations[0];
  const allowedRoutes = station ? routes.filter(r => station.lines.includes(r.id)) : routes;
  const canDecreaseNextStops = line.nextStops > 1;
  const canIncreaseNextStops = line.nextStops < MAX_NEXT_STOPS;

  useEffect(() => {
    switchAnim.setValue(0);
    Animated.parallel([
      Animated.timing(switchAnim, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [line.direction, line.id, line.mode, line.routeId, line.stationId, switchAnim]);

  const switchAnimatedStyle = {
    opacity: switchAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.88, 1],
    }),
  } as const;

  return (
    <Animated.View style={[styles.sectionBlock, switchAnimatedStyle]}>
      <View style={styles.segmented}>
        <Pressable
          style={[styles.segment, line.mode === 'train' && styles.segmentActive, !trainAvailable && styles.segmentDisabled]}
          disabled={!trainAvailable}
          onPress={() => onChange(line.id, {mode: 'train'})}>
          <Text style={[styles.segmentText, line.mode === 'train' && styles.segmentTextActive]}>Subway</Text>
        </Pressable>
        <Pressable
          style={[styles.segment, line.mode === 'bus' && styles.segmentActive, !busAvailable && styles.segmentDisabled]}
          disabled={!busAvailable}
          onPress={() => onChange(line.id, {mode: 'bus'})}>
          <Text style={[styles.segmentText, line.mode === 'bus' && styles.segmentTextActive]}>Bus</Text>
        </Pressable>
      </View>

      <StationInlinePicker
        stations={stations}
        value={line.stationId}
        search={stationSearch}
        onSearch={onStationSearch}
        recents={recents}
        onSelect={id => onChange(line.id, {stationId: id})}
      />

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionLabel}>Route</Text>
        {allowedRoutes.length === 0 ? (
          <Text style={styles.sectionHint}>No routes for this stop yet.</Text>
        ) : (
          <RouteGridPicker
            routes={allowedRoutes}
            selected={line.routeId ? [line.routeId] : []}
            onToggle={id => onChange(line.id, {routeId: id})}
          />
        )}
      </View>

      <DirectionToggle value={line.direction} onChange={direction => onChange(line.id, {direction})} />

      <View style={styles.secondarySectionCard}>
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>Custom Name</Text>
          <TextInput
            value={line.label}
            onChangeText={value => onChange(line.id, {label: value})}
            placeholder={station?.name ?? 'Give this slot a name'}
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
    </Animated.View>
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

function StationInlinePicker({
  stations,
  value,
  search,
  onSearch,
  recents,
  onSelect,
}: {
  stations: Station[];
  value: string;
  search: string;
  onSearch: (value: string) => void;
  recents: string[];
  onSelect: (id: string) => void;
}) {
  const [browseOpen, setBrowseOpen] = useState(false);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const commonStations = [
      ...recents
        .map(recent => stations.find(station => station.name === recent))
        .filter((station): station is Station => !!station),
      ...stations,
    ].filter((station, index, list) => list.findIndex(item => item.id === station.id) === index);

    if (!term) return commonStations.slice(0, 1);

    const scored = stations
      .map(station => {
        const name = station.name.toLowerCase();
        const area = station.area.toLowerCase();
        const lines = station.lines.join(' ').toLowerCase();
        let score = 99;

        if (name.startsWith(term)) score = 0;
        else if (station.lines.some(line => line.toLowerCase() === term)) score = 1;
        else if (station.lines.some(line => line.toLowerCase().startsWith(term))) score = 2;
        else if (name.includes(term)) score = 3;
        else if (area.includes(term)) score = 4;
        else if (lines.includes(term)) score = 5;

        return {station, score};
      })
      .filter(item => item.score < 99)
      .sort((a, b) => a.score - b.score || a.station.name.localeCompare(b.station.name))
      .map(item => item.station);

    return scored.length > 0 ? scored : commonStations;
  }, [recents, search, stations]);

  const visibleStations = browseOpen ? stations : filtered;

  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionLabel}>Stop</Text>
      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={text => {
            onSearch(text);
            if (text.trim()) setBrowseOpen(false);
          }}
          placeholder="Search stop"
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, styles.searchInputInline]}
        />
        <Pressable style={styles.searchDropdownButton} onPress={() => setBrowseOpen(prev => !prev)}>
          <Text style={styles.searchDropdownButtonCaret}>{browseOpen ? '▲' : '▼'}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.stationListInline} nestedScrollEnabled>
        {visibleStations.map((item, idx) => (
          <React.Fragment key={item.id}>
            <Pressable
              style={styles.stationRow}
              onPress={() => {
                onSelect(item.id);
                setBrowseOpen(false);
              }}>
              <View>
                <Text style={styles.stationName}>{item.name}</Text>
                <Text style={styles.stationMeta}>
                  {item.area} - {item.lines.join(' / ')}
                </Text>
              </View>
              <Text style={[styles.chevron, value === item.id && styles.chevronSelected]}>
                {value === item.id ? 'Selected' : 'Tap'}
              </Text>
            </Pressable>
            {idx < visibleStations.length - 1 && <View style={styles.listDivider} />}
          </React.Fragment>
        ))}
      </ScrollView>
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
function normalizeCityIdParam(value: string | undefined): CityId {
  if (value === 'philadelphia' || value === 'boston' || value === 'chicago' || value === 'new-york') return value;
  return 'new-york';
}

function hasMode(city: CityId, mode: ModeId) {
  return !!cityData[city].modes[mode];
}

function normalizeMode(city: CityId, mode: ModeId): ModeId {
  if (hasMode(city, mode)) return mode;
  return 'train';
}

function newLine(city: CityId, mode: ModeId, id: string): LinePick {
  const safeMode = normalizeMode(city, mode);
  const stations = cityData[city].modes[safeMode]?.stations ?? [];
  const routes = cityData[city].modes[safeMode]?.routes ?? [];
  const firstStation = stations[0];
  const firstRoute = firstStation ? routes.find(route => firstStation.lines.includes(route.id)) : routes[0];

  return normalizeLine(city, {
    id,
    mode: safeMode,
    stationId: firstStation?.id ?? '',
    routeId: firstRoute?.id ?? '',
    direction: 'uptown',
    label: '',
    textColor: DEFAULT_TEXT_COLOR,
    nextStops: DEFAULT_NEXT_STOPS,
  });
}

function normalizeLine(city: CityId, line: LinePick): LinePick {
  const safeMode = normalizeMode(city, line.mode);
  const stations = cityData[city].modes[safeMode]?.stations ?? [];
  const routes = cityData[city].modes[safeMode]?.routes ?? [];
  const station = stations.find(item => item.id === line.stationId) ?? stations[0];
  const allowedRoutes = station ? routes.filter(route => station.lines.includes(route.id)) : routes;
  const route = allowedRoutes.find(item => item.id === line.routeId) ?? allowedRoutes[0] ?? routes[0];

  return {
    ...line,
    mode: safeMode,
    stationId: station?.id ?? '',
    routeId: route?.id ?? '',
    direction: line.direction === 'downtown' ? 'downtown' : 'uptown',
    label: line.label ?? '',
    textColor: normalizeHexColor(line.textColor) ?? DEFAULT_TEXT_COLOR,
    nextStops: clampNextStops(line.nextStops),
  };
}

function seedDefaultLines(city: CityId): LinePick[] {
  const defaults = [newLine(city, 'train', 'line-1')];
  defaults.push(newLine(city, hasMode(city, 'bus') ? 'bus' : 'train', 'line-2'));
  return defaults;
}

function ensureLineCount(existing: LinePick[], city: CityId, slots: number): LinePick[] {
  const next: LinePick[] = [];
  for (let index = 0; index < slots; index += 1) {
    const id = `line-${index + 1}`;
    const fromExisting = existing.find(line => line.id === id);
    if (fromExisting) {
      next.push(normalizeLine(city, {...fromExisting, id}));
      continue;
    }

    const mode: ModeId = index === 0 ? 'train' : hasMode(city, 'bus') ? 'bus' : 'train';
    next.push(newLine(city, mode, id));
  }
  return next;
}

function seedArrivals(lines: LinePick[]): Arrival[] {
  return lines.map(line => ({
    lineId: line.id,
    minutes: 2 + Math.floor(Math.random() * 8),
    status: Math.random() > 0.85 ? 'DELAYS' : 'GOOD',
  }));
}

function syncArrivals(existing: Arrival[], lines: LinePick[]): Arrival[] {
  return lines.map(line => {
    const found = existing.find(item => item.lineId === line.id);
    if (found) return found;
    return {
      lineId: line.id,
      minutes: 2 + Math.floor(Math.random() * 8),
      status: Math.random() > 0.85 ? 'DELAYS' : 'GOOD',
    };
  });
}

function tickArrivals(prev: Arrival[]): Arrival[] {
  return prev.map(arrival => {
    const next = Math.max(0, arrival.minutes - (Math.random() > 0.4 ? 1 : 0));
    const recycled = next === 0 ? 8 + Math.floor(Math.random() * 4) : next;
    const status = Math.random() > 0.9 ? 'DELAYS' : 'GOOD';
    return {...arrival, minutes: recycled, status};
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
  segment: {flex: 1, paddingVertical: spacing.sm, alignItems: 'center'},
  segmentActive: {backgroundColor: colors.accentMuted},
  segmentDisabled: {opacity: 0.4},
  segmentText: {color: colors.textMuted, fontWeight: '700', fontSize: 13},
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
  emptyHint: {color: colors.textMuted, fontSize: 12},
});


