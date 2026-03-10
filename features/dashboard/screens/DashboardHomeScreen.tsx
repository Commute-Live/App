import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {BottomNav, type BottomNavItem} from '../../../components/BottomNav';
import {colors, radii, spacing} from '../../../theme';
import DashboardPreviewSection from '../components/DashboardPreviewSection';
import type {Display3DSlot} from '../components/Display3DPreview';
import {useAppState} from '../../../state/appState';
import {CITY_BRANDS, CITY_LABELS, CITY_OPTIONS, type CityId} from '../../../constants/cities';

type DayId = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type LivePreviewItem = {
  id: string;
  name: string;
  city: CityId;
  enabled: boolean;
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
const TIME_OPTIONS = ['00:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '17:00', '18:00', '20:00', '22:00', '23:00'];
const ALL_DAYS: DayId[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export default function DashboardHomeScreen() {
  const {state: appState} = useAppState();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true);
  const [quietHours, setQuietHours] = useState({start: '23:00', end: '05:00'});

  const selectedDevice = useMemo(
    () => ({
      id: appState.deviceId ?? 'current-device',
      name: appState.deviceId ? `Device ${appState.deviceId}` : 'Current Device',
      online: appState.deviceStatus === 'pairedOnline',
      city: appState.selectedCity,
    }),
    [appState.deviceId, appState.deviceStatus, appState.selectedCity],
  );
  const liveSlots = useMemo(
    () => buildLiveSlots(appState.selectedStations, appState.arrivals, selectedDevice.city),
    [appState.arrivals, appState.selectedStations, selectedDevice.city],
  );
  const carouselPresets = useMemo<LivePreviewItem[]>(
    () =>
      liveSlots.length > 0
        ? [
            {
              id: `live-${selectedDevice.city}`,
              name: appState.preset.trim() || 'Current Display',
              city: selectedDevice.city,
              enabled: true,
              displayStart: '00:00',
              displayEnd: '23:59',
              displayDays: ALL_DAYS,
              offStart: '00:00',
              offEnd: '00:00',
              slots: liveSlots,
            },
          ]
        : [],
    [appState.preset, liveSlots, selectedDevice.city],
  );
  const cityBrand = CITY_BRANDS[selectedDevice.city];
  const cityAgency = CITY_OPTIONS.find(option => option.id === selectedDevice.city)?.agencyCode ?? CITY_LABELS[selectedDevice.city];

  useEffect(() => {
    setCarouselIndex(0);
  }, [selectedDevice.city]);

  useEffect(() => {
    if (carouselPresets.length <= 1) return;
    const timer = setInterval(() => {
      setCarouselIndex(prev => (prev + 1) % carouselPresets.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [carouselPresets.length]);

  const activePreset = carouselPresets[carouselIndex] ?? null;

  const moveCarousel = (direction: 1 | -1) => {
    if (carouselPresets.length === 0) return;
    setCarouselIndex(prev => (prev + direction + carouselPresets.length) % carouselPresets.length);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Home</Text>
          <Text style={styles.subtitle}>Device status and what will be displayed next.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.deviceHeaderRow}>
            <View style={styles.deviceHeaderText}>
              <Text style={styles.deviceName}>{selectedDevice.name}</Text>
              <Text style={styles.deviceSubMeta}>City: {CITY_LABELS[selectedDevice.city]}</Text>
            </View>
            <View style={[styles.onlineChip, selectedDevice.online ? styles.onlineChipOn : styles.onlineChipOff]}>
              <View style={[styles.onlineDot, selectedDevice.online ? styles.onlineDotOn : styles.onlineDotOff]} />
              <Text style={styles.onlineChipText}>{selectedDevice.online ? 'Online' : 'Offline'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleWrap}>
              <View style={styles.heroBrandRow}>
                <View style={[styles.mtaBadge, {backgroundColor: cityBrand.badgeBg, borderColor: cityBrand.badgeBorder}]}>
                  <Text style={[styles.mtaBadgeText, {color: cityBrand.badgeText}]}>{cityAgency}</Text>
                </View>
                <Text style={styles.heroBrandText}>Live Transit Preview</Text>
              </View>
              <Text style={styles.heroLabel}>Preview Carousel</Text>
              <Text style={styles.heroTitle}>{activePreset?.name ?? 'No displays yet'}</Text>
              <Text style={styles.heroMeta}>
                {activePreset ? describeDisplayWindow(activePreset) : 'Create a display to preview it here'}
              </Text>
            </View>
            <View style={styles.heroArrowRow}>
              <Pressable style={styles.heroArrowButton} onPress={() => moveCarousel(-1)}>
                <Text style={styles.heroArrowText}>‹</Text>
              </Pressable>
              <Pressable style={styles.heroArrowButton} onPress={() => moveCarousel(1)}>
                <Text style={styles.heroArrowText}>›</Text>
              </Pressable>
            </View>
          </View>

          {activePreset ? (
            <>
              <DashboardPreviewSection
                slots={activePreset.slots}
                onSelectSlot={() => {}}
                onReorderSlot={() => {}}
                onDragStateChange={() => {}}
                showHint={false}
              />
              <View style={styles.heroFooter}>
                <Text style={styles.heroHint}>
                  {carouselPresets.length > 1 ? `Looping ${carouselPresets.length} displays. Use arrows to move manually.` : 'Only one display available for this device/city.'}
                </Text>
                <View style={styles.heroDots}>
                  {carouselPresets.map((preset, index) => (
                    <Pressable
                      key={preset.id}
                      style={[styles.heroDot, index === carouselIndex && styles.heroDotActive]}
                      onPress={() => setCarouselIndex(index)}
                    />
                  ))}
                </View>
              </View>
            </>
          ) : (
            <View style={styles.emptyHeroState}>
              <Text style={styles.emptyHeroText}>No displays for {CITY_LABELS[selectedDevice.city]} yet.</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.quietHeaderRow}>
            <View style={styles.deviceHeaderText}>
              <Text style={styles.sectionLabel}>Quiet Hours</Text>
              <Text style={styles.quietSubtext}>Sleep window overrides all other displays.</Text>
            </View>
            <Pressable
              style={[styles.stateChip, quietHoursEnabled ? styles.onlineChipOn : styles.stateChipOff]}
              onPress={() => setQuietHoursEnabled(prev => !prev)}>
              <Text style={styles.stateChipText}>{quietHoursEnabled ? 'On' : 'Off'}</Text>
            </Pressable>
          </View>

          <View style={styles.quietRangeRow}>
            <TimeAdjustField
              label="Sleep From"
              value={quietHours.start}
              onPrev={() => setQuietHours(prev => ({...prev, start: cycleTimeOption(prev.start, -1)}))}
              onNext={() => setQuietHours(prev => ({...prev, start: cycleTimeOption(prev.start, 1)}))}
            />
            <TimeAdjustField
              label="Wake At"
              value={quietHours.end}
              onPrev={() => setQuietHours(prev => ({...prev, end: cycleTimeOption(prev.end, -1)}))}
              onNext={() => setQuietHours(prev => ({...prev, end: cycleTimeOption(prev.end, 1)}))}
            />
          </View>
        </View>
      </ScrollView>

      <BottomNav items={NAV_ITEMS} />
    </SafeAreaView>
  );
}

function describeDisplayWindow(preset: LivePreviewItem) {
  return `${formatDayList(preset.displayDays)} ${preset.displayStart}-${preset.displayEnd}`;
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

function TimeAdjustField({
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
    <View style={styles.timeField}>
      <Text style={styles.timeFieldLabel}>{label}</Text>
      <View style={styles.timeFieldControls}>
        <Pressable style={styles.timeFieldButton} onPress={onPrev}>
          <Text style={styles.timeFieldButtonText}>-</Text>
        </Pressable>
        <Text style={styles.timeFieldValue}>{value}</Text>
        <Pressable style={styles.timeFieldButton} onPress={onNext}>
          <Text style={styles.timeFieldButtonText}>+</Text>
        </Pressable>
      </View>
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

function cycleTimeOption(current: string, delta: 1 | -1) {
  const index = TIME_OPTIONS.indexOf(current);
  const safeIndex = index === -1 ? 0 : index;
  const nextIndex = (safeIndex + delta + TIME_OPTIONS.length) % TIME_OPTIONS.length;
  return TIME_OPTIONS[nextIndex];
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {padding: spacing.lg, paddingBottom: 120, gap: spacing.md},
  header: {gap: 4, alignItems: 'center'},
  title: {color: colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center'},
  subtitle: {color: colors.textMuted, fontSize: 13, textAlign: 'center', maxWidth: 300},
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionLabel: {color: colors.text, fontSize: 13, fontWeight: '800'},
  deviceHeaderRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm},
  deviceHeaderText: {flex: 1},
  deviceName: {color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 2},
  deviceSubMeta: {color: colors.textMuted, fontSize: 11, marginTop: 3},
  onlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  onlineChipOn: {backgroundColor: '#0E2B21', borderColor: '#1B5E4A'},
  onlineChipOff: {backgroundColor: colors.surface, borderColor: colors.border},
  onlineDot: {width: 8, height: 8, borderRadius: 4},
  onlineDotOn: {backgroundColor: '#34D399'},
  onlineDotOff: {backgroundColor: colors.textMuted},
  onlineChipText: {color: colors.text, fontSize: 12, fontWeight: '800'},
  deviceSwitcherRow: {gap: spacing.xs},
  switcherLabel: {color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase'},
  devicePill: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  devicePillActive: {borderColor: colors.accent, backgroundColor: colors.accentMuted},
  devicePillText: {color: colors.text, fontSize: 12, fontWeight: '700'},
  devicePillTextActive: {color: colors.accent},
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  heroTopRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm},
  heroTitleWrap: {flex: 1},
  heroBrandRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4},
  mtaBadge: {
    width: 34,
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  mtaBadgeText: {fontSize: 10, fontWeight: '900'},
  heroBrandText: {color: colors.text, fontSize: 12, fontWeight: '800'},
  heroLabel: {color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase'},
  heroTitle: {color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 2},
  heroMeta: {color: colors.textMuted, fontSize: 12, marginTop: 2},
  heroArrowRow: {flexDirection: 'row', gap: spacing.xs},
  heroArrowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroArrowText: {color: colors.text, fontSize: 22, fontWeight: '700', marginTop: -2},
  heroFooter: {gap: spacing.xs},
  heroHint: {color: colors.textMuted, fontSize: 11},
  heroDots: {flexDirection: 'row', gap: 6, alignSelf: 'flex-start'},
  heroDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border},
  heroDotActive: {backgroundColor: colors.accent},
  emptyHeroState: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  emptyHeroText: {color: colors.textMuted, fontSize: 12},
  actionsRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs},
  secondaryButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {color: colors.text, fontSize: 12, fontWeight: '700'},
  ghostButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  ghostButtonText: {color: colors.textMuted, fontSize: 12, fontWeight: '700'},
  quietHeaderRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm},
  quietSubtext: {color: colors.textMuted, fontSize: 11, marginTop: 2},
  stateChip: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stateChipOff: {backgroundColor: colors.surface, borderColor: colors.border},
  stateChipText: {color: colors.text, fontSize: 11, fontWeight: '800'},
  quietRangeRow: {flexDirection: 'row', gap: spacing.xs},
  timeField: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xs,
    gap: 6,
  },
  timeFieldLabel: {color: colors.textMuted, fontSize: 11, fontWeight: '700'},
  timeFieldControls: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs},
  timeFieldButton: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeFieldButtonText: {color: colors.text, fontSize: 16, fontWeight: '800'},
  timeFieldValue: {color: colors.text, fontSize: 13, fontWeight: '800'},
});
