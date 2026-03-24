import React, {useCallback, useMemo} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {useFocusEffect} from 'expo-router';
import {useMutation, useQueries, useQuery, useQueryClient} from '@tanstack/react-query';
import {BottomNav, type BottomNavItem} from '../../../components/BottomNav';
import {colors, radii, spacing} from '../../../theme';
import DashboardPreviewSection from '../components/DashboardPreviewSection';
import {CITY_BRANDS, CITY_LABELS} from '../../../constants/cities';
import {useAppState} from '../../../state/appState';
import {useAuth} from '../../../state/authProvider';
import {
  deleteDisplay,
  fetchDisplays,
  providerToCity,
  toDisplayScheduleText,
  toPreviewSlots,
  type DeviceDisplay,
} from '../../../lib/displays';
import {getTransitStationName} from '../../../lib/transitApi';
import {queryKeys} from '../../../lib/queryKeys';

const stopNameCache: Record<string, string> = {};

const NAV_ITEMS: BottomNavItem[] = [
  {key: 'home', label: 'Home', icon: 'home-outline', route: '/dashboard'},
  {key: 'presets', label: 'Displays', icon: 'albums-outline', route: '/presets'},
  {key: 'settings', label: 'Settings', icon: 'settings-outline', route: '/settings'},
];

export default function PresetsScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const {state: appState} = useAppState();
  const {deviceId, status} = useAuth();
  const selectedCity = appState.selectedCity;
  const displaysQuery = useQuery({
    queryKey: queryKeys.displays(deviceId || 'none'),
    queryFn: () => {
      if (!deviceId) throw new Error('No device selected');
      return fetchDisplays(deviceId);
    },
    enabled: !!deviceId && status === 'authenticated',
  });

  const displays = displaysQuery.data?.displays ?? [];
  const activeDisplayId = displaysQuery.data?.activeDisplayId ?? null;
  const loading = displaysQuery.isPending || displaysQuery.isFetching;
  const errorText = displaysQuery.error instanceof Error ? displaysQuery.error.message : '';

  const stopPairs = useMemo(() => {
    const pairs: {key: string; provider: string; stop: string}[] = [];
    for (const display of displays) {
      for (const line of display.config.lines ?? []) {
        if (!line.provider || !line.stop) continue;
        const key = `${line.provider}:${line.stop}`;
        if (!pairs.find(pair => pair.key === key)) {
          pairs.push({key, provider: line.provider, stop: line.stop});
        }
      }
    }
    return pairs;
  }, [displays]);

  const stopNameQueries = useQueries({
    queries: stopPairs.map(({provider, stop}) => ({
      queryKey: queryKeys.transitStationName(provider, stop),
      queryFn: () => getTransitStationName(provider, stop),
      staleTime: 10 * 60 * 1000,
    })),
  });

  const stopNames = useMemo(() => {
    const next = {...stopNameCache};
    stopPairs.forEach((pair, index) => {
      const resolved = stopNameQueries[index]?.data;
      if (!resolved) return;
      next[pair.key] = resolved;
    });
    Object.assign(stopNameCache, next);
    return next;
  }, [stopNameQueries, stopPairs]);

  const deleteDisplayMutation = useMutation({
    mutationFn: async (display: DeviceDisplay) => {
      if (!deviceId) return;
      await deleteDisplay(deviceId, display.displayId);
    },
    onSuccess: () => {
      if (!deviceId) return;
      void queryClient.invalidateQueries({queryKey: queryKeys.displays(deviceId)});
    },
  });

  useFocusEffect(
    useCallback(() => {
      if (!deviceId || status !== 'authenticated') return;
      void queryClient.invalidateQueries({queryKey: queryKeys.displays(deviceId)});
    }, [deviceId, queryClient, status]),
  );

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
              await deleteDisplayMutation.mutateAsync(display);
            } catch (err) {
              Alert.alert('Delete failed', err instanceof Error ? err.message : 'Failed to delete display');
            }
          },
        },
      ]);
    },
    [deleteDisplayMutation, deviceId],
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
                  <Pressable
                    style={styles.editIcon}
                    onPress={() =>
                      router.push({
                        pathname: '/preset-editor',
                        params: {city: selectedCity, from: 'presets', mode: 'edit', displayId: display.displayId},
                      })
                    }>
                    <Text style={styles.editIconText}>✎</Text>
                  </Pressable>
                  <Pressable style={styles.deleteX} onPress={() => confirmDelete(display)}>
                    <Text style={styles.deleteXText}>✕</Text>
                  </Pressable>
                </View>
              </View>

              <DashboardPreviewSection
                slots={toPreviewSlots(display, brand.accent, stopNames)}
                displayType={display.config.displayType ?? Number(display.config.lines?.[0]?.displayType) ?? 1}
                onSelectSlot={() =>
                  router.push({
                    pathname: '/preset-editor',
                    params: {city: selectedCity, from: 'presets', mode: 'edit', displayId: display.displayId},
                  })
                }
                onReorderSlot={() => {}}
                onDragStateChange={() => {}}
                showHint={false}
                brightness={display.config.brightness ?? 60}
              />

              <View style={styles.summaryBlock}>
                <SummaryRow label="Schedule" value={toDisplayScheduleText(display)} />
              </View>

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
  editIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#FACC15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIconText: {color: colors.text, fontSize: 12, fontWeight: '900', lineHeight: 14},
  deleteX: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#231011',
    borderWidth: 1,
    borderColor: '#5B1C1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteXText: {color: '#FCA5A5', fontSize: 11, fontWeight: '900', lineHeight: 14},
});
