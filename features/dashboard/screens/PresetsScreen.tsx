import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import {useRouter} from 'expo-router';
import {useFocusEffect} from 'expo-router';
import {useLocalSearchParams} from 'expo-router';
import {useMutation, useQueries, useQuery, useQueryClient} from '@tanstack/react-query';
import {colors, layout, radii, spacing, typography} from '../../../theme';
import {apiFetch} from '../../../lib/api';
import {AppBrandHeader} from '../../../components/AppBrandHeader';
import DraggableFlatList, {type RenderItemParams} from 'react-native-draggable-flatlist';
import {TabScreen} from '../../../components/TabScreen';
import DashboardPreviewSection from '../components/DashboardPreviewSection';
import {CITY_BRANDS, CITY_LABELS} from '../../../constants/cities';
import {useAppState} from '../../../state/appState';
import {useAuth} from '../../../state/authProvider';
import {
  deleteDisplay,
  DISPLAY_WEEKDAYS,
  fetchDisplays,
  getLiveArrivalLookup,
  providerToCity,
  toPreviewSlots,
  toDisplayScheduleText,
  updateDisplay,
  type DisplayWeekday,
  type DisplaySavePayload,
  type DeviceDisplay,
} from '../../../lib/displays';
import {CITY_LINE_COLORS, hashLineColor} from '../../../lib/lineColors';
import {getTransitStationName} from '../../../lib/transitApi';
import {queryKeys} from '../../../lib/queryKeys';
import {cycleTimeOption} from './DashboardOverview.time';

const stopNameCache: Record<string, string> = {};
const MIN_BRIGHTNESS = 10;
const MAX_BRIGHTNESS = 100;
const BRIGHTNESS_COMMIT_DELAY_MS = 2000;
const REORDER_ROW_HEIGHT = 76;
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

const getDisplayLineLabels = (display: DeviceDisplay) =>
  Array.from(
    new Set(
      (display.config.lines ?? [])
        .map(line => (typeof line.line === 'string' ? line.line.trim().toUpperCase() : ''))
        .filter(Boolean),
    ),
  ).slice(0, 3);

const getDisplayProviders = (display: DeviceDisplay) =>
  Array.from(
    new Set(
      (display.config.lines ?? [])
        .map(line => (typeof line.provider === 'string' ? line.provider.trim() : ''))
        .filter(Boolean),
    ),
  );

const getReorderLineBadgeColors = (display: DeviceDisplay, label: string) => {
  const matchedLine = (display.config.lines ?? []).find(
    l => typeof l.line === 'string' && l.line.trim().toUpperCase() === label,
  );
  const provider = matchedLine?.provider ?? display.config.lines?.[0]?.provider ?? null;
  const city = providerToCity(provider);
  const lineColors = city ? (CITY_LINE_COLORS[city] ?? {}) : {};
  return lineColors[label] ?? hashLineColor(label);
};

const isReorderLineBus = (display: DeviceDisplay, label: string) => {
  const matchedLine = (display.config.lines ?? []).find(
    l => typeof l.line === 'string' && l.line.trim().toUpperCase() === label,
  );
  const provider = matchedLine?.provider ?? display.config.lines?.[0]?.provider ?? '';
  return provider === 'mta-bus';
};

const sortDisplaysForCarousel = (items: DeviceDisplay[], activeDisplayId: string | null) =>
  [...items].sort((a, b) => {
    if (a.displayId === activeDisplayId) return -1;
    if (b.displayId === activeDisplayId) return 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });

export default function PresetsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useLocalSearchParams<{focusDisplayId?: string}>();
  const {state: appState} = useAppState();
  const {deviceId, status, user} = useAuth();
  const selectedCity = appState.selectedCity;
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [brightnessOverrides, setBrightnessOverrides] = useState<Record<string, number>>({});
  const [scheduleOverrides, setScheduleOverrides] = useState<Record<string, ScheduleDraft>>({});
  const [isScreenFocused, setIsScreenFocused] = useState(false);
  const [reorderVisible, setReorderVisible] = useState(false);
  const [pendingFocusDisplayId, setPendingFocusDisplayId] = useState<string | null>(
    typeof params.focusDisplayId === 'string' ? params.focusDisplayId : null,
  );
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

  const lastCommandQuery = useQuery({
    queryKey: queryKeys.lastCommand(deviceId || 'none'),
    queryFn: async () => {
      if (!deviceId) return null;
      const response = await apiFetch(`/device/${deviceId}/last-command`);
      const data = await response.json().catch(() => null);
      if (!response.ok) return null;
      const event = data?.event;
      if (!event) return null;
      return event.payload ?? null;
    },
    enabled: isScreenFocused && !!deviceId && status === 'authenticated',
    refetchInterval: 5000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const liveArrivalLookup = useMemo(
    () => getLiveArrivalLookup(lastCommandQuery.data ?? null),
    [lastCommandQuery.data],
  );

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
    onSuccess: (_data, display) => {
      if (!deviceId) return;
      queryClient.setQueryData(
        queryKeys.displays(deviceId),
        (current: {displays: DeviceDisplay[]; activeDisplayId: string | null} | undefined) =>
          current
            ? {
                ...current,
                activeDisplayId: display.displayId,
              }
            : current,
      );
      setCarouselIndex(0);
      void queryClient.invalidateQueries({queryKey: queryKeys.displays(deviceId)});
      void queryClient.invalidateQueries({queryKey: queryKeys.lastCommand(deviceId)});
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

  const reorderDisplaysMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (!deviceId) return orderedIds;
      const displayMap = new Map(displays.map(display => [display.displayId, display]));
      const nextActiveDisplayId = orderedIds[0] ?? null;
      const maxPriority = Math.max(0, ...displays.map(display => display.priority));
      const updates = orderedIds
        .map((displayId, index) => {
          const display = displayMap.get(displayId);
          if (!display) return null;
          const nextPriority =
            displayId === nextActiveDisplayId && display.priority !== maxPriority + 1
              ? maxPriority + 1
              : display.priority;
          if (display.sortOrder === index && display.priority === nextPriority) return null;
          return updateDisplay(deviceId, displayId, {
            ...buildDisplayPayload(display, {}),
            sortOrder: index,
            priority: nextPriority,
          });
        })
        .filter((update): update is Promise<unknown> => update !== null);

      if (updates.length > 0) {
        await Promise.all(updates);
      }

      if (nextActiveDisplayId) {
        await apiFetch(`/refresh/device/${deviceId}`, {method: 'POST'});
      }

      return orderedIds;
    },
    onSuccess: orderedIds => {
      if (!deviceId) return;
      const orderLookup = Object.fromEntries(orderedIds.map((displayId, index) => [displayId, index]));
      const nextActiveDisplayId = orderedIds[0] ?? null;
      queryClient.setQueryData(
        queryKeys.displays(deviceId),
        (current: {displays: DeviceDisplay[]; activeDisplayId: string | null} | undefined) =>
          current
            ? {
                ...current,
                activeDisplayId: nextActiveDisplayId,
                displays: current.displays.map(display =>
                  typeof orderLookup[display.displayId] === 'number'
                    ? {...display, sortOrder: orderLookup[display.displayId]}
                    : display,
                ),
              }
            : current,
      );
      setCarouselIndex(0);
      void queryClient.invalidateQueries({queryKey: queryKeys.displays(deviceId)});
      void queryClient.invalidateQueries({queryKey: queryKeys.lastCommand(deviceId)});
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
      setIsScreenFocused(true);
      return () => setIsScreenFocused(false);
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (!deviceId || status !== 'authenticated') return;
      void queryClient.invalidateQueries({queryKey: queryKeys.displays(deviceId)});
      void queryClient.invalidateQueries({queryKey: queryKeys.lastCommand(deviceId)});
    }, [deviceId, queryClient, status]),
  );

  const visibleDisplays = useMemo(
    () => sortDisplaysForCarousel(displays, activeDisplayId),
    [activeDisplayId, displays],
  );
  const safeIndex = visibleDisplays.length > 0 ? Math.min(carouselIndex, visibleDisplays.length - 1) : 0;
  const currentDisplay = visibleDisplays[safeIndex] ?? null;
  const currentDisplayCity = providerToCity(currentDisplay?.config.lines?.[0]?.provider ?? null) ?? selectedCity;
  const brand = CITY_BRANDS[currentDisplayCity];
  const currentBrightness = currentDisplay
    ? brightnessOverrides[currentDisplay.displayId] ?? currentDisplay.config.brightness ?? 60
    : 60;
  const currentScheduleDraft = currentDisplay
    ? scheduleOverrides[currentDisplay.displayId] ?? getScheduleDraft(currentDisplay)
    : {enabled: false, start: '06:00', end: '09:00', days: [...DISPLAY_WEEKDAYS]};
  const currentScheduleText = currentDisplay
    ? formatScheduleDraftSummary(currentScheduleDraft)
    : 'Always on';

  useEffect(() => {
    if (typeof params.focusDisplayId === 'string' && params.focusDisplayId.length > 0) {
      setPendingFocusDisplayId(params.focusDisplayId);
    }
  }, [params.focusDisplayId]);

  useEffect(() => {
    if (!pendingFocusDisplayId || visibleDisplays.length === 0) return;
    const targetIndex = visibleDisplays.findIndex(display => display.displayId === pendingFocusDisplayId);
    if (targetIndex === -1) return;
    setCarouselIndex(targetIndex);
    setPendingFocusDisplayId(null);
  }, [pendingFocusDisplayId, visibleDisplays]);


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

  const handleSaveReorder = useCallback(
    async (orderedIds: string[]) => {
      try {
        await reorderDisplaysMutation.mutateAsync(orderedIds);
        setCarouselIndex(0);
      } catch (err) {
        Alert.alert('Reorder failed', err instanceof Error ? err.message : 'Could not save display order');
      }
    },
    [reorderDisplaysMutation],
  );

  useEffect(() => {
    return () => {
      if (brightnessCommitTimeoutRef.current) {
        clearTimeout(brightnessCommitTimeoutRef.current);
      }
    };
  }, []);

  return (
    <TabScreen style={[styles.container, {paddingTop: insets.top}]}>
      <AppBrandHeader email={user?.email} />

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
                onPress={() => setReorderVisible(true)}
                disabled={visibleDisplays.length < 2}>
                <Ionicons
                  name="reorder-three-outline"
                  size={18}
                  color={visibleDisplays.length < 2 ? colors.textMuted : colors.text}
                />
              </Pressable>
              <Pressable
                style={styles.addBtn}
                onPress={() => router.push({pathname: '/preset-editor', params: {city: currentDisplayCity, from: 'presets', mode: 'new'}})}>
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
                <View style={styles.cardPreviewContainer}>
                  <DashboardPreviewSection
                    slots={toPreviewSlots(
                      currentDisplay,
                      brand.accent,
                      stopNames,
                      currentDisplay.displayId === activeDisplayId ? liveArrivalLookup : null,
                      {
                      showDirectionFallback: false,
                      },
                    )}
                    displayType={currentDisplay.config.displayType ?? Number(currentDisplay.config.lines?.[0]?.displayType) ?? 1}
                    onSelectSlot={() =>
                      router.push({
                        pathname: '/preset-editor',
                        params: {city: currentDisplayCity, from: 'presets', mode: 'edit', displayId: currentDisplay.displayId},
                      })
                    }
                    onReorderSlot={() => {}}
                    onDragStateChange={() => {}}
                    showHint={false}
                    brightness={currentBrightness}
                  />
                </View>

                {/* [Edit + Active] | ‹ Name › | [Delete] */}
                <View style={styles.navActionsRow}>
                  {/* Left: Edit + Active badge */}
                  <View style={styles.navLeft}>
                    <Pressable
                      style={styles.editBtn}
                      onPress={() =>
                        router.push({
                          pathname: '/preset-editor',
                          params: {city: currentDisplayCity, from: 'presets', mode: 'edit', displayId: currentDisplay.displayId},
                        })
                      }>
                      <Ionicons name="pencil-outline" size={14} color={colors.text} />
                    </Pressable>
                    {currentDisplay.displayId === activeDisplayId ? (
                      <View style={styles.navActiveLabel}>
                        <View style={styles.navActiveDot} />
                        <Text style={styles.navActiveLabelText}>Active</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Center: ‹ Name › — truly centered */}
                  <View style={styles.navCenter}>
                    {visibleDisplays.length > 1 ? (
                      <Pressable
                        style={[styles.arrowBtn, safeIndex === 0 && styles.arrowBtnDisabled]}
                        onPress={() => goTo(safeIndex - 1)}
                        disabled={safeIndex === 0}>
                        <Ionicons name="chevron-back" size={15} color={colors.textMuted} />
                      </Pressable>
                    ) : null}
                    <View style={styles.navTitleBlock}>
                      <Text style={styles.navDisplayName} numberOfLines={1}>{currentDisplay.name}</Text>
                      <Text style={styles.navDisplayCity}>{CITY_LABELS[currentDisplayCity]}</Text>
                    </View>
                    {visibleDisplays.length > 1 ? (
                      <Pressable
                        style={[styles.arrowBtn, safeIndex === visibleDisplays.length - 1 && styles.arrowBtnDisabled]}
                        onPress={() => goTo(safeIndex + 1)}
                        disabled={safeIndex === visibleDisplays.length - 1}>
                        <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
                      </Pressable>
                    ) : null}
                  </View>

                  {/* Right: Delete */}
                  <View style={styles.navRight}>
                    <Pressable style={styles.deleteBtn} onPress={() => confirmDelete(currentDisplay)}>
                      <Ionicons name="trash-outline" size={14} color="#F87171" />
                    </Pressable>
                  </View>
                </View>

                {/* Settings: brightness + schedule */}
                <View style={styles.cardSettings}>

                  <View style={styles.settingItem}>
                    <View style={styles.settingItemRow}>
                      <Text style={styles.settingItemLabel}>Brightness</Text>
                      <View style={styles.brightnessValueBadge}>
                        <Text style={styles.brightnessValueText}>{currentBrightness}%</Text>
                      </View>
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
                    {/* Day circles — only shown when schedule is enabled */}
                    {currentScheduleDraft.enabled ? <View style={styles.daysRow}>
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
                    </View> : null}

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
                  {currentDisplay.displayId !== activeDisplayId ? (
                    <View style={[styles.settingItem, styles.settingItemBorder]}>
                      <Pressable
                        style={[styles.setActiveBtn, activateDisplayMutation.isPending && styles.setActiveBtnDisabled]}
                        disabled={activateDisplayMutation.isPending}
                        onPress={() => activateDisplayMutation.mutate(currentDisplay)}>
                        <Text style={styles.setActiveBtnText}>
                          {activateDisplayMutation.isPending ? 'Activating…' : 'Set as Active'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

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

      <ReorderDisplaysModal
        visible={reorderVisible}
        displays={visibleDisplays}
        saving={reorderDisplaysMutation.isPending}
        onClose={() => {
          if (reorderDisplaysMutation.isPending) return;
          setCarouselIndex(0);
          setReorderVisible(false);
        }}
        onSave={handleSaveReorder}
      />
    </TabScreen>
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
  const adjust = (delta: number) => {
    const nextValue = Math.max(min, Math.min(max, value + delta));
    onChange(nextValue);
  };

  return (
    <View style={styles.brightnessControl}>
      <View style={styles.brightnessControlRow}>
        <Pressable style={styles.brightnessAdjustButton} onPress={() => adjust(-5)}>
          <Ionicons name="remove" size={16} color={colors.text} />
        </Pressable>
        <View style={styles.brightnessSliderWrap}>
          <View style={styles.sliderTrack}>
            <Slider
              style={styles.sliderNative}
              minimumValue={min}
              maximumValue={max}
              step={1}
              value={value}
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.accent}
              onValueChange={onChange}
              onSlidingComplete={onCommit}
            />
          </View>
        </View>
        <Pressable style={styles.brightnessAdjustButton} onPress={() => adjust(5)}>
          <Ionicons name="add" size={16} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.brightnessScaleRow}>
        <Text style={styles.brightnessScaleText}>Dim</Text>
        <Text style={styles.brightnessScaleText}>Bright</Text>
      </View>
    </View>
  );
}

function ReorderDisplaysModal({
  visible,
  displays,
  saving,
  onClose,
  onSave,
}: {
  visible: boolean;
  displays: DeviceDisplay[];
  saving: boolean;
  onClose: () => void;
  onSave: (orderedIds: string[]) => void;
}) {
  const [draftDisplays, setDraftDisplays] = useState<DeviceDisplay[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const listHeight = Math.min(draftDisplays.length * REORDER_ROW_HEIGHT, 420);

  useEffect(() => {
    if (!visible) return;
    setDraftDisplays(displays);
    setActiveId(null);
  }, [visible, displays]);
  const initialIds = useMemo(() => displays.map(display => display.displayId), [displays]);

  const handleDragEnd = useCallback(
    ({data}: {data: DeviceDisplay[]}) => {
      setActiveId(null);
      setDraftDisplays(data);
      const orderedIds = data.map(display => display.displayId);
      const changed =
        orderedIds.length === initialIds.length &&
        orderedIds.some((displayId, index) => displayId !== initialIds[index]);
      if (changed && !saving) {
        onSave(orderedIds);
      }
    },
    [initialIds, onSave, saving],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.reorderGestureRoot}>
        <View style={styles.reorderBackdrop}>
          <View style={styles.reorderModal}>
            <View style={styles.reorderHeader}>
              <View style={styles.reorderHeaderCopy}>
                <Text style={styles.reorderTitle}>Reorder</Text>
                <Text style={styles.reorderBody}>
                  Drag to reorder. First becomes active.
                </Text>
              </View>
              <Pressable style={styles.reorderCloseBtn} onPress={onClose} disabled={saving}>
                <Ionicons name="close" size={16} color={colors.text} />
              </Pressable>
            </View>

            <DraggableFlatList
              data={draftDisplays}
              keyExtractor={item => item.displayId}
              activationDistance={0}
              autoscrollSpeed={240}
              dragItemOverflow={false}
              scrollEnabled={draftDisplays.length * REORDER_ROW_HEIGHT > listHeight}
              style={[styles.reorderList, {maxHeight: listHeight}]}
              contentContainerStyle={styles.reorderListContent}
              onDragBegin={index => setActiveId(draftDisplays[index]?.displayId ?? null)}
              onRelease={() => setActiveId(null)}
              onDragEnd={handleDragEnd}
              renderItem={({item, drag, isActive, getIndex}: RenderItemParams<DeviceDisplay>) => (
                <ReorderListRow
                  display={item}
                  index={getIndex() ?? 0}
                  isDragging={isActive || activeId === item.displayId}
                  saving={saving}
                  onDragStart={drag}
                />
              )}
            />

          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function ReorderListRow({
  display,
  isDragging,
  index,
  saving,
  onDragStart,
}: {
  display: DeviceDisplay;
  isDragging: boolean;
  index: number;
  saving: boolean;
  onDragStart: () => void;
}) {
  const lineLabels = getDisplayLineLabels(display);
  const providers = getDisplayProviders(display);
  const isActive = index === 0;

  return (
    <Pressable
      disabled={saving}
      delayLongPress={120}
      onLongPress={onDragStart}
      style={[styles.reorderRow, isDragging && styles.reorderRowDragging]}>
      <View style={styles.reorderRowMain}>
        <View style={styles.reorderBadgeRow}>
          {lineLabels.length > 0 ? (
            lineLabels.map(label => {
              const badgeColors = getReorderLineBadgeColors(display, label);
              const isBus = isReorderLineBus(display, label);
              return (
                <View
                  key={`${display.displayId}-${label}`}
                  style={[
                    styles.reorderLineBadge,
                    isBus && styles.reorderLineBadgeBusPill,
                    {
                      backgroundColor: badgeColors.color,
                      borderColor: badgeColors.color,
                    },
                  ]}>
                  <Text style={[styles.reorderLineBadgeText, isBus && styles.reorderLineBadgeBusText, {color: badgeColors.textColor}]}>{label}</Text>
                </View>
              );
            })
          ) : (
            <View style={styles.reorderLineBadgeMuted}>
              <Text style={styles.reorderLineBadgeMutedText}>--</Text>
            </View>
          )}
        </View>

        <View style={styles.reorderTextBlock}>
          <Text style={styles.reorderDisplayName} numberOfLines={1}>
            {display.name}
          </Text>
          <Text style={styles.reorderDisplayMeta} numberOfLines={1}>
            {providers.length > 0 ? providers.join(', ') : 'No provider selected'}
          </Text>
        </View>

        {isActive ? (
          <View style={styles.reorderActivePill}>
            <Text style={styles.reorderActivePillText}>Active</Text>
          </View>
        ) : (
          <View style={styles.reorderHandle}>
            <Ionicons name="reorder-three-outline" size={18} color={colors.textMuted} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // ─── Layout ───────────────────────────────────────────────────────────────
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.screenPadding,
    paddingBottom: layout.bottomInset,
    gap: layout.screenGap,
  },

  // ─── Page Header ──────────────────────────────────────────────────────────
  pageHeader: {
    paddingTop: 0,
    paddingBottom: spacing.sm,
  },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pageHeaderLeft: {flex: 1},
  pageHeaderRight: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  addBtn: {
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    color: colors.text,
    fontSize: typography.pageTitle,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 33,
  },

  // ─── Loading / Error / Empty ───────────────────────────────────────────────
  hintText: {color: colors.textMuted, fontSize: 13},
  errorText: {color: colors.warning, fontSize: 13},
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {color: colors.text, fontSize: 16, fontWeight: '800'},
  emptyBody: {color: colors.textMuted, fontSize: 13, lineHeight: 18, textAlign: 'center'},

  // ─── Display Card ─────────────────────────────────────────────────────────
  displayCard: {},
  displayCardActive: {
    borderWidth: 1,
    borderColor: '#34D399',
    borderRadius: radii.lg,
  },

  // Card header: name + badges
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
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
    gap: spacing.xxs,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  badgeActive: {backgroundColor: '#0A2218', borderColor: '#1B5E4A'},
  badgePaused: {backgroundColor: colors.card, borderColor: colors.border},
  badgeDot: {width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399'},
  badgeText: {color: colors.text, fontSize: 11, fontWeight: '700'},

  // LED preview area — extra padding lets the glow breathe
  cardPreviewContainer: {
    paddingBottom: spacing.md,
    position: 'relative',
  },
  activeOverlayBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#34D399',
  },
  activeOverlayText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },

  // Nav + actions row (edit | ‹ name › | delete)
  navActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  navLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  navRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  navActiveLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    borderWidth: 1,
    borderColor: '#34D399',
    borderRadius: radii.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  navActiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#34D399',
  },
  navActiveLabelText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
  },
  navCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitleBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    flexShrink: 1,
  },
  navDisplayName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
    paddingHorizontal: 4,
  },
  navDisplayCity: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  arrowBtn: {
    width: layout.iconButton,
    height: layout.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtnDisabled: {opacity: 0.25},
  dotRow: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xxs},
  dot: {width: 5, height: 5, borderRadius: 3, backgroundColor: colors.border},
  dotActive: {width: 14, height: 5, borderRadius: 3, backgroundColor: colors.accent},

  cardSettings: {
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  settingItem: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  settingItemBorder: {},
  settingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  settingItemLabelGroup: {gap: spacing.xxs},
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
  brightnessValueBadge: {
    minWidth: 52,
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brightnessValueText: {
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
  brightnessControl: {
    gap: spacing.xxs,
  },
  brightnessControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brightnessAdjustButton: {
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brightnessSliderWrap: {
    flex: 1,
    gap: spacing.xxs,
  },
  sliderTrack: {
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxs,
  },
  sliderNative: {
    width: '100%',
    height: 36,
  },
  brightnessScaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: layout.iconButton + spacing.sm,
    paddingRight: layout.iconButton + spacing.sm,
  },
  brightnessScaleText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
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
    gap: spacing.xxs,
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
  daysRow: {flexDirection: 'row', gap: spacing.xs},
  daysRowDisabled: {opacity: 0.35},
  dayPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
    width: layout.chromeSize,
    height: layout.chromeSize,
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
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: {color: colors.text, fontSize: 12, fontWeight: '700'},
  deleteBtn: {
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#2A1212',
    backgroundColor: '#160A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Reorder Modal ───────────────────────────────────────────────────────
  reorderBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    justifyContent: 'center',
    paddingHorizontal: layout.screenPadding,
  },
  reorderGestureRoot: {
    flex: 1,
  },
  reorderModal: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: layout.cardPaddingLg,
    gap: spacing.md,
  },
  reorderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  reorderHeaderCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  reorderTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  reorderBody: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  reorderCloseBtn: {
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderList: {
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  reorderListContent: {
    gap: spacing.sm,
  },
  reorderRow: {
    height: REORDER_ROW_HEIGHT - 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  reorderRowDragging: {
    borderColor: colors.accent,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
    elevation: 4,
    zIndex: 10,
  },
  reorderRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  reorderBadgeRow: {
    width: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  reorderLineBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reorderLineBadgeBusPill: {
    height: 22,
    borderRadius: 7,
    minWidth: 38,
    paddingHorizontal: spacing.xxs,
  },
  reorderLineBadgeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  reorderLineBadgeBusText: {
    fontSize: 10,
    lineHeight: 13,
  },
  reorderLineBadgeMuted: {
    minWidth: 30,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reorderLineBadgeMutedText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  reorderTextBlock: {flex: 1, gap: spacing.xxs},
  reorderDisplayName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  reorderDisplayMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  reorderHandle: {
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderActivePill: {
    minHeight: 28,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#1B5E4A',
    backgroundColor: '#0A2218',
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderActivePillText: {
    color: '#7CE4BF',
    fontSize: 11,
    fontWeight: '800',
  },
  reorderFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  reorderSecondaryBtn: {
    minWidth: 96,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    minHeight: layout.buttonHeight,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderSecondaryBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  reorderPrimaryBtn: {
    minWidth: 120,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
    minHeight: layout.buttonHeight,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderPrimaryBtnDisabled: {
    opacity: 0.45,
  },
  reorderPrimaryBtnText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '800',
  },

  // ─── Set Active ───────────────────────────────────────────────────────────
  setActiveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    minHeight: layout.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
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
    gap: spacing.xs,
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
