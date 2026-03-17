import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type GestureResponderEvent} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {BottomNav, type BottomNavItem} from '../../../components/BottomNav';
import {colors, radii, spacing} from '../../../theme';
import DashboardPreviewSection from '../components/DashboardPreviewSection';
import type {Display3DSlot} from '../components/Display3DPreview';
import {useAppState} from '../../../state/appState';
import {CITY_BRANDS, CITY_LABELS, CITY_OPTIONS, type CityId} from '../../../constants/cities';

type DayId = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

type PresetItem = {
  id: string;
  name: string;
  city: CityId;
  pinned: boolean;
  enabled: boolean;
  brightness: number;
  displayStart: string;
  displayEnd: string;
  displayDays: DayId[];
  offStart: string;
  offEnd: string;
  slots: Display3DSlot[];
};

const NAV_ITEMS: BottomNavItem[] = [
  {key: 'home', label: 'Home', icon: 'home-outline', route: '/dashboard'},
  {key: 'presets', label: 'Displays', icon: 'albums-outline', route: '/presets'},
  {key: 'settings', label: 'Settings', icon: 'settings-outline', route: '/settings'},
];
const ALL_DAYS: DayId[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export default function PresetsScreen() {
  const router = useRouter();
  const {state: appState} = useAppState();
  const [pinned, setPinned] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [brightness, setBrightness] = useState(70);
  const [hidden, setHidden] = useState(false);
  const selectedCity = appState.selectedCity;
  const livePreset = useMemo(() => buildLivePreset(appState), [appState]);

  useEffect(() => {
    setPinned(false);
    setEnabled(true);
    setBrightness(Math.max(10, Math.min(100, Math.round(appState.brightness))));
    setHidden(false);
  }, [appState.brightness, appState.preset, selectedCity]);

  const visiblePresets = useMemo(
    () => (livePreset && livePreset.city === selectedCity && !hidden ? [{...livePreset, pinned, enabled, brightness}] : []),
    [brightness, enabled, hidden, livePreset, pinned, selectedCity],
  );

  const togglePin = (id: string) => {
    if (id !== livePreset?.id) return;
    setPinned(prev => !prev);
  };

  const toggleEnabled = (id: string) => {
    if (id !== livePreset?.id) return;
    setEnabled(prev => !prev);
  };
  const deletePreset = (id: string) => {
    if (id !== livePreset?.id) return;
    setHidden(true);
  };
  const confirmDeletePreset = (preset: PresetItem) => {
    Alert.alert(
      'Delete display?',
      `Delete "${preset.name}"? This can’t be undone.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Delete', style: 'destructive', onPress: () => deletePreset(preset.id)},
      ],
      {cancelable: true},
    );
  };
  const setPresetBrightness = (id: string, brightness: number) => {
    if (id !== livePreset?.id) return;
    setBrightness(Math.max(10, Math.min(100, Math.round(brightness))));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Displays</Text>
          <Text style={styles.subtitle}>Manage your saved displays and open one to edit.</Text>
          <Pressable
            style={styles.addButton}
            onPress={() => router.push({pathname: '/preset-editor', params: {city: selectedCity, from: 'presets', mode: 'new'}})}>
            <Text style={styles.addButtonText}>+ Add Display</Text>
          </Pressable>
        </View>

        {visiblePresets.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyTitle}>No displays yet</Text>
            <Text style={styles.hint}>Create a {CITY_LABELS[selectedCity]} display to start scheduling what appears on your device.</Text>
          </View>
        ) : (
          visiblePresets.map(preset => (
            <View
              key={preset.id}
              style={[styles.presetCard, {borderColor: CITY_BRANDS[preset.city].accentSoft}]}>
              <View style={styles.presetHeader}>
                <View style={styles.presetHeaderText}>
                  <Text style={styles.presetName}>{preset.name}</Text>
                  <Text style={styles.presetMeta}>
                    {preset.enabled ? 'Enabled' : 'Paused'} | Brightness {preset.brightness}%
                  </Text>
                </View>
                <View style={styles.headerActions}>
                  <CityBadge city={preset.city} compact />
                  <Pressable style={[styles.statusChip, preset.enabled ? styles.statusChipOn : styles.statusChipOff]} onPress={() => toggleEnabled(preset.id)}>
                    <Text style={styles.statusChipText}>{preset.enabled ? 'On' : 'Off'}</Text>
                  </Pressable>
                  <Pressable style={[styles.pinBubble, preset.pinned && styles.pinBubbleActive]} onPress={() => togglePin(preset.id)}>
                    <Text style={[styles.pinEmoji, preset.pinned && styles.pinEmojiActive]}>{preset.pinned ? '★' : '☆'}</Text>
                  </Pressable>
                </View>
              </View>

              <DashboardPreviewSection
                slots={preset.slots}
                onSelectSlot={() => {}}
                onReorderSlot={() => {}}
                onDragStateChange={() => {}}
                showHint={false}
                brightness={preset.brightness}
              />

              <View style={styles.summaryBlock}>
                <SummaryRow label="Displays" value={`${formatDayList(preset.displayDays)} ${preset.displayStart}-${preset.displayEnd}`} />
              </View>

              <View style={styles.brightnessRow}>
                <Text style={styles.brightnessLabel}>Brightness</Text>
                <BrightnessSlider
                  value={preset.brightness}
                  onChange={value => setPresetBrightness(preset.id, value)}
                />
              </View>

              <Pressable
                style={styles.editButtonFull}
                onPress={() => router.push({pathname: '/preset-editor', params: {city: preset.city, from: 'presets', mode: 'edit'}})}>
                <Text style={styles.editButtonFullText}>Edit Display</Text>
              </Pressable>
              <Pressable style={styles.deleteButton} onPress={() => confirmDeletePreset(preset)}>
                <Text style={styles.deleteButtonText}>Delete Display</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <BottomNav items={NAV_ITEMS} />
    </SafeAreaView>
  );
}

function buildLivePreset(appState: ReturnType<typeof useAppState>['state']): PresetItem | null {
  const slots = buildLiveSlots(appState.selectedStations, appState.arrivals, appState.selectedCity);
  if (slots.length === 0) return null;
  return {
    id: `live-${appState.selectedCity}`,
    name: appState.preset.trim() || 'Current Display',
    city: appState.selectedCity,
    pinned: false,
    enabled: true,
    brightness: Math.max(10, Math.min(100, Math.round(appState.brightness))),
    displayStart: '00:00',
    displayEnd: '23:59',
    displayDays: ALL_DAYS,
    offStart: '00:00',
    offEnd: '00:00',
    slots,
  };
}

function buildLiveSlots(
  selectedStations: string[],
  arrivals: {line: string; destination: string; minutes: number}[],
  city: CityId,
): Display3DSlot[] {
  const stops = selectedStations.length > 0 ? selectedStations : arrivals.map(item => item.destination).filter(Boolean);
  const count = Math.max(stops.length, arrivals.length);
  if (count === 0) return [];

  const accent = CITY_BRANDS[city].accent;
  return Array.from({length: Math.min(2, count)}, (_, index) => {
    const arrival = arrivals[index];
    const stopName = stops[index] ?? arrival?.destination ?? `Stop ${index + 1}`;
    const routeLabel = toRouteLabel(arrival?.line);
    const minutes = Number.isFinite(arrival?.minutes) ? Math.max(0, Math.round(arrival!.minutes)) : null;
    return {
      id: `slot-${index + 1}`,
      color: accent,
      textColor: '#041015',
      routeLabel,
      selected: false,
      stopName,
      times: minutes == null ? '--' : `${minutes}`,
    };
  });
}

function toRouteLabel(line: string | undefined) {
  if (!line) return '--';
  const cleaned = line.trim().toUpperCase();
  return cleaned.length <= 4 ? cleaned : cleaned.slice(0, 4);
}

function SummaryRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function CityBadge({city, compact = false}: {city: CityId; compact?: boolean}) {
  const brand = CITY_BRANDS[city];
  const agencyCode = CITY_OPTIONS.find(option => option.id === city)?.agencyCode ?? CITY_LABELS[city];
  return (
    <View
      style={[
        styles.cityBadge,
        compact && styles.cityBadgeCompact,
        {backgroundColor: brand.badgeBg, borderColor: brand.badgeBorder},
      ]}>
      <Text style={[styles.cityBadgeText, {color: brand.badgeText}]}>{agencyCode}</Text>
    </View>
  );
}

function formatDayList(days: DayId[]) {
  const weekday: DayId[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
  const weekend: DayId[] = ['sat', 'sun'];
  if (days.length === 7) return 'Every day';
  if (weekday.every(day => days.includes(day)) && days.length === weekday.length) return 'Mon-Fri';
  if (weekend.every(day => days.includes(day)) && days.length === weekend.length) return 'Sat-Sun';
  const labels: Record<DayId, string> = {mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun'};
  return days.map(day => labels[day]).join(', ');
}

function BrightnessSlider({value, onChange}: {value: number; onChange: (value: number) => void}) {
  const [railWidth, setRailWidth] = useState(1);
  const safeValue = Math.max(10, Math.min(100, value));
  const trackInset = 10;

  const updateFromTouch = (event: GestureResponderEvent) => {
    const x = event.nativeEvent.locationX - trackInset;
    const next = (Math.max(0, Math.min(railWidth, x)) / Math.max(1, railWidth)) * 100;
    onChange(Math.max(10, next));
  };

  const handleRailLayout = (event: LayoutChangeEvent) => {
    setRailWidth(Math.max(1, event.nativeEvent.layout.width));
  };

  const thumbLeft = (safeValue / 100) * railWidth;

  return (
    <View style={styles.brightnessSliderWrap}>
      <View style={styles.brightnessSliderHeader}>
        <Text style={styles.brightnessRangeText}>10%</Text>
        <Text style={styles.brightnessValue}>{safeValue}%</Text>
        <Text style={styles.brightnessRangeText}>100%</Text>
      </View>
      <View
        style={styles.brightnessTrack}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={updateFromTouch}
        onResponderMove={updateFromTouch}>
        <View style={styles.brightnessRail} onLayout={handleRailLayout}>
          <View style={[styles.brightnessTrackFill, {width: `${safeValue}%`}]} />
          <View
            pointerEvents="none"
            style={[styles.brightnessThumb, {left: Math.max(0, Math.min(railWidth - 18, thumbLeft - 9))}]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {padding: spacing.lg, paddingBottom: 120, gap: spacing.md},
  header: {gap: spacing.sm, alignItems: 'center'},
  title: {color: colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center'},
  subtitle: {color: colors.textMuted, fontSize: 12, textAlign: 'center', maxWidth: 320},
  cityHeaderCard: {
    alignSelf: 'stretch',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  cityHeaderRow: {flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm},
  cityHeaderText: {flex: 1, gap: 2},
  cityHeaderTitle: {color: colors.text, fontSize: 13, fontWeight: '800'},
  cityHeaderBody: {color: colors.textMuted, fontSize: 11},
  cityHeaderAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
  },
  addButton: {
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  addButtonText: {color: colors.background, fontSize: 14, fontWeight: '900'},
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  emptyTitle: {color: colors.text, fontSize: 15, fontWeight: '800'},
  hint: {color: colors.textMuted, fontSize: 12},
  presetCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  presetHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm},
  presetHeaderText: {flex: 1},
  presetName: {color: colors.text, fontSize: 16, fontWeight: '900'},
  cityBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2D5DB5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityBadgeCompact: {
    minWidth: 38,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cityBadgeText: {fontSize: 11, fontWeight: '900', letterSpacing: 0.3},
  presetMeta: {color: colors.textMuted, fontSize: 12, marginTop: 2},
  headerActions: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap', justifyContent: 'flex-end'},
  statusChip: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusChipOn: {backgroundColor: '#0E2B21', borderColor: '#1B5E4A'},
  statusChipOff: {backgroundColor: colors.surface, borderColor: colors.border},
  statusChipText: {color: colors.text, fontSize: 11, fontWeight: '800'},
  pinBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBubbleActive: {borderColor: colors.accent, backgroundColor: colors.accentMuted},
  pinEmoji: {fontSize: 17, color: '#C7CFD6'},
  pinEmojiActive: {color: '#FACC15'},
  summaryBlock: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  summaryRow: {gap: 2},
  summaryLabel: {color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase'},
  summaryValue: {color: colors.text, fontSize: 13, fontWeight: '700'},
  brightnessRow: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  brightnessLabel: {color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase'},
  brightnessControls: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs},
  brightnessValue: {color: colors.text, fontSize: 13, fontWeight: '800'},
  brightnessSliderWrap: {gap: spacing.xs},
  brightnessSliderHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  brightnessRangeText: {color: colors.textMuted, fontSize: 11, fontWeight: '700'},
  brightnessTrack: {
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    justifyContent: 'center',
    position: 'relative',
  },
  brightnessRail: {
    marginHorizontal: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0E1217',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'visible',
    justifyContent: 'center',
  },
  brightnessTrackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.accentMuted,
    borderRadius: 5,
  },
  brightnessThumb: {
    position: 'absolute',
    top: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.background,
  },
  editButtonFull: {
    marginTop: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  editButtonFullText: {color: colors.text, fontSize: 13, fontWeight: '900'},
  deleteButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#5B1C1C',
    backgroundColor: '#231011',
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  deleteButtonText: {color: '#FCA5A5', fontSize: 12, fontWeight: '800'},
});
