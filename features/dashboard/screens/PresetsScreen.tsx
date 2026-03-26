import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Image, PanResponder, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {useFocusEffect} from 'expo-router';
import {useMutation, useQueries, useQuery, useQueryClient} from '@tanstack/react-query';
import {colors, radii, spacing} from '../../../theme';
import {BottomNav, type BottomNavItem} from '../../../components/BottomNav';
import {apiFetch} from '../../../lib/api';

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
  DISPLAY_WEEKDAYS,
  fetchDisplays,
  providerToCity,
  toPreviewSlots,
  toDisplayScheduleText,
  updateDisplay,
  type DisplayWeekday,
  type DisplaySavePayload,
  type DeviceDisplay,
} from '../../../lib/displays';
import {getTransitStationName} from '../../../lib/transitApi';
import {queryKeys} from '../../../lib/queryKeys';
import {cycleTimeOption} from './DashboardOverview.time';

const stopNameCache: Record<string, string> = {};
const MIN_BRIGHTNESS = 10;
const MAX_BRIGHTNESS = 100;
const BRIGHTNESS_COMMIT_DELAY_MS = 2000;
const DAY_OPTIONS: Array<{id: DisplayWeekday; label: string}> = [
  {id: 'sun', label: 'S'},
  {id: 'mon', label: 'M'},
  {id: 'tue', label: 'T'},
  {id: 'wed', label: 'W'},
  {id: 'thu', label: 'T'},
  {id: 'fri', label: 'F'},
  {id: 'sat', label: 'S'},
];

type ScheduleDraft = {
  enabled: boolean;
  start: string;
  end: string;
  days: DisplayWeekday[];
};

const formatScheduleSummary = (display: DeviceDisplay) => {
  const hasCustomSchedule =
    !!display.scheduleStart ||
    !!display.scheduleEnd ||
    (Array.isArray(display.scheduleDays) && display.scheduleDays.length > 0);
  return hasCustomSchedule ? toDisplayScheduleText(display) : 'Always on';
};

const getScheduleDraft = (display: DeviceDisplay): ScheduleDraft => {
  const enabled =
    !!display.scheduleStart ||
    !!display.scheduleEnd ||
    (Array.isArray(display.scheduleDays) && display.scheduleDays.length > 0);
  return {
    enabled,
    start: display.scheduleStart ?? '06:00',
    end: display.scheduleEnd ?? '09:00',
    days:
      Array.isArray(display.scheduleDays) && display.scheduleDays.length > 0
        ? display.scheduleDays
        : [...DISPLAY_WEEKDAYS],
  };
};

const formatScheduleDraftSummary = (draft: ScheduleDraft) => {
  if (!draft.enabled) return 'Always on';
  const dayLabel =
    draft.days.length === 0 || draft.days.length === DISPLAY_WEEKDAYS.length
      ? 'Every day'
      : draft.days.map(day => day.toUpperCase()).join(', ');
  return `${dayLabel} ${draft.start}-${draft.end}`;
};

const buildDisplayPayload = (
  display: DeviceDisplay,
  options: {brightness?: number; schedule?: ScheduleDraft},
): DisplaySavePayload => {
  const brightness = options.brightness ?? display.config.brightness ?? 60;
  const schedule = options.schedule ?? getScheduleDraft(display);
  return {
    name: display.name,
    paused: display.paused,
    priority: display.priority,
    sortOrder: display.sortOrder,
    scheduleStart: schedule.enabled ? schedule.start : null,
    scheduleEnd: schedule.enabled ? schedule.end : null,
    scheduleDays: schedule.enabled ? schedule.days : [],
    config: {
      ...display.config,
      brightness,
    },
  };
};

export default function PresetsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const router = useRouter();
  const {state: appState} = useAppState();
  const {deviceId, status, user} = useAuth();
  const selectedCity = appState.selectedCity;
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [brightnessOverrides, setBrightnessOverrides] = useState<Record<string, number>>({});
  const [scheduleOverrides, setScheduleOverrides] = useState<Record<string, ScheduleDraft>>({});
  const brightnessCommitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);


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

  const activateDisplayMutation = useMutation({
    mutationFn: async (display: DeviceDisplay) => {
      if (!deviceId) return;
      const maxPriority = Math.max(0, ...displays.map(d => d.priority));
      await updateDisplay(deviceId, display.displayId, {
        name: display.name,
        paused: display.paused,
        priority: maxPriority + 1,
        sortOrder: display.sortOrder,
        scheduleStart: display.scheduleStart,
        scheduleEnd: display.scheduleEnd,
        scheduleDays: display.scheduleDays,
        config: display.config,
      });
      await apiFetch(`/refresh/device/${deviceId}`, {method: 'POST'});
    },
    onSuccess: () => {
      if (!deviceId) return;
      void queryClient.invalidateQueries({queryKey: queryKeys.displays(deviceId)});
    },
  });

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

  const updateDisplaySettingsMutation = useMutation({
    mutationFn: async ({
      display,
      brightness,
      schedule,
    }: {
      display: DeviceDisplay;
      brightness?: number;
      schedule?: ScheduleDraft;
    }) => {
      if (!deviceId) return;
      const payload = buildDisplayPayload(display, {brightness, schedule});
      await updateDisplay(deviceId, display.displayId, payload);
      if (display.displayId === activeDisplayId) {
        const refreshRes = await apiFetch(`/refresh/device/${deviceId}`, {method: 'POST'});
        if (!refreshRes.ok) {
          console.error('[Displays] Refresh failed:', refreshRes.status);
        }
      }
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

  const visibleDisplays = useMemo(() => {
    const filtered = displays.filter(display => {
      const city = providerToCity(display.config.lines?.[0]?.provider ?? null);
      return city === selectedCity;
    });
    return filtered.sort((a, b) => {
      if (a.displayId === activeDisplayId) return -1;
      if (b.displayId === activeDisplayId) return 1;
      return 0;
    });
  }, [activeDisplayId, displays, selectedCity]);
  const safeIndex = visibleDisplays.length > 0 ? Math.min(carouselIndex, visibleDisplays.length - 1) : 0;
  const currentDisplay = visibleDisplays[safeIndex] ?? null;

  const brand = CITY_BRANDS[selectedCity];
  const currentBrightness = currentDisplay
    ? brightnessOverrides[currentDisplay.displayId] ?? currentDisplay.config.brightness ?? 60
    : 60;
  const currentScheduleDraft = currentDisplay
    ? scheduleOverrides[currentDisplay.displayId] ?? getScheduleDraft(currentDisplay)
    : {enabled: false, start: '06:00', end: '09:00', days: [...DISPLAY_WEEKDAYS]};
  const currentScheduleText = currentDisplay
    ? formatScheduleDraftSummary(currentScheduleDraft)
    : 'Always on';


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

  const commitBrightnessChange = useCallback(
    async (displayId: string, brightness: number) => {
      const latestDisplay = displays.find(display => display.displayId === displayId);
      if (!latestDisplay) return;

      const previousBrightness = latestDisplay.config.brightness ?? 60;
      if (brightness === previousBrightness) {
        return;
      }

      try {
        await updateDisplaySettingsMutation.mutateAsync({display: latestDisplay, brightness});
      } catch (err) {
        setBrightnessOverrides(prev => ({...prev, [displayId]: previousBrightness}));
        Alert.alert('Brightness update failed', err instanceof Error ? err.message : 'Could not update brightness');
      }
    },
    [displays, updateDisplaySettingsMutation],
  );

  const scheduleBrightnessCommit = useCallback(
    (displayId: string, brightness: number) => {
      if (brightnessCommitTimeoutRef.current) {
        clearTimeout(brightnessCommitTimeoutRef.current);
      }
      brightnessCommitTimeoutRef.current = setTimeout(() => {
        brightnessCommitTimeoutRef.current = null;
        void commitBrightnessChange(displayId, brightness);
      }, BRIGHTNESS_COMMIT_DELAY_MS);
    },
    [commitBrightnessChange],
  );

  const handleBrightnessChange = useCallback(
    (display: DeviceDisplay, brightness: number) => {
      setBrightnessOverrides(prev => ({...prev, [display.displayId]: brightness}));
      scheduleBrightnessCommit(display.displayId, brightness);
    },
    [scheduleBrightnessCommit],
  );

  const handleScheduleChange = useCallback((displayId: string, schedule: ScheduleDraft) => {
    setScheduleOverrides(prev => ({...prev, [displayId]: schedule}));
  }, []);

  const handleScheduleCommit = useCallback(
    async (display: DeviceDisplay, schedule: ScheduleDraft) => {
      const previousSchedule = getScheduleDraft(display);
      setScheduleOverrides(prev => ({...prev, [display.displayId]: schedule}));
      try {
        await updateDisplaySettingsMutation.mutateAsync({display, schedule});
      } catch (err) {
        setScheduleOverrides(prev => ({...prev, [display.displayId]: previousSchedule}));
        Alert.alert('Schedule update failed', err instanceof Error ? err.message : 'Could not update schedule');
      }
    },
    [updateDisplaySettingsMutation],
  );

  useEffect(() => {
    return () => {
      if (brightnessCommitTimeoutRef.current) {
        clearTimeout(brightnessCommitTimeoutRef.current);
      }
    };
  }, []);

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>

      {/* ── Brand Header ─────────────────────────────────────────────── */}
      <View style={styles.appHeader}>
        <View style={styles.logoWrap}>
          <Image source={require('../../../assets/images/app-logo.png')} style={styles.appLogo} resizeMode="contain" />
        </View>
        <View style={styles.wordmarkLockup}>
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
            </View>
            <View style={styles.pageHeaderRight}>
              <Pressable
                style={styles.addBtn}
                onPress={() => router.push({pathname: '/preset-editor', params: {city: selectedCity, from: 'presets', mode: 'new'}})}>
                <Ionicons name="add" size={18} color={colors.accent} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Loading / Error ───────────────────────────────────────────── */}
        {loading ? <Text style={styles.hintText}>Loading displays…</Text> : null}
        {!loading && errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        {/* ── Display Card ──────────────────────────────────────────────── */}
        {!loading && !errorText ? (
          currentDisplay ? (
            <>
              <View style={styles.displayCard}>

                {/* LED preview — no header, name lives in nav row */}
                <View style={styles.cardPreview}>
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
                    brightness={currentBrightness}
                  />
                </View>

                {/* Edit | ‹ Name › | Delete */}
                <View style={styles.navActionsRow}>
                  {/* Left anchor: Edit */}
                  <Pressable
                    style={styles.editBtn}
                    onPress={() =>
                      router.push({
                        pathname: '/preset-editor',
                        params: {city: selectedCity, from: 'presets', mode: 'edit', displayId: currentDisplay.displayId},
                      })
                    }>
                    <Ionicons name="pencil-outline" size={14} color={colors.text} />
                  </Pressable>

                  {/* Center: ‹ Name › */}
                  <View style={styles.navCenter}>
                    {visibleDisplays.length > 1 ? (
                      <Pressable
                        style={[styles.arrowBtn, safeIndex === 0 && styles.arrowBtnDisabled]}
                        onPress={() => goTo(safeIndex - 1)}
                        disabled={safeIndex === 0}>
                        <Ionicons name="chevron-back" size={15} color={colors.textMuted} />
                      </Pressable>
                    ) : null}
                    <Text style={styles.navDisplayName} numberOfLines={1}>{currentDisplay.name}</Text>
                    {visibleDisplays.length > 1 ? (
                      <Pressable
                        style={[styles.arrowBtn, safeIndex === visibleDisplays.length - 1 && styles.arrowBtnDisabled]}
                        onPress={() => goTo(safeIndex + 1)}
                        disabled={safeIndex === visibleDisplays.length - 1}>
                        <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
                      </Pressable>
                    ) : null}
                  </View>

                  {/* Right anchor: Delete */}
                  <Pressable style={styles.deleteBtn} onPress={() => confirmDelete(currentDisplay)}>
                    <Ionicons name="trash-outline" size={14} color="#F87171" />
                  </Pressable>
                </View>

                {/* Settings: brightness + schedule */}
                <View style={styles.cardSettings}>

                  <View style={styles.settingItem}>
                    <View style={styles.settingItemRow}>
                      <Text style={styles.settingItemLabel}>Brightness</Text>
                      <Text style={styles.settingItemValue}>{currentBrightness}%</Text>
                    </View>
                    <BrightnessSlider
                      value={currentBrightness}
                      min={MIN_BRIGHTNESS}
                      max={MAX_BRIGHTNESS}
                      onChange={value => handleBrightnessChange(currentDisplay, value)}
                      onCommit={() => {}}
                    />
                  </View>

                  <View style={[styles.settingItem, styles.settingItemBorder]}>
                    {/* Schedule header: label + toggle */}
                    <View style={styles.scheduleMainRow}>
                      <Text style={styles.settingItemLabel}>Schedule</Text>
                      <Pressable
                        style={styles.scheduleToggleWrap}
                        onPress={() => {
                          const nextSchedule = {
                            ...currentScheduleDraft,
                            enabled: !currentScheduleDraft.enabled,
                          };
                          handleScheduleChange(currentDisplay.displayId, nextSchedule);
                          void handleScheduleCommit(currentDisplay, nextSchedule);
                        }}>
                        <View style={[styles.scheduleToggle, currentScheduleDraft.enabled && styles.scheduleToggleOn]}>
                          <View style={[styles.scheduleToggleThumb, currentScheduleDraft.enabled && styles.scheduleToggleThumbOn]} />
                        </View>
                      </Pressable>
                    </View>
                    {/* Day circles */}
                    <View style={[styles.daysRow, !currentScheduleDraft.enabled && styles.daysRowDisabled]}>
                      {DAY_OPTIONS.map(day => {
                        const active = currentScheduleDraft.enabled && currentScheduleDraft.days.includes(day.id);
                        return (
                          <Pressable
                            key={day.id}
                            style={[styles.dayPill, active && styles.dayPillActive]}
                            disabled={!currentScheduleDraft.enabled}
                            onPress={() => {
                              const nextDays = active
                                ? currentScheduleDraft.days.filter(item => item !== day.id)
                                : [...currentScheduleDraft.days, day.id];
                              const nextSchedule = {...currentScheduleDraft, days: nextDays};
                              handleScheduleChange(currentDisplay.displayId, nextSchedule);
                              void handleScheduleCommit(currentDisplay, nextSchedule);
                            }}>
                            <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>{day.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {currentScheduleDraft.enabled ? (
                      <>
                        <View style={styles.timeRangeRow}>
                          <QuickTimeField
                            label="Start"
                            value={currentScheduleDraft.start}
                            onPrev={() => {
                              const nextSchedule = {
                                ...currentScheduleDraft,
                                start: cycleTimeOption(currentScheduleDraft.start, -1),
                              };
                              handleScheduleChange(currentDisplay.displayId, nextSchedule);
                              void handleScheduleCommit(currentDisplay, nextSchedule);
                            }}
                            onNext={() => {
                              const nextSchedule = {
                                ...currentScheduleDraft,
                                start: cycleTimeOption(currentScheduleDraft.start, 1),
                              };
                              handleScheduleChange(currentDisplay.displayId, nextSchedule);
                              void handleScheduleCommit(currentDisplay, nextSchedule);
                            }}
                          />
                          <QuickTimeField
                            label="End"
                            value={currentScheduleDraft.end}
                            onPrev={() => {
                              const nextSchedule = {
                                ...currentScheduleDraft,
                                end: cycleTimeOption(currentScheduleDraft.end, -1),
                              };
                              handleScheduleChange(currentDisplay.displayId, nextSchedule);
                              void handleScheduleCommit(currentDisplay, nextSchedule);
                            }}
                            onNext={() => {
                              const nextSchedule = {
                                ...currentScheduleDraft,
                                end: cycleTimeOption(currentScheduleDraft.end, 1),
                              };
                              handleScheduleChange(currentDisplay.displayId, nextSchedule);
                              void handleScheduleCommit(currentDisplay, nextSchedule);
                            }}
                          />
                        </View>
                      </>
                    ) : null}
                  </View>

                  {/* Set Active */}
                  <View style={[styles.settingItem, styles.settingItemBorder]}>
                    {currentDisplay.displayId === activeDisplayId ? (
                      <View style={styles.activeStatusRow}>
                        <View style={styles.activeDot} />
                        <Text style={styles.activeStatusText}>Currently active</Text>
                      </View>
                    ) : (
                      <Pressable
                        style={[styles.setActiveBtn, activateDisplayMutation.isPending && styles.setActiveBtnDisabled]}
                        disabled={activateDisplayMutation.isPending}
                        onPress={() => activateDisplayMutation.mutate(currentDisplay)}>
                        <Text style={styles.setActiveBtnText}>
                          {activateDisplayMutation.isPending ? 'Activating…' : 'Set as Active'}
                        </Text>
                      </Pressable>
                    )}
                  </View>

                </View>
              </View>

            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No displays yet</Text>
              <Text style={styles.emptyBody}>Tap + to create your first display.</Text>
            </View>
          )
        ) : null}

      </ScrollView>

      <BottomNav items={NAV_ITEMS} />
    </View>
  );
}

function QuickTimeField({
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
        <Pressable style={styles.timeAdjustButton} onPress={onPrev}>
          <Text style={styles.timeAdjustButtonText}>-</Text>
        </Pressable>
        <Text style={styles.timeFieldValue}>{value}</Text>
        <Pressable style={styles.timeAdjustButton} onPress={onNext}>
          <Text style={styles.timeAdjustButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BrightnessSlider({
  value,
  min,
  max,
  onChange,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const trackWidthRef = useRef(0);
  const [trackWidth, setTrackWidth] = useState(0);

  const valueFromLocation = useCallback(
    (locationX: number) => {
      const trackWidth = trackWidthRef.current;
      if (trackWidth <= 0) return value;
      const ratio = Math.max(0, Math.min(1, locationX / trackWidth));
      const raw = min + ratio * (max - min);
      return Math.max(min, Math.min(max, Math.round(raw)));
    },
    [max, min, value],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: event => {
          onChange(valueFromLocation(event.nativeEvent.locationX));
        },
        onPanResponderMove: event => {
          onChange(valueFromLocation(event.nativeEvent.locationX));
        },
        onPanResponderRelease: event => {
          onCommit(valueFromLocation(event.nativeEvent.locationX));
        },
      }),
    [onChange, onCommit, valueFromLocation],
  );

  const ratio = (value - min) / (max - min);
  const fillWidth = Math.max(0, Math.min(trackWidth, ratio * trackWidth));
  const thumbLeft = trackWidth > 0 ? Math.max(0, Math.min(trackWidth - 16, ratio * trackWidth - 8)) : 0;

  return (
    <View
      style={styles.sliderTrack}
      onLayout={event => {
        trackWidthRef.current = event.nativeEvent.layout.width;
        setTrackWidth(event.nativeEvent.layout.width);
      }}
      {...panResponder.panHandlers}>
      <View style={[styles.sliderFill, {width: fillWidth}]} />
      <View style={[styles.sliderThumb, {left: thumbLeft}]} />
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
    gap: spacing.md,
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
  logoWrap: {
    position: 'absolute',
    left: spacing.lg,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appLogo: {
    width: 26,
    height: 26,
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
    paddingTop: 0,
    paddingBottom: spacing.xs,
  },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageHeaderLeft: {flex: 1},
  pageHeaderRight: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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

  // ─── Loading / Error / Empty ───────────────────────────────────────────────
  hintText: {color: colors.textMuted, fontSize: 13},
  errorText: {color: colors.warning, fontSize: 13},
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyTitle: {color: colors.text, fontSize: 16, fontWeight: '800'},
  emptyBody: {color: colors.textMuted, fontSize: 13, lineHeight: 18, textAlign: 'center'},

  // ─── Display Card ─────────────────────────────────────────────────────────
  displayCard: {},

  // Card header: name + badges
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  cardDisplayName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
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
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeActive: {backgroundColor: '#0A2218', borderColor: '#1B5E4A'},
  badgePaused: {backgroundColor: colors.card, borderColor: colors.border},
  badgeDot: {width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399'},
  badgeText: {color: colors.text, fontSize: 11, fontWeight: '700'},

  // LED preview area — extra padding lets the glow breathe
  cardPreview: {
    paddingBottom: spacing.sm,
  },

  // Nav + actions row (edit | ‹ name › | delete)
  navActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  navCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navDisplayName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
    paddingHorizontal: 4,
  },
  arrowBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtnDisabled: {opacity: 0.25},
  dotRow: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5},
  dot: {width: 5, height: 5, borderRadius: 3, backgroundColor: colors.border},
  dotActive: {width: 14, height: 5, borderRadius: 3, backgroundColor: colors.accent},

  cardSettings: {},
  settingItem: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  settingItemBorder: {},
  settingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  settingItemLabelGroup: {gap: 2},
  settingItemLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  settingItemValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  settingItemSub: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },

  // ─── Brightness Slider ────────────────────────────────────────────────────
  sliderTrack: {
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sliderFill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 6,
    backgroundColor: colors.accentMuted,
  },
  sliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.background,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: {width: 0, height: 1},
  },

  // ─── Schedule Editor ──────────────────────────────────────────────────────
  scheduleEditorCard: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  scheduleToggleWrap: {padding: 4},
  scheduleToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  scheduleToggleLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  scheduleToggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  scheduleToggleOn: {borderColor: colors.accent, backgroundColor: colors.accentMuted},
  scheduleToggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.textMuted,
  },
  scheduleToggleThumbOn: {alignSelf: 'flex-end', backgroundColor: colors.accent},
  scheduleAlwaysOnCard: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.sm,
    gap: 2,
  },
  scheduleAlwaysOnTitle: {color: colors.text, fontSize: 13, fontWeight: '800'},
  scheduleAlwaysOnBody: {color: colors.textMuted, fontSize: 12},

  // ─── Schedule Rows ────────────────────────────────────────────────────────
  scheduleMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // ─── Days ─────────────────────────────────────────────────────────────────
  daysRow: {flexDirection: 'row', gap: 6},
  daysRowDisabled: {opacity: 0.35},
  dayPill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillActive: {borderColor: colors.accent, backgroundColor: colors.accentMuted},
  dayPillText: {color: colors.textMuted, fontSize: 9, fontWeight: '700'},
  dayPillTextActive: {color: colors.accent},

  // ─── Time Range ───────────────────────────────────────────────────────────
  timeRangeRow: {flexDirection: 'row', gap: spacing.sm},
  timeField: {
    flex: 1,
    gap: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.sm,
  },
  timeFieldLabel: {color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5},
  timeFieldControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  timeAdjustButton: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeAdjustButtonText: {color: colors.text, fontSize: 16, fontWeight: '700'},
  timeFieldValue: {color: colors.text, fontSize: 14, fontWeight: '800'},

  editBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: {color: colors.text, fontSize: 12, fontWeight: '700'},
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#2A1212',
    backgroundColor: '#160A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Set Active ───────────────────────────────────────────────────────────
  setActiveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setActiveBtnDisabled: {opacity: 0.5},
  setActiveBtnText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '800',
  },
  activeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#34D399',
  },
  activeStatusText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
