import React, {useCallback, useMemo, useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {useFocusEffect} from 'expo-router';
import {useMutation, useQueries, useQuery, useQueryClient} from '@tanstack/react-query';
import {colors, radii, spacing} from '../../../theme';
import {BottomNav, type BottomNavItem} from '../../../components/BottomNav';

const NAV_ITEMS: BottomNavItem[] = [
  {key: 'home', label: 'Home', icon: 'home-outline', route: '/dashboard'},
  {key: 'presets', label: 'Displays', icon: 'albums-outline', route: '/presets'},
  {key: 'settings', label: 'Settings', icon: 'settings-outline', route: '/settings'},
];
import DashboardPreviewSection from '../components/DashboardPreviewSection';
import {CITY_BRANDS, CITY_LABELS} from '../../../constants/cities';
import {useAppState} from '../../../state/appState';
import {useAuth} from '../../../state/authProvider';
import {
  deleteDisplay,
  fetchDisplays,
  providerToCity,
  toPreviewSlots,
  type DeviceDisplay,
} from '../../../lib/displays';
import {getTransitStationName} from '../../../lib/transitApi';
import {queryKeys} from '../../../lib/queryKeys';

const stopNameCache: Record<string, string> = {};


export default function PresetsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const router = useRouter();
  const {state: appState} = useAppState();
  const {deviceId, status, user} = useAuth();
  const selectedCity = appState.selectedCity;
  const [carouselIndex, setCarouselIndex] = useState(0);

  const displaysQuery = useQuery({
    queryKey: queryKeys.displays(deviceId || 'none'),
    queryFn: () => {
      if (!deviceId) throw new Error('No device selected');
      return fetchDisplays(deviceId);
    },
    enabled: !!deviceId && status === 'authenticated',
    staleTime: 30_000,
  });

  const displays = displaysQuery.data?.displays ?? [];
  const activeDisplayId = displaysQuery.data?.activeDisplayId ?? null;
  const loading = displaysQuery.isPending;
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
      displays.filter(display => {
        const city = providerToCity(display.config.lines?.[0]?.provider ?? null);
        return city === selectedCity;
      }),
    [displays, selectedCity],
  );

  const safeIndex = visibleDisplays.length > 0 ? Math.min(carouselIndex, visibleDisplays.length - 1) : 0;
  const currentDisplay = visibleDisplays[safeIndex] ?? null;

  const brand = CITY_BRANDS[selectedCity];

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
              setCarouselIndex(prev => Math.max(0, prev - 1));
            } catch (err) {
              Alert.alert('Delete failed', err instanceof Error ? err.message : 'Failed to delete display');
            }
          },
        },
      ]);
    },
    [deleteDisplayMutation, deviceId],
  );

  const goTo = (index: number) => {
    if (index < 0 || index >= visibleDisplays.length) return;
    setCarouselIndex(index);
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>

      {/* ── Brand Header ─────────────────────────────────────────────── */}
      <View style={styles.appHeader}>
        <View style={styles.wordmarkLockup}>
          <Ionicons name="navigate-outline" size={18} color={colors.accent} />
          <Text style={styles.wordmark}>CommuteLive</Text>
        </View>
        {user?.email ? (
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{user.email.charAt(0).toUpperCase()}</Text>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>


        {/* ── Page Header ───────────────────────────────────────────────── */}
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderRow}>
            <View style={styles.pageHeaderLeft}>
              <Text style={styles.pageTitle}>Displays</Text>
              {currentDisplay ? (
                <Text style={styles.displayMeta}>{currentDisplay.name}</Text>
              ) : null}
            </View>
            <View style={styles.pageHeaderRight}>
              <View style={styles.displayBadges}>
                {currentDisplay?.displayId === activeDisplayId ? (
                  <View style={[styles.badge, styles.badgeActive]}>
                    <View style={styles.badgeDot} />
                    <Text style={styles.badgeText}>Active</Text>
                  </View>
                ) : null}
                {currentDisplay?.paused ? (
                  <View style={[styles.badge, styles.badgePaused]}>
                    <Text style={styles.badgeText}>Paused</Text>
                  </View>
                ) : null}
              </View>
              <Pressable
                style={styles.addBtn}
                onPress={() => router.push({pathname: '/preset-editor', params: {city: selectedCity, from: 'presets', mode: 'new'}})}>
                <Ionicons name="add" size={20} color={colors.background} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Loading / Error ───────────────────────────────────────────── */}
        {loading ? <Text style={styles.hintText}>Loading displays…</Text> : null}
        {!loading && errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        {/* ── LED + Controls ────────────────────────────────────────────── */}
        {!loading && !errorText ? (
          <View style={styles.ledSection}>
            <Text style={styles.sectionOverline}>Current Display</Text>

            {currentDisplay ? (
              <>
                <DashboardPreviewSection
                  slots={toPreviewSlots(currentDisplay, brand.accent, stopNames)}
                  displayType={currentDisplay.config.displayType ?? Number(currentDisplay.config.lines?.[0]?.displayType) ?? 1}
                  onSelectSlot={() =>
                    router.push({
                      pathname: '/preset-editor',
                      params: {city: selectedCity, from: 'presets', mode: 'edit', displayId: currentDisplay.displayId},
                    })
                  }
                  onReorderSlot={() => {}}
                  onDragStateChange={() => {}}
                  showHint={false}
                  brightness={currentDisplay.config.brightness ?? 60}
                />

                <View style={styles.controlsRow}>
                  <Pressable
                    style={styles.editBtn}
                    onPress={() =>
                      router.push({
                        pathname: '/preset-editor',
                        params: {city: selectedCity, from: 'presets', mode: 'edit', displayId: currentDisplay.displayId},
                      })
                    }>
                    <Ionicons name="pencil-outline" size={14} color={colors.text} />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </Pressable>

                  <View style={styles.slideshowControls}>
                    <Pressable
                      style={[styles.arrowBtn, safeIndex === 0 && styles.arrowBtnDisabled]}
                      onPress={() => goTo(safeIndex - 1)}
                      disabled={safeIndex === 0}>
                      <Ionicons name="chevron-back" size={14} color={safeIndex === 0 ? colors.border : colors.text} />
                    </Pressable>
                    <View style={styles.dotRow}>
                      {visibleDisplays.map((_, i) => (
                        <Pressable key={i} onPress={() => goTo(i)}>
                          <View style={[styles.dot, i === safeIndex && styles.dotActive]} />
                        </Pressable>
                      ))}
                    </View>
                    <Pressable
                      style={[styles.arrowBtn, safeIndex === visibleDisplays.length - 1 && styles.arrowBtnDisabled]}
                      onPress={() => goTo(safeIndex + 1)}
                      disabled={safeIndex === visibleDisplays.length - 1}>
                      <Ionicons name="chevron-forward" size={14} color={safeIndex === visibleDisplays.length - 1 ? colors.border : colors.text} />
                    </Pressable>
                  </View>

                  <Pressable style={styles.deleteBtn} onPress={() => confirmDelete(currentDisplay)}>
                    <Ionicons name="trash-outline" size={14} color="#FCA5A5" />
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No displays yet</Text>
                <Text style={styles.emptyBody}>Create your first display below.</Text>
              </View>
            )}
          </View>
        ) : null}



      </ScrollView>

      <BottomNav items={NAV_ITEMS} />
    </View>
  );
}

const styles = StyleSheet.create({
  // ─── Layout ───────────────────────────────────────────────────────────────
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 120,
    gap: spacing.xl,
  },

  // ─── Brand Header ─────────────────────────────────────────────────────────
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  wordmarkLockup: {flexDirection: 'row', alignItems: 'center', gap: 7},
  wordmark: {color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.5},
  avatarCircle: {
    position: 'absolute',
    right: spacing.lg,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {color: colors.accent, fontSize: 13, fontWeight: '800'},

  // ─── Page Header ──────────────────────────────────────────────────────────
  pageHeader: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pageHeaderLeft: {gap: 3, flex: 1},
  pageHeaderRight: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 33,
  },
  displayMeta: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },

  // ─── LED Section ──────────────────────────────────────────────────────────
  ledSection: {
    gap: spacing.md,
  },

  // ─── Sections ─────────────────────────────────────────────────────────────
  section: {gap: spacing.md},
  sectionOverline: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  // ─── Loading / Error / Empty ───────────────────────────────────────────────
  loadingRow: {alignItems: 'center', paddingVertical: spacing.xl},
  hintText: {color: colors.textMuted, fontSize: 13},
  errorText: {color: colors.warning, fontSize: 13},
  emptyState: {gap: spacing.xs},
  emptyTitle: {color: colors.text, fontSize: 15, fontWeight: '800'},
  emptyBody: {color: colors.textMuted, fontSize: 13, lineHeight: 18},


  displayBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  badgeActive: {backgroundColor: '#0E2B21', borderColor: '#1B5E4A'},
  badgePaused: {backgroundColor: colors.surface, borderColor: colors.border},
  badgeDot: {width: 7, height: 7, borderRadius: 4, backgroundColor: '#34D399'},
  badgeText: {color: colors.text, fontSize: 11, fontWeight: '800'},

  // ─── Controls Row ─────────────────────────────────────────────────────────
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  slideshowControls: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  arrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtnDisabled: {opacity: 0.35},
  dotRow: {flexDirection: 'row', alignItems: 'center', gap: 5},
  dot: {width: 5, height: 5, borderRadius: 3, backgroundColor: colors.border},
  dotActive: {width: 14, height: 5, borderRadius: 3, backgroundColor: colors.accent},
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  editBtnText: {color: colors.text, fontSize: 13, fontWeight: '700'},
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#5B1C1C',
    backgroundColor: '#231011',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Quick Settings ───────────────────────────────────────────────────────
  quickSettings: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  settingLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flex: 1,
  },

  // ─── Stepper ──────────────────────────────────────────────────────────────
  stepperRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {color: colors.text, fontSize: 18, fontWeight: '500', lineHeight: 22},
  stepperValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    minWidth: 48,
    textAlign: 'center',
  },

  // ─── Days ─────────────────────────────────────────────────────────────────
  daysRow: {flexDirection: 'row', gap: 5},
  dayPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillActive: {borderColor: colors.accent, backgroundColor: colors.accentMuted},
  dayPillText: {color: colors.textMuted, fontSize: 11, fontWeight: '800'},
  dayPillTextActive: {color: colors.accent},

  // ─── Time Range ───────────────────────────────────────────────────────────
  timeRangeRow: {flexDirection: 'row', gap: spacing.sm},
  timeField: {
    flex: 1,
    gap: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  timeFieldLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // ─── Save Button ──────────────────────────────────────────────────────────
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  saveBtnDisabled: {opacity: 0.5},
  saveBtnText: {color: colors.background, fontSize: 14, fontWeight: '800'},
});
