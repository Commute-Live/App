import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  Easing,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {Ionicons} from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import {useRouter} from 'expo-router';
import {useLocalSearchParams} from 'expo-router';
import {useMutation, useQueries, useQuery, useQueryClient} from '@tanstack/react-query';
import {colors, layout, radii, spacing, typography} from '../../../theme';
import {apiFetch} from '../../../lib/api';
import DraggableFlatList, {type RenderItemParams} from 'react-native-draggable-flatlist';
import {useTabRouteIsActive} from '../../../components/TabScreen';
import {useSelectedDevice} from '../../../hooks/useSelectedDevice';
import DashboardPreviewSection from '../components/DashboardPreviewSection';
import {CITY_BRANDS, CITY_LABELS} from '../../../constants/cities';
import {useAppState} from '../../../state/appState';
import {useAuth} from '../../../state/authProvider';
import {
  buildStopLookupKey,
  deleteDisplay,
  fetchDisplays,
  getLiveArrivalLookup,
  providerToCity,
  toPreviewSlots,
  updateDisplay,
  type DisplaySavePayload,
  type DeviceDisplay,
} from '../../../lib/displays';
import {CITY_LINE_COLORS, hashLineColor, resolveProviderLineColor} from '../../../lib/lineColors';
import {getTransitStationName} from '../../../lib/transitApi';
import {queryKeys} from '../../../lib/queryKeys';

const stopNameCache: Record<string, string> = {};
const MIN_BRIGHTNESS = 10;
const MAX_BRIGHTNESS = 100;
const BRIGHTNESS_COMMIT_DELAY_MS = 2000;
const REORDER_ROW_HEIGHT = 76;

const buildDisplayPayload = (
  display: DeviceDisplay,
  options: {brightness?: number},
): DisplaySavePayload => {
  const brightness = options.brightness ?? display.config.brightness ?? 60;
  return {
    name: display.name,
    paused: display.paused,
    priority: display.priority,
    sortOrder: display.sortOrder,
    scheduleStart: display.scheduleStart,
    scheduleEnd: display.scheduleEnd,
    scheduleDays: display.scheduleDays,
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
  const providerColor = provider ? resolveProviderLineColor(provider, label) : null;
  const lineColors = city ? (CITY_LINE_COLORS[city] ?? {}) : {};
  return providerColor ?? lineColors[label] ?? hashLineColor(label);
};

const isReorderLineBus = (display: DeviceDisplay, label: string) => {
  const matchedLine = (display.config.lines ?? []).find(
    l => typeof l.line === 'string' && l.line.trim().toUpperCase() === label,
  );
  const provider = matchedLine?.provider ?? display.config.lines?.[0]?.provider ?? '';
  return provider === 'mta-bus' || provider === 'septa-bus';
};

const sortDisplaysForCarousel = (items: DeviceDisplay[], activeDisplayId: string | null) =>
  [...items].sort((a, b) => {
    if (a.displayId === activeDisplayId) return -1;
    if (b.displayId === activeDisplayId) return 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });

const getHiddenDisplayLineCount = (display: DeviceDisplay | null) =>
  Math.max(0, (display?.config.lines?.length ?? 0) - 2);

type DisplayManagementSectionProps = {
  onSwipeEnabledChange?: (enabled: boolean) => void;
};

export default function DisplayManagementSection({
  onSwipeEnabledChange,
}: DisplayManagementSectionProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useLocalSearchParams<{focusDisplayId?: string}>();
  const {state: appState} = useAppState();
  const {deviceId, status} = useAuth();
  const selectedDevice = useSelectedDevice();
  const selectedCity = appState.selectedCity;
  const isScreenFocused = useTabRouteIsActive('/dashboard');
  const {width: windowWidth} = useWindowDimensions();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [brightnessOverrides, setBrightnessOverrides] = useState<Record<string, number>>({});
  const [expandedBrightnessControls, setExpandedBrightnessControls] = useState<Record<string, boolean>>({});
  const [reorderVisible, setReorderVisible] = useState(false);
  const [isDisplayGestureRegionActive, setIsDisplayGestureRegionActive] = useState(false);
  const [carouselDirection, setCarouselDirection] = useState<1 | -1>(1);
  const [pendingFocusDisplayId, setPendingFocusDisplayId] = useState<string | null>(
    typeof params.focusDisplayId === 'string' ? params.focusDisplayId : null,
  );
  const [previewStageWidth, setPreviewStageWidth] = useState(0);
  const [previewTransition, setPreviewTransition] = useState<{
    outgoing: DeviceDisplay;
    incoming: DeviceDisplay;
    direction: 1 | -1;
  } | null>(null);
  const brightnessCommitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTrackAnim = useRef(new Animated.Value(1)).current;
  const previousDisplayIdRef = useRef<string | null>(null);
  const previousDisplayRef = useRef<DeviceDisplay | null>(null);
  const ledScale = useRef(new Animated.Value(1)).current;

  const handleLedPressIn = useCallback(() => {
    Animated.spring(ledScale, {
      toValue: 1.04,
      useNativeDriver: true,
      speed: 28,
      bounciness: 6,
    }).start();
  }, [ledScale]);

  const handleLedPressOut = useCallback(() => {
    Animated.spring(ledScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [ledScale]);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);


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
    const pairs: {key: string; provider: string; providerMode?: string; stop: string}[] = [];
    for (const display of displays) {
      for (const line of display.config.lines ?? []) {
        if (!line.provider || !line.stop) continue;
        const key = buildStopLookupKey(line);
        if (!pairs.find(pair => pair.key === key)) {
          pairs.push({key, provider: line.provider, providerMode: line.providerMode, stop: line.stop});
        }
      }
    }
    return pairs;
  }, [displays]);

  const stopNameQueries = useQueries({
    queries: stopPairs.map(({key, provider, providerMode, stop}) => ({
      queryKey: queryKeys.transitStationName(key, stop),
      queryFn: () => getTransitStationName(provider, stop, providerMode),
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
    }: {
      display: DeviceDisplay;
      brightness?: number;
    }) => {
      if (!deviceId) return;
      const payload = buildDisplayPayload(display, {brightness});
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

  useEffect(() => {
    if (!isScreenFocused || !deviceId || status !== 'authenticated') return;
    setCarouselIndex(0);
    void queryClient.invalidateQueries({queryKey: queryKeys.displays(deviceId)});
    void queryClient.invalidateQueries({queryKey: queryKeys.lastCommand(deviceId)});
  }, [deviceId, isScreenFocused, queryClient, status]);

  const visibleDisplays = useMemo(
    () => sortDisplaysForCarousel(displays, activeDisplayId),
    [activeDisplayId, displays],
  );
  const displayCountLabel = selectedDevice.name;
  const safeIndex = visibleDisplays.length > 0 ? Math.min(carouselIndex, visibleDisplays.length - 1) : 0;
  const currentDisplay = visibleDisplays[safeIndex] ?? null;
  const currentDisplayCity = providerToCity(currentDisplay?.config.lines?.[0]?.provider ?? null) ?? selectedCity;
  const currentBrightness = currentDisplay
    ? brightnessOverrides[currentDisplay.displayId] ?? currentDisplay.config.brightness ?? 60
    : 60;
  const currentDisplayHiddenLineCount = getHiddenDisplayLineCount(currentDisplay);
  const isBrightnessControlExpanded = currentDisplay ? !!expandedBrightnessControls[currentDisplay.displayId] : false;
  const showSetActiveButton = !!currentDisplay && currentDisplay.displayId !== activeDisplayId;
  const effectivePreviewWidth = previewStageWidth > 0 ? previewStageWidth : 320;
  const previewTravelDistance = Math.max(windowWidth, effectivePreviewWidth) + 24;

  const renderDisplayPreview = useCallback(
    (display: DeviceDisplay, city: typeof currentDisplayCity) => (
      <DashboardPreviewSection
        slots={toPreviewSlots(
          display,
          CITY_BRANDS[city].accent,
          stopNames,
          display.displayId === activeDisplayId ? liveArrivalLookup : null,
          {showDirectionFallback: false},
        )}
        displayType={display.config.displayType ?? Number(display.config.lines?.[0]?.displayType) ?? 1}
        onSelectSlot={() =>
          router.push({
            pathname: '/preset-editor',
            params: {city, from: 'dashboard', mode: 'edit', displayId: display.displayId},
          })
        }
        onReorderSlot={() => {}}
        onDragStateChange={() => {}}
        showHint={false}
        brightness={100}
        showGlow={false}
      />
    ),
    [activeDisplayId, liveArrivalLookup, router, stopNames],
  );

  useLayoutEffect(() => {
    const nextDisplayId = currentDisplay?.displayId ?? null;
    if (!nextDisplayId) {
      previousDisplayIdRef.current = null;
      previousDisplayRef.current = null;
      setPreviewTransition(null);
      previewTrackAnim.setValue(1);
      return;
    }

    if (previousDisplayIdRef.current === null) {
      previousDisplayIdRef.current = nextDisplayId;
      previousDisplayRef.current = currentDisplay;
      previewTrackAnim.setValue(1);
      return;
    }

    if (previousDisplayIdRef.current === nextDisplayId) {
      previousDisplayRef.current = currentDisplay;
      return;
    }

    const outgoingDisplay = previousDisplayRef.current;
    previousDisplayIdRef.current = nextDisplayId;
    previousDisplayRef.current = currentDisplay;

    if (!outgoingDisplay || !currentDisplay) {
      setPreviewTransition(null);
      previewTrackAnim.setValue(1);
      return;
    }

    setPreviewTransition({
      outgoing: outgoingDisplay,
      incoming: currentDisplay,
      direction: carouselDirection,
    });
    previewTrackAnim.stopAnimation();
    previewTrackAnim.setValue(0);
    Animated.timing(previewTrackAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({finished}) => {
      if (finished) {
        setPreviewTransition(current =>
          current?.incoming.displayId === nextDisplayId ? null : current,
        );
      }
    });
  }, [carouselDirection, currentDisplay, currentDisplay?.displayId, previewTrackAnim]);

  useEffect(() => {
    if (typeof params.focusDisplayId === 'string' && params.focusDisplayId.length > 0) {
      setPendingFocusDisplayId(params.focusDisplayId);
    }
  }, [params.focusDisplayId]);

  useEffect(() => {
    if (!pendingFocusDisplayId || visibleDisplays.length === 0) return;
    const targetIndex = visibleDisplays.findIndex(display => display.displayId === pendingFocusDisplayId);
    if (targetIndex === -1) return;
    if (targetIndex !== safeIndex) {
      setCarouselDirection(targetIndex > safeIndex ? 1 : -1);
    }
    setCarouselIndex(targetIndex);
    setPendingFocusDisplayId(null);
  }, [pendingFocusDisplayId, safeIndex, visibleDisplays]);


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

  const goTo = useCallback(
    (index: number) => {
      if (visibleDisplays.length === 0) return;
      const normalizedIndex = (index + visibleDisplays.length) % visibleDisplays.length;
      if (normalizedIndex !== safeIndex) {
        const wrappedForward = safeIndex === visibleDisplays.length - 1 && normalizedIndex === 0;
        const wrappedBackward = safeIndex === 0 && normalizedIndex === visibleDisplays.length - 1;
        setCarouselDirection(
          wrappedForward ? 1 : wrappedBackward ? -1 : normalizedIndex > safeIndex ? 1 : -1,
        );
      }
      setCarouselIndex(normalizedIndex);
    },
    [safeIndex, visibleDisplays.length],
  );

  const moveCarousel = useCallback(
    (direction: 1 | -1) => {
      if (visibleDisplays.length <= 1) return;
      goTo(safeIndex + direction);
    },
    [goTo, safeIndex, visibleDisplays.length],
  );

  const displaySwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          visibleDisplays.length > 1 &&
          Math.abs(gestureState.dx) > 14 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2,
        onPanResponderGrant: () => {
          setIsDisplayGestureRegionActive(true);
        },
        onPanResponderRelease: (_event, gestureState) => {
          setIsDisplayGestureRegionActive(false);
          if (Math.abs(gestureState.dx) < 40) return;
          moveCarousel(gestureState.dx < 0 ? 1 : -1);
        },
        onPanResponderTerminate: () => {
          setIsDisplayGestureRegionActive(false);
        },
      }),
    [moveCarousel, visibleDisplays.length],
  );

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

  const toggleBrightnessControl = useCallback((displayId: string) => {
    LayoutAnimation.configureNext({
      duration: 220,
      create: {type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity},
      update: {type: LayoutAnimation.Types.easeInEaseOut},
      delete: {type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity},
    });
    setExpandedBrightnessControls(prev => ({...prev, [displayId]: !prev[displayId]}));
  }, []);

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

  useEffect(() => {
    onSwipeEnabledChange?.(!isDisplayGestureRegionActive);
    return () => {
      onSwipeEnabledChange?.(true);
    };
  }, [isDisplayGestureRegionActive, onSwipeEnabledChange]);

  return (
    <>
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderRow}>
          <View style={styles.pageHeaderLeft}>
            <Text style={styles.pageTitle}>Displays</Text>
            <Text style={styles.pageMeta}>{displayCountLabel}</Text>
          </View>
          <View style={styles.pageHeaderRight}>
            <Pressable
              style={[
                styles.statusPill,
                selectedDevice.status === 'Online' ? styles.statusPillOn : styles.statusPillOff,
              ]}
              onPress={() => {
                if (selectedDevice.status !== 'Online') router.push('/reconnect-help');
              }}>
              <View style={[styles.statusDot, selectedDevice.status === 'Online' ? styles.statusDotOn : styles.statusDotOff]} />
              <Text style={styles.statusPillText}>{selectedDevice.status}</Text>
            </Pressable>
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
              onPress={() =>
                router.push({
                  pathname: '/preset-editor',
                  params: {city: currentDisplayCity, from: 'dashboard', mode: 'new'},
                })
              }>
              <Ionicons name="add" size={18} color={colors.accent} />
            </Pressable>
          </View>
        </View>
      </View>

      {loading ? <Text style={styles.hintText}>Loading displays…</Text> : null}
      {!loading && errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

      {!loading && !errorText ? (
        currentDisplay ? (
          <>
            <Animated.View
              style={{transform: [{scale: ledScale}]}}
              onTouchStart={() => { setIsDisplayGestureRegionActive(true); handleLedPressIn(); }}
              onTouchEnd={() => { setIsDisplayGestureRegionActive(false); handleLedPressOut(); }}
              onTouchCancel={() => { setIsDisplayGestureRegionActive(false); handleLedPressOut(); }}
              {...displaySwipeResponder.panHandlers}>
              <View
                style={styles.cardPreviewContainer}>
                <View
                  onLayout={event => setPreviewStageWidth(event.nativeEvent.layout.width)}
                  pointerEvents={previewTransition ? 'none' : 'auto'}
                  style={styles.previewStage}>
                  <View style={[styles.previewPane, previewTransition && styles.previewPaneHidden]}>
                    {renderDisplayPreview(currentDisplay, currentDisplayCity)}
                  </View>
                  {previewTransition ? (
                    <>
                      <Animated.View
                        style={[
                          styles.previewPaneFloating,
                          {width: effectivePreviewWidth},
                          {
                            transform: [
                              {
                                translateX: previewTrackAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [
                                    0,
                                    previewTransition.direction > 0
                                      ? -previewTravelDistance
                                      : previewTravelDistance,
                                  ],
                                }),
                              },
                            ],
                          },
                        ]}>
                        {renderDisplayPreview(
                          previewTransition.outgoing,
                          providerToCity(previewTransition.outgoing.config.lines?.[0]?.provider ?? null) ?? selectedCity,
                        )}
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.previewPaneFloating,
                          {width: effectivePreviewWidth},
                          {
                            transform: [
                              {
                                translateX: previewTrackAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [
                                    previewTransition.direction > 0
                                      ? previewTravelDistance
                                      : -previewTravelDistance,
                                    0,
                                  ],
                                }),
                              },
                            ],
                          },
                        ]}>
                        {renderDisplayPreview(
                          previewTransition.incoming,
                          providerToCity(previewTransition.incoming.config.lines?.[0]?.provider ?? null) ?? selectedCity,
                        )}
                      </Animated.View>
                    </>
                  ) : null}
                </View>
              </View>

            </Animated.View>

            <View style={styles.displayCard}>
              <View style={styles.navActionsRow}>
                <View style={styles.navCenter}>
                  <Pressable
                    style={[styles.arrowBtn, visibleDisplays.length <= 1 && styles.arrowBtnHidden]}
                    onPress={() => goTo(safeIndex - 1)}
                    disabled={visibleDisplays.length <= 1}>
                    <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
                  </Pressable>
                  <View style={styles.navTitleBlock}>
                    <View style={styles.navDisplayNameRow}>
                      <Text style={styles.navDisplayName} numberOfLines={1}>{currentDisplay.name}</Text>
                      {currentDisplayHiddenLineCount > 0 ? (
                        <View style={styles.navOverflowBadge}>
                          <Text style={styles.navOverflowBadgeText}>+{currentDisplayHiddenLineCount}</Text>
                        </View>
                      ) : null}
                    </View>
                    {currentDisplay.displayId === activeDisplayId ? (
                      <View style={styles.navActiveLabelCompact}>
                        <View style={styles.navActiveDotCompact} />
                        <Text style={styles.navActiveLabelCompactText}>Active</Text>
                      </View>
                    ) : (
                      <Pressable
                        style={[styles.setActivePill, activateDisplayMutation.isPending && styles.setActivePillDisabled]}
                        disabled={activateDisplayMutation.isPending}
                        onPress={() => activateDisplayMutation.mutate(currentDisplay)}>
                        <Text style={styles.setActivePillText}>
                          {activateDisplayMutation.isPending ? 'Activating…' : 'Set as Active'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  <Pressable
                    style={[styles.arrowBtn, visibleDisplays.length <= 1 && styles.arrowBtnHidden]}
                    onPress={() => goTo(safeIndex + 1)}
                    disabled={visibleDisplays.length <= 1}>
                    <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>
              <View style={styles.cardSettingsDivider} />
              <View style={styles.cardSettings}>
                <Pressable
                  style={styles.settingItemRow}
                  onPress={() => toggleBrightnessControl(currentDisplay.displayId)}>
                  <Text style={styles.brightnessLabel}>Brightness</Text>
                  <View style={styles.brightnessInlineControls}>
                    <Pressable
                      style={({pressed}) => [
                        styles.brightnessValueBadge,
                        isBrightnessControlExpanded && styles.brightnessValueBadgeActive,
                        pressed && styles.brightnessValueBadgePressed,
                      ]}
                      onPress={() => toggleBrightnessControl(currentDisplay.displayId)}>
                      <Text style={styles.brightnessValueText}>{currentBrightness}%</Text>
                    </Pressable>
                    <View style={styles.brightnessInlineBtn}>
                      <Ionicons
                        name={isBrightnessControlExpanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={colors.textMuted}
                      />
                    </View>
                  </View>
                </Pressable>
                {isBrightnessControlExpanded ? (
                  <BrightnessSlider
                    value={currentBrightness}
                    min={MIN_BRIGHTNESS}
                    max={MAX_BRIGHTNESS}
                    onChange={value => handleBrightnessChange(currentDisplay, value)}
                    onCommit={() => {}}
                  />
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


      <ReorderDisplaysModal
        visible={reorderVisible}
        displays={visibleDisplays}
        saving={reorderDisplaysMutation.isPending}
        onDelete={confirmDelete}
        onClose={() => {
          if (reorderDisplaysMutation.isPending) return;
          setCarouselIndex(0);
          setReorderVisible(false);
        }}
        onSave={handleSaveReorder}
      />
    </>
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
  onDelete,
  onClose,
  onSave,
}: {
  visible: boolean;
  displays: DeviceDisplay[];
  saving: boolean;
  onDelete: (display: DeviceDisplay) => void;
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
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
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
                  onDelete={onDelete}
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
  onDelete,
  onDragStart,
}: {
  display: DeviceDisplay;
  isDragging: boolean;
  index: number;
  saving: boolean;
  onDelete: (display: DeviceDisplay) => void;
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

        <View style={styles.reorderRowActions}>
          {isActive ? (
            <View style={styles.reorderActivePill}>
              <Text style={styles.reorderActivePillText}>Active</Text>
            </View>
          ) : (
            <View style={styles.reorderHandle}>
              <Ionicons name="reorder-three-outline" size={18} color={colors.textMuted} />
            </View>
          )}
          <Pressable style={styles.reorderDeleteBtn} onPress={() => onDelete(display)} disabled={saving}>
            <Ionicons name="trash-outline" size={16} color={colors.dangerText} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // ─── Layout ───────────────────────────────────────────────────────────────
  container: {flex: 1, backgroundColor: colors.background},
  content: {flex: 1},
  scrollView: {flex: 1},
  scroll: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.screenPadding,
    paddingBottom: layout.bottomInset,
    gap: layout.screenGap,
  },
  scrollWithFooter: {
    paddingBottom: spacing.lg,
  },

  // ─── Page Header ──────────────────────────────────────────────────────────
  pageHeader: {
    paddingTop: 0,
    paddingBottom: 0,
    marginBottom: 0,
  },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pageHeaderLeft: {flex: 1, gap: 4},
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
  pageMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },

  // ─── Loading / Error / Empty ───────────────────────────────────────────────
  hintText: {color: colors.textMuted, fontSize: 13},
  errorText: {color: colors.warning, fontSize: 13},

  // ─── Status Pill ──────────────────────────────────────────────────────────
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 32,
  },
  statusPillOn: {backgroundColor: colors.successSurface, borderColor: colors.successBorder},
  statusPillOff: {backgroundColor: colors.surface, borderColor: colors.border},
  statusDot: {width: 7, height: 7, borderRadius: 4},
  statusDotOn: {backgroundColor: colors.successText},
  statusDotOff: {backgroundColor: colors.textMuted},
  statusPillText: {color: colors.text, fontSize: 12, fontWeight: '700'},
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {color: colors.text, fontSize: 16, fontWeight: '800'},
  emptyBody: {color: colors.textMuted, fontSize: 13, lineHeight: 18, textAlign: 'center'},

  // ─── Display Card ─────────────────────────────────────────────────────────
  displayCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  displayCardActive: {},

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
  badgeActive: {backgroundColor: colors.successSurfaceStrong, borderColor: colors.successBorder},
  badgePaused: {backgroundColor: colors.card, borderColor: colors.border},
  badgeDot: {width: 6, height: 6, borderRadius: 3, backgroundColor: colors.successText},
  badgeText: {color: colors.text, fontSize: 11, fontWeight: '700'},

  // LED preview area — extra padding lets the glow breathe
  cardPreviewContainer: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    position: 'relative',
  },
  previewStage: {
    position: 'relative',
    overflow: 'visible',
  },
  previewPane: {
    width: '100%',
  },
  previewPaneHidden: {
    opacity: 0,
  },
  previewPaneFloating: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  activeOverlayBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.overlay,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.successText,
  },
  activeOverlayText: {
    color: colors.successText,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },

  // Nav row
  navActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.iconButton,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  navActiveLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    borderWidth: 1,
    borderColor: colors.successText,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  navActiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.successText,
  },
  navActiveLabelText: {
    color: colors.successText,
    fontSize: 12,
    fontWeight: '600',
  },
  navCenter: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  navTitleBlock: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
  navDisplayNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    maxWidth: '100%',
  },
  navDisplayName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: '100%',
  },
  navOverflowBadge: {
    minWidth: 28,
    height: 22,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    flexShrink: 0,
  },
  navOverflowBadgeText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  navActiveLabelCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: radii.md,
    backgroundColor: colors.successSurface,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  navActiveDotCompact: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.successText,
  },
  setActivePill: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.md,
    backgroundColor: colors.accentMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  setActivePillDisabled: {opacity: 0.5},
  setActivePillText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  navActiveLabelCompactText: {
    color: colors.successText,
    fontSize: 15,
    fontWeight: '700',
  },
  arrowBtn: {
    width: layout.iconButton,
    height: layout.iconButton,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtnDisabled: {opacity: 0.25},
  arrowBtnHidden: {opacity: 0},
  dotRow: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xxs},
  dot: {width: 5, height: 5, borderRadius: 3, backgroundColor: colors.border},
  dotActive: {width: 14, height: 5, borderRadius: 3, backgroundColor: colors.accent},

  activeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  activeStatusRowPressable: {
    borderTopWidth: 1,
    borderTopColor: colors.successBorder,
    backgroundColor: colors.successSurface,
  },
  cardSettingsDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  cardSettings: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  settingItem: {
    paddingVertical: 0,
    gap: spacing.xs,
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
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  settingItemValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  brightnessLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  brightnessInlineControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  brightnessInlineBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brightnessValueBadge: {
    minWidth: 58,
    height: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brightnessValueBadgeActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  brightnessValueBadgePressed: {
    opacity: 0.82,
  },
  brightnessValueText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
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
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
  },

  editBtn: {
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: 10,
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Reorder Modal ───────────────────────────────────────────────────────
  reorderBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
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
    shadowColor: colors.shadow,
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
    width: 76,
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 6,
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
  reorderRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reorderDeleteBtn: {
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderActivePill: {
    minHeight: 28,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.successBorder,
    backgroundColor: colors.successSurfaceStrong,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderActivePillText: {
    color: colors.successTextSoft,
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
    color: colors.onAccent,
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
    color: colors.onAccent,
    fontSize: 13,
    fontWeight: '800',
  },
  footerActionBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingTop: spacing.md,
    paddingHorizontal: layout.screenPadding,
  },
  footerActionBarBottomSpacer: {
    height: spacing.md,
  },
  activeStatusText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
