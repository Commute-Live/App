import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {BottomNav, type BottomNavItem} from '../../../components/BottomNav';
import {colors, radii, spacing} from '../../../theme';
import DashboardPreviewSection from '../components/DashboardPreviewSection';
import {CITY_BRANDS, CITY_LABELS} from '../../../constants/cities';
import {useAppState} from '../../../state/appState';
import {useAuth} from '../../../state/authProvider';
import {useSelectedDevice} from '../../../hooks/useSelectedDevice';
import {
  deleteDisplay,
  fetchDisplays,
  providerToCity,
  toDisplayScheduleText,
  toPreviewSlots,
  type DeviceDisplay,
} from '../../../lib/displays';

const NAV_ITEMS: BottomNavItem[] = [
  {key: 'home', label: 'Home', icon: 'home-outline', route: '/dashboard'},
  {key: 'presets', label: 'Displays', icon: 'albums-outline', route: '/presets'},
  {key: 'settings', label: 'Settings', icon: 'settings-outline', route: '/settings'},
];

export default function PresetsScreen() {
  const router = useRouter();
  const {state: appState} = useAppState();
  const {deviceId, status} = useAuth();
  const selectedDevice = useSelectedDevice();
  const selectedCity = appState.selectedCity;
  const [displays, setDisplays] = useState<DeviceDisplay[]>([]);
  const [activeDisplayId, setActiveDisplayId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  const load = useCallback(async () => {
    if (!deviceId) {
      setDisplays([]);
      setActiveDisplayId(null);
      return;
    }

    setLoading(true);
    setErrorText('');
    try {
      const data = await fetchDisplays(deviceId);
      setDisplays(data.displays);
      setActiveDisplayId(data.activeDisplayId);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Failed to load displays');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    void load();
  }, [load, status]);

  const visibleDisplays = useMemo(
    () =>
      displays.filter((display) => {
        const city = providerToCity(display.config.lines?.[0]?.provider ?? null);
        return city === selectedCity;
      }),
    [displays, selectedCity],
  );

  const confirmDelete = useCallback(
    (display: DeviceDisplay) => {
      if (!deviceId) return;
      Alert.alert('Delete display?', `Delete "${display.name}"? This cannot be undone.`, [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDisplay(deviceId, display.displayId);
              await load();
            } catch (err) {
              Alert.alert('Delete failed', err instanceof Error ? err.message : 'Failed to delete display');
            }
          },
        },
      ]);
    },
    [deviceId, load],
  );

  const brand = CITY_BRANDS[selectedCity];

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

        <View style={styles.card}>
          <Text style={styles.deviceName}>{selectedDevice.name}</Text>
          <Text style={styles.deviceMeta}>
            {deviceId ? `Device ID: ${deviceId}` : 'No linked device'} | City: {CITY_LABELS[selectedCity]}
          </Text>
        </View>

        {loading ? <Text style={styles.hint}>Loading displays...</Text> : null}
        {!loading && errorText ? <Text style={styles.error}>{errorText}</Text> : null}

        {!loading && !errorText && visibleDisplays.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyTitle}>No displays yet</Text>
            <Text style={styles.hint}>Create a {CITY_LABELS[selectedCity]} display to start scheduling what appears on your device.</Text>
          </View>
        ) : null}

        {!loading &&
          !errorText &&
          visibleDisplays.map(display => (
            <View key={display.displayId} style={[styles.presetCard, {borderColor: brand.accentSoft}]}>
              <View style={styles.presetHeader}>
                <View style={styles.presetHeaderText}>
                  <Text style={styles.presetName}>{display.name}</Text>
                  <Text style={styles.presetMeta}>
                    {display.paused ? 'Paused' : 'Enabled'} | Brightness {display.config.brightness ?? 60}%
                  </Text>
                </View>
                <View style={styles.headerActions}>
                  {display.displayId === activeDisplayId ? (
                    <View style={[styles.statusChip, styles.statusChipOn]}>
                      <Text style={styles.statusChipText}>Active</Text>
                    </View>
                  ) : null}
                  <View style={[styles.statusChip, display.paused ? styles.statusChipOff : styles.statusChipOn]}>
                    <Text style={styles.statusChipText}>{display.paused ? 'Paused' : 'Ready'}</Text>
                  </View>
                </View>
              </View>

              <DashboardPreviewSection
                slots={toPreviewSlots(display, brand.accent)}
                onSelectSlot={() => {}}
                onReorderSlot={() => {}}
                onDragStateChange={() => {}}
                showHint={false}
                brightness={display.config.brightness ?? 60}
              />

              <View style={styles.summaryBlock}>
                <SummaryRow label="Schedule" value={toDisplayScheduleText(display)} />
                <SummaryRow label="Layout" value={`Preset ${display.config.displayType ?? 1} | ${display.config.lines?.length ?? 0} lines`} />
              </View>

              <Pressable
                style={styles.editButtonFull}
                onPress={() =>
                  router.push({
                    pathname: '/preset-editor',
                    params: {city: selectedCity, from: 'presets', mode: 'edit', displayId: display.displayId},
                  })
                }>
                <Text style={styles.editButtonFullText}>Edit Display</Text>
              </Pressable>
              <Pressable style={styles.deleteButton} onPress={() => confirmDelete(display)}>
                <Text style={styles.deleteButtonText}>Delete Display</Text>
              </Pressable>
            </View>
          ))}
      </ScrollView>

      <BottomNav items={NAV_ITEMS} />
    </SafeAreaView>
  );
}

function SummaryRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {padding: spacing.lg, paddingBottom: 120, gap: spacing.md},
  header: {gap: spacing.sm, alignItems: 'center'},
  title: {color: colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center'},
  subtitle: {color: colors.textMuted, fontSize: 12, textAlign: 'center', maxWidth: 320},
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
  deviceName: {color: colors.text, fontSize: 15, fontWeight: '800'},
  deviceMeta: {color: colors.textMuted, fontSize: 12},
  emptyTitle: {color: colors.text, fontSize: 15, fontWeight: '800'},
  hint: {color: colors.textMuted, fontSize: 12},
  error: {color: colors.warning, fontSize: 12},
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
