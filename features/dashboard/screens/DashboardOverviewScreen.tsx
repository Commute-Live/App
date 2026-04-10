import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Switch,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {colors, spacing} from '../../../theme';
import {AppBrandHeader} from '../../../components/AppBrandHeader';
import {TabScreen, useTabRouteIsActive} from '../../../components/TabScreen';
import {
  fetchDeviceSettings,
  updateDeviceSettings,
  validateDeviceSettings,
} from '../../../lib/deviceSettings';
import {getCurrentIanaTimeZone, isScheduleEnabled, validateScheduleWindow} from '../../../lib/schedules';
import {useAppState} from '../../../state/appState';
import {useAuth} from '../../../state/authProvider';
import {useSelectedDevice} from '../../../hooks/useSelectedDevice';
import {apiFetch} from '../../../lib/api';
import {queryKeys} from '../../../lib/queryKeys';
import {DISPLAY_WEEKDAYS, type DisplayWeekday} from '../../../lib/displays';
import {styles} from './DashboardOverview.styles';
import {DashboardOverviewTimeAdjustField as TimeAdjustField} from './DashboardOverviewTimeAdjustField';
import DisplayManagementSection from './PresetsScreen';

const DAY_OPTIONS: Array<{id: DisplayWeekday; label: string}> = [
  {id: 'sun', label: 'S'},
  {id: 'mon', label: 'M'},
  {id: 'tue', label: 'T'},
  {id: 'wed', label: 'W'},
  {id: 'thu', label: 'T'},
  {id: 'fri', label: 'F'},
  {id: 'sat', label: 'S'},
];

const DEFAULT_QUIET_HOURS = {
  start: '23:00',
  end: '05:00',
  days: [...DISPLAY_WEEKDAYS] as DisplayWeekday[],
};
const DASHBOARD_REFRESH_PULL_DISTANCE = 96;

const formatShortTimezoneLabel = (timezone: string) => {
  const trimmed = timezone.trim();
  if (!trimmed) return 'Local';
  const parts = trimmed.split('/');
  const lastPart = parts[parts.length - 1] ?? trimmed;
  return lastPart.replace(/_/g, ' ');
};

type QuietHoursDraft = {
  start: string;
  end: string;
  days: DisplayWeekday[];
};

export default function DashboardOverviewScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const router = useRouter();
  const {
    state: {selectedCity},
    setDeviceStatus,
  } = useAppState();
  const {status, user, deviceId, deviceIds, setDeviceId} = useAuth();
  const selectedDevice = useSelectedDevice();
  const hasLinkedDevice = deviceIds.length > 0;
  const isScreenFocused = useTabRouteIsActive('/dashboard');
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursExpanded, setQuietHoursExpanded] = useState(false);
  const [quietHours, setQuietHours] = useState<QuietHoursDraft>(DEFAULT_QUIET_HOURS);
  const [quietHoursError, setQuietHoursError] = useState('');
  const [dashboardSwipeEnabled, setDashboardSwipeEnabled] = useState(true);
  const [dashboardRefreshing, setDashboardRefreshing] = useState(false);
  const dashboardScrollY = useRef(new Animated.Value(0)).current;

  const currentDeviceIndex = useMemo(() => {
    if (!deviceId) return 0;
    const index = deviceIds.indexOf(deviceId);
    return index === -1 ? 0 : index;
  }, [deviceId, deviceIds]);

  const deviceSettingsQuery = useQuery({
    queryKey: queryKeys.deviceSettings(selectedDevice.id || 'none'),
    queryFn: () => fetchDeviceSettings(selectedDevice.id),
    enabled: isScreenFocused && hasLinkedDevice && !!selectedDevice.id && status === 'authenticated',
    staleTime: 30_000,
  });
  const deviceSettings = deviceSettingsQuery.data ?? null;
  const deviceSettingsError = deviceSettingsQuery.error instanceof Error ? deviceSettingsQuery.error.message : '';
  const quietHoursLoading = deviceSettingsQuery.isPending && !deviceSettings;
  const quietHoursTimezone = deviceSettings?.timezone ?? getCurrentIanaTimeZone();
  const quietHoursTimezoneLabel = formatShortTimezoneLabel(quietHoursTimezone);

  const espHeartbeatQuery = useQuery({
    queryKey: queryKeys.espHeartbeat,
    queryFn: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch('http://192.168.4.1/heartbeat', {
          method: 'GET',
          signal: controller.signal,
        });
        return response.ok;
      } catch {
        return false;
      } finally {
        clearTimeout(timeout);
      }
    },
    enabled: isScreenFocused && !hasLinkedDevice,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const espStatus: 'idle' | 'checking' | 'connected' | 'disconnected' = hasLinkedDevice
    ? 'idle'
    : (espHeartbeatQuery.isPending || espHeartbeatQuery.isFetching)
      ? 'checking'
      : espHeartbeatQuery.data
        ? 'connected'
        : 'disconnected';
  useQuery({
    queryKey: queryKeys.deviceOnline(selectedDevice.id || 'none'),
    queryFn: async () => {
      const res = await apiFetch(`/device/${encodeURIComponent(selectedDevice.id)}/online`).catch(() => null);
      const data = res?.ok ? await res.json().catch(() => null) : null;
      const online = data?.online === true;
      setDeviceStatus(online ? 'pairedOnline' : 'pairedOffline');
      return online;
    },
    enabled: isScreenFocused && hasLinkedDevice && !!selectedDevice.id && status === 'authenticated',
    refetchInterval: 30_000,
    retry: false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth');
    }
  }, [router, status]);

  useEffect(() => {
    if (!deviceId && deviceIds.length > 0) {
      setDeviceId(deviceIds[0]);
    }
  }, [deviceId, deviceIds, setDeviceId]);

  useEffect(() => {
    if (!isScreenFocused) return;
    if (hasLinkedDevice && selectedDevice.id && status === 'authenticated') {
      void queryClient.invalidateQueries({queryKey: queryKeys.deviceSettings(selectedDevice.id)});
      return;
    }
    if (!hasLinkedDevice) {
      void queryClient.invalidateQueries({queryKey: queryKeys.espHeartbeat});
    }
  }, [hasLinkedDevice, isScreenFocused, queryClient, selectedDevice.id, status]);

  useEffect(() => {
    if (!hasLinkedDevice || !selectedDevice.id || !deviceSettings) {
      setQuietHoursEnabled(false);
      setQuietHours(DEFAULT_QUIET_HOURS);
      setQuietHoursError('');
      return;
    }

    const enabled = isScheduleEnabled({
      start: deviceSettings.quietHoursStart,
      end: deviceSettings.quietHoursEnd,
      days: deviceSettings.quietHoursDays,
    });

    setQuietHoursEnabled(enabled);
    setQuietHours({
      start: deviceSettings.quietHoursStart ?? DEFAULT_QUIET_HOURS.start,
      end: deviceSettings.quietHoursEnd ?? DEFAULT_QUIET_HOURS.end,
      days: deviceSettings.quietHoursDays.length > 0 ? deviceSettings.quietHoursDays : [...DISPLAY_WEEKDAYS],
    });
    setQuietHoursError('');
  }, [deviceSettings, hasLinkedDevice, selectedDevice.id]);

  const quietHoursMutation = useMutation({
    mutationFn: async ({
      enabled,
      draft,
    }: {
      enabled: boolean;
      draft: QuietHoursDraft;
    }) => {
      if (!selectedDevice.id) return;
      const payload = {
        deviceId: selectedDevice.id,
        timezone: getCurrentIanaTimeZone(),
        quietHoursStart: enabled ? draft.start : null,
        quietHoursEnd: enabled ? draft.end : null,
        quietHoursDays: enabled ? (draft.days.length > 0 ? draft.days : [...DISPLAY_WEEKDAYS]) : [],
      };
      const validationError = validateDeviceSettings(payload);
      if (validationError) throw new Error(validationError);
      await updateDeviceSettings(selectedDevice.id, payload);
      const refreshResponse = await apiFetch(`/refresh/device/${selectedDevice.id}`, {method: 'POST'});
      if (!refreshResponse.ok) {
        console.error('[QuietHours] Refresh failed:', refreshResponse.status);
      }
    },
    onSuccess: () => {
      setQuietHoursError('');
      if (!selectedDevice.id) return;
      void queryClient.invalidateQueries({queryKey: queryKeys.deviceSettings(selectedDevice.id)});
    },
    onError: (error) => {
      setQuietHoursError(error instanceof Error ? error.message : 'Unable to update quiet hours.');
    },
  });
  const quietHoursSaving = quietHoursMutation.isPending;
  const quietHoursInputsDisabled = !quietHoursEnabled || quietHoursLoading || quietHoursSaving;
  const dashboardPullDistance = useMemo(
    () => Animated.diffClamp(Animated.multiply(dashboardScrollY, -1), 0, DASHBOARD_REFRESH_PULL_DISTANCE),
    [dashboardScrollY],
  );
  const dashboardSpinnerOpacity = useMemo(
    () =>
      dashboardPullDistance.interpolate({
        inputRange: [0, DASHBOARD_REFRESH_PULL_DISTANCE * 0.2, DASHBOARD_REFRESH_PULL_DISTANCE],
        outputRange: [0, 0.18, 1],
        extrapolate: 'clamp',
      }),
    [dashboardPullDistance],
  );
  const dashboardSpinnerScale = useMemo(
    () =>
      dashboardPullDistance.interpolate({
        inputRange: [0, DASHBOARD_REFRESH_PULL_DISTANCE],
        outputRange: [0.72, 1],
        extrapolate: 'clamp',
      }),
    [dashboardPullDistance],
  );
  const dashboardSpinnerTranslateY = useMemo(
    () =>
      dashboardPullDistance.interpolate({
        inputRange: [0, DASHBOARD_REFRESH_PULL_DISTANCE],
        outputRange: [-10, 8],
        extrapolate: 'clamp',
      }),
    [dashboardPullDistance],
  );
  const handleDashboardScroll = useMemo(
    () =>
      Animated.event([{nativeEvent: {contentOffset: {y: dashboardScrollY}}}], {
        useNativeDriver: true,
      }),
    [dashboardScrollY],
  );

  const refreshDashboard = useCallback(async () => {
    if (dashboardRefreshing) return;
    setDashboardRefreshing(true);
    dashboardScrollY.setValue(0);

    try {
      if (hasLinkedDevice && selectedDevice.id && status === 'authenticated') {
        await Promise.all([
          queryClient.invalidateQueries({queryKey: queryKeys.deviceSettings(selectedDevice.id)}),
          queryClient.invalidateQueries({queryKey: queryKeys.deviceOnline(selectedDevice.id)}),
          queryClient.invalidateQueries({queryKey: queryKeys.displays(selectedDevice.id)}),
          queryClient.invalidateQueries({queryKey: queryKeys.lastCommand(selectedDevice.id)}),
        ]);
        return;
      }

      if (!hasLinkedDevice) {
        await queryClient.invalidateQueries({queryKey: queryKeys.espHeartbeat});
      }
    } finally {
      setDashboardRefreshing(false);
    }
  }, [dashboardRefreshing, hasLinkedDevice, queryClient, selectedDevice.id, status]);

  const handleDashboardScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (dashboardRefreshing) return;
      const offsetY = event.nativeEvent.contentOffset.y;
      const releasedPullDistance = offsetY < 0 ? Math.abs(offsetY) : 0;

      if (releasedPullDistance >= DASHBOARD_REFRESH_PULL_DISTANCE) {
        void refreshDashboard();
        return;
      }
    },
    [dashboardRefreshing, refreshDashboard],
  );

  const persistQuietHours = async (enabled: boolean, draft: QuietHoursDraft) => {
    if (!selectedDevice.id || quietHoursSaving) return;
    setQuietHoursError('');
    try {
      await quietHoursMutation.mutateAsync({enabled, draft});
    } catch {
      // handled in mutation callbacks
    }
  };

  const updateQuietHoursDraft = (patch: Partial<QuietHoursDraft>) => {
    const nextDraft = {...quietHours, ...patch};
    const validationError = validateScheduleWindow({
      start: nextDraft.start,
      end: nextDraft.end,
      days: nextDraft.days,
    });
    if (validationError) {
      setQuietHoursError(validationError);
      return;
    }

    setQuietHoursError('');
    setQuietHours(nextDraft);
    if (quietHoursEnabled) void persistQuietHours(true, nextDraft);
  };

  const cycleDevice = (direction: 1 | -1) => {
    if (deviceIds.length <= 1) return;
    const nextIndex = (currentDeviceIndex + direction + deviceIds.length) % deviceIds.length;
    const nextDeviceId = deviceIds[nextIndex];
    if (nextDeviceId) {
      setDeviceId(nextDeviceId);
    }
  };

  const deviceLabels = useMemo(
    () =>
      Object.fromEntries(
        deviceIds.map((id, index) => [id, id === deviceId ? selectedDevice.name : `Device ${index + 1}`]),
      ) as Record<string, string>,
    [deviceId, deviceIds, selectedDevice.name],
  );

  if (status === 'loading') {
    return (
      <View style={[styles.container, {paddingTop: insets.top}]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </View>
    );
  }

  return (
    <TabScreen
      style={[styles.container, {paddingTop: insets.top}]}
      tabRoute="/dashboard"
      swipeEnabled={dashboardSwipeEnabled}>
      <AppBrandHeader email={user?.email} />

      <View style={styles.scrollViewport}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.refreshSpinnerWrap,
            dashboardRefreshing
              ? styles.refreshSpinnerWrapActive
              : {
                  opacity: dashboardSpinnerOpacity,
                  transform: [{translateY: dashboardSpinnerTranslateY}],
                },
          ]}>
          <Animated.View
            style={[
              styles.refreshSpinner,
              dashboardRefreshing
                ? styles.refreshSpinnerActive
                : {
                    transform: [{scale: dashboardSpinnerScale}],
                  },
            ]}>
            <ActivityIndicator size="small" color={colors.accent} />
          </Animated.View>
        </Animated.View>

        <Animated.ScrollView
          contentContainerStyle={styles.scroll}
          alwaysBounceVertical
          bounces
          overScrollMode="always"
          scrollEventThrottle={16}
          onScroll={handleDashboardScroll}
          onScrollEndDrag={handleDashboardScrollEndDrag}>
          {hasLinkedDevice && deviceIds.length > 1 ? (
            <View style={styles.pageHeader}>
            <View style={styles.deviceSwitcherRow}>
              <View style={styles.deviceSwitcherHeader}>
                <Text style={styles.switcherLabel}>Linked devices</Text>
                <Text style={styles.switcherMeta}>
                  {currentDeviceIndex + 1} of {deviceIds.length}
                </Text>
              </View>

              <View style={styles.deviceCycleRow}>
                <Pressable style={styles.deviceCycleButton} onPress={() => cycleDevice(-1)}>
                  <Ionicons name="chevron-back" size={18} color={colors.text} />
                </Pressable>
                <View style={styles.deviceCycleCurrent}>
                  <Text style={styles.deviceCycleCurrentText} numberOfLines={1}>
                    {deviceLabels[selectedDevice.id] ?? selectedDevice.name}
                  </Text>
                </View>
                <Pressable style={styles.deviceCycleButton} onPress={() => cycleDevice(1)}>
                  <Ionicons name="chevron-forward" size={18} color={colors.text} />
                </Pressable>
              </View>

              <View style={styles.devicePillWrap}>
                {deviceIds.map(id => (
                  <Pressable
                    key={id}
                    style={[styles.devicePill, deviceId === id && styles.devicePillActive]}
                    onPress={() => setDeviceId(id)}>
                    <Text style={[styles.devicePillText, deviceId === id && styles.devicePillTextActive]}>
                      {deviceLabels[id] ?? 'My Device'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          ) : null}

          {!hasLinkedDevice ? (
            <Pressable style={[styles.card, styles.noDeviceCard]} onPress={() => router.push('/register-device')}>
            <View style={styles.deviceHeaderRow}>
              <View style={styles.deviceHeaderText}>
                <Text style={styles.sectionLabel}>No Device Linked</Text>
                <Text style={styles.deviceSubMeta}>
                  {espStatus === 'connected'
                    ? 'CommuteLive device detected nearby'
                    : espStatus === 'checking'
                      ? 'Searching for nearby device…'
                      : 'Tap to connect a device'}
                </Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  espStatus === 'connected' ? styles.statusPillOn : styles.statusPillOff,
                ]}>
                <View
                  style={[
                    styles.statusDot,
                    espStatus === 'connected' ? styles.statusDotOn : styles.statusDotOff,
                  ]}
                />
                <Text style={styles.statusPillText}>
                  {espStatus === 'connected' ? 'Found' : espStatus === 'checking' ? '···' : 'None'}
                </Text>
              </View>
            </View>
            </Pressable>
          ) : null}

          {hasLinkedDevice ? (
            <DisplayManagementSection onSwipeEnabledChange={setDashboardSwipeEnabled} />
          ) : null}

          {hasLinkedDevice ? (
            <View style={[styles.card, {backgroundColor: colors.surface}]}>
            <View style={styles.quietHeaderRow}>
              <View style={styles.quietHeaderCopy}>
                <Text style={styles.cardTitle}>Quiet Hours</Text>
                {quietHoursLoading ? (
                  <Text style={[styles.quietMetaText, styles.quietDescriptionDisabled]}>Loading device settings…</Text>
                ) : null}
              </View>
              <View style={styles.quietHeaderControls}>
                <Switch
                  value={quietHoursEnabled}
                  disabled={quietHoursLoading || quietHoursSaving}
                  onValueChange={nextEnabled => {
                    setQuietHoursEnabled(nextEnabled);
                    if (nextEnabled) setQuietHoursExpanded(true);
                    void persistQuietHours(nextEnabled, quietHours);
                  }}
                  trackColor={{false: colors.border, true: colors.accent}}
                  ios_backgroundColor={colors.border}
                  style={styles.quietHeaderSwitch}
                />
                {quietHoursEnabled ? (
                  <Pressable
                    style={styles.quietExpandBtn}
                    onPress={() => setQuietHoursExpanded(prev => !prev)}>
                    <Ionicons
                      name={quietHoursExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.textMuted}
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {quietHoursEnabled && quietHoursExpanded ? (
              <>
                <View style={styles.quietDaysWrap}>
                  <View style={[styles.quietDaysRow, quietHoursInputsDisabled && styles.quietDaysRowDisabled]}>
                    {DAY_OPTIONS.map(day => {
                      const active = quietHours.days.includes(day.id);
                      return (
                        <Pressable
                          key={day.id}
                          style={[styles.quietDayPill, active && styles.quietDayPillActive]}
                          disabled={quietHoursInputsDisabled}
                          onPress={() => {
                            const nextDays = active
                              ? quietHours.days.filter(item => item !== day.id)
                              : [...quietHours.days, day.id];
                            const nextQuietHours = {
                              ...quietHours,
                              days: DISPLAY_WEEKDAYS.filter(option => nextDays.includes(option)),
                            };
                            setQuietHours(nextQuietHours);
                            if (quietHoursEnabled) void persistQuietHours(true, nextQuietHours);
                          }}>
                          <Text style={[styles.quietDayPillText, active && styles.quietDayPillTextActive]}>
                            {day.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.quietRangeRow}>
                  <TimeAdjustField
                    label="Sleep From"
                    value={quietHours.start}
                    disabled={quietHoursInputsDisabled}
                    onChange={start => updateQuietHoursDraft({start})}
                  />
                  <TimeAdjustField
                    label="Wake At"
                    value={quietHours.end}
                    disabled={quietHoursInputsDisabled}
                    onChange={end => updateQuietHoursDraft({end})}
                  />
                </View>
              </>
            ) : null}

            {quietHoursError || deviceSettingsError ? (
              <Text style={styles.commandError}>{quietHoursError || deviceSettingsError}</Text>
            ) : null}
            </View>
          ) : null}

        </Animated.ScrollView>
      </View>
    </TabScreen>
  );
}
