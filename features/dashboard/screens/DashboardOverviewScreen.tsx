import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, spacing } from '../../../theme';
import {AppBrandHeader} from '../../../components/AppBrandHeader';
import {TabScreen, useTabRouteIsActive} from '../../../components/TabScreen';
import {
  fetchDeviceSettings,
  updateDeviceSettings,
  validateDeviceSettings,
} from '../../../lib/deviceSettings';
import {getCurrentIanaTimeZone, isScheduleEnabled, validateScheduleWindow} from '../../../lib/schedules';
import DashboardPreviewSection from '../components/DashboardPreviewSection';
import { useAppState } from '../../../state/appState';
import {
   CITY_BRANDS,
   CITY_LABELS,
   CITY_OPTIONS,
} from '../../../constants/cities';
import { useAuth } from '../../../state/authProvider';
import { useSelectedDevice } from '../../../hooks/useSelectedDevice';
import { apiFetch } from '../../../lib/api';
import { queryKeys } from '../../../lib/queryKeys';
import {
   buildStopLookupKey,
   DISPLAY_WEEKDAYS,
   fetchDisplays,
   getLiveArrivalLookup,
   updateDisplay,
   providerToCity,
   toPreviewSlots,
   type DeviceDisplay,
   type DisplayWeekday,
   type DisplaySavePayload,
} from '../../../lib/displays';
import {getTransitStationName} from '../../../lib/transitApi';
import {styles} from './DashboardOverview.styles';
import {DashboardOverviewTimeAdjustField as TimeAdjustField} from './DashboardOverviewTimeAdjustField';

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
   const { state: appState, setDeviceStatus } = useAppState();
   const { status, user, deviceId, deviceIds, setDeviceId } = useAuth();
   const selectedDevice = useSelectedDevice();
   const hasLinkedDevice = deviceIds.length > 0;
   const isScreenFocused = useTabRouteIsActive('/dashboard');
   const [carouselIndex, setCarouselIndex] = useState(0);
   const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
   const [quietHours, setQuietHours] = useState<QuietHoursDraft>(DEFAULT_QUIET_HOURS);
   const [quietHoursError, setQuietHoursError] = useState('');

   const city = appState.selectedCity;
   const cityBrand = CITY_BRANDS[city];
   const cityOption = CITY_OPTIONS.find((option) => option.id === city);
   const cityAgency = cityOption?.agencyCode ?? CITY_LABELS[city];

   const displaysQuery = useQuery({
      queryKey: queryKeys.displays(selectedDevice.id || 'none'),
      queryFn: () => fetchDisplays(selectedDevice.id),
      enabled: isScreenFocused && hasLinkedDevice && !!selectedDevice.id && status === 'authenticated',
   });

   const deviceDisplays = displaysQuery.data?.displays ?? [];
   const activeDisplayId = displaysQuery.data?.activeDisplayId ?? null;
   const displaysLoading = displaysQuery.isPending || displaysQuery.isFetching;
   const displaysError = displaysQuery.error instanceof Error ? displaysQuery.error.message : '';

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

   const stopPairs = useMemo(() => {
      const pairs: {key: string; provider: string; providerMode?: string; stop: string}[] = [];
      for (const display of deviceDisplays) {
         for (const line of display.config.lines ?? []) {
            if (line.provider && line.stop) {
               const key = buildStopLookupKey(line);
               if (!pairs.find(p => p.key === key)) {
                  pairs.push({key, provider: line.provider, providerMode: line.providerMode, stop: line.stop});
               }
            }
         }
      }
      return pairs;
   }, [deviceDisplays]);

   const stopNameQueries = useQueries({
      queries: stopPairs.map(({key, provider, providerMode, stop}) => ({
         queryKey: queryKeys.transitStationName(key, stop),
         queryFn: () => getTransitStationName(provider, stop, providerMode),
         staleTime: 10 * 60 * 1000,
      })),
   });

   const stopNames = useMemo(() => {
      const resolved: Record<string, string> = {};
      stopPairs.forEach((pair, index) => {
         const name = stopNameQueries[index]?.data;
         if (name) {
            resolved[pair.key] = name;
         }
      });
      return resolved;
   }, [stopNameQueries, stopPairs]);

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

   const espDeviceInfoQuery = useQuery({
      queryKey: queryKeys.espDeviceInfo,
      queryFn: async () => {
         const response = await fetch('http://192.168.4.1/device-info', { method: 'GET' });
         if (!response.ok) return null;
         const data = await response.json().catch(() => null);
         return data?.deviceId ? String(data.deviceId) : null;
      },
      enabled: isScreenFocused && !hasLinkedDevice && espHeartbeatQuery.data === true,
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
   const espDeviceId = espDeviceInfoQuery.data ?? null;

   // Poll device online status every 30s while focused
   useQuery({
      queryKey: queryKeys.deviceOnline(selectedDevice.id || 'none'),
      queryFn: async () => {
         const res = await apiFetch(`/device/${encodeURIComponent(selectedDevice.id)}/online`).catch(() => null);
         const data = res?.ok ? await res.json().catch(() => null) : null;
         const online: boolean = data?.online === true;
         setDeviceStatus(online ? 'pairedOnline' : 'pairedOffline');
         return online;
      },
      enabled: isScreenFocused && hasLinkedDevice && !!selectedDevice.id && status === 'authenticated',
      refetchInterval: 30_000,
      retry: false,
      refetchOnWindowFocus: true,
   });

   const lastCommandQuery = useQuery({
      queryKey: queryKeys.lastCommand(selectedDevice.id || 'none'),
      queryFn: async () => {
         const response = await apiFetch(`/device/${selectedDevice.id}/last-command`);
         const data = await response.json().catch(() => null);
         if (!response.ok) return null;
         const event = data?.event;
         if (!event) return null;
         return event.payload ?? null;
      },
      enabled: isScreenFocused && hasLinkedDevice && !!selectedDevice.id,
      refetchInterval: 5000,
      retry: false,
      refetchOnWindowFocus: false,
   });
   const lastCommandPayload = lastCommandQuery.data ?? null;

   const carouselPresets = useMemo(
      () =>
         deviceDisplays.filter((display) => {
            const displayCity = providerToCity(display.config.lines?.[0]?.provider ?? null);
            return displayCity === city;
         }),
      [city, deviceDisplays],
   );

   // Auth guard — redirect to login if session is not authenticated
   useEffect(() => {
      if (status === 'unauthenticated') {
         router.replace('/auth');
      }
   }, [status, router]);

   // Auto-select first linked device if none currently selected
   useEffect(() => {
      if (!deviceId && deviceIds.length > 0) {
         setDeviceId(deviceIds[0]);
      }
   }, [deviceId, deviceIds, setDeviceId]);

   useEffect(() => {
      setCarouselIndex(0);
   }, [city, carouselPresets.length]);

   useEffect(() => {
      if (!isScreenFocused) return;
      if (hasLinkedDevice && selectedDevice.id && status === 'authenticated') {
         void queryClient.invalidateQueries({queryKey: queryKeys.displays(selectedDevice.id)});
         void queryClient.invalidateQueries({queryKey: queryKeys.deviceSettings(selectedDevice.id)});
         void queryClient.invalidateQueries({queryKey: queryKeys.lastCommand(selectedDevice.id)});
      }
      if (!hasLinkedDevice) {
         void queryClient.invalidateQueries({queryKey: queryKeys.espHeartbeat});
         void queryClient.invalidateQueries({queryKey: queryKeys.espDeviceInfo});
      }
   }, [hasLinkedDevice, isScreenFocused, queryClient, selectedDevice.id, status]);

   const activePreset = useMemo(() => {
      if (deviceDisplays.length === 0) return null;
      if (activeDisplayId) {
         const matched = deviceDisplays.find(display => display.displayId === activeDisplayId);
         if (matched) return matched;
      }
      return [...deviceDisplays].sort((a, b) => b.priority - a.priority)[0] ?? null;
   }, [activeDisplayId, deviceDisplays]);
   const activePresetCity = providerToCity(activePreset?.config.lines?.[0]?.provider ?? null) ?? city;
   const activePresetBrand = CITY_BRANDS[activePresetCity];
   const liveArrivalLookup = useMemo(
      () => getLiveArrivalLookup(lastCommandPayload),
      [lastCommandPayload],
   );

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

   const activateDisplayMutation = useMutation({
      mutationFn: async (display: DeviceDisplay) => {
         if (!selectedDevice.id) return;
         const maxPriority = Math.max(0, ...deviceDisplays.map(d => d.priority));
         const payload: DisplaySavePayload = {
            name: display.name,
            paused: display.paused,
            priority: maxPriority + 1,
            sortOrder: display.sortOrder,
            scheduleStart: display.scheduleStart,
            scheduleEnd: display.scheduleEnd,
            scheduleDays: display.scheduleDays,
            config: display.config,
         };
         await updateDisplay(selectedDevice.id, display.displayId, payload);
         const refreshRes = await apiFetch(`/refresh/device/${selectedDevice.id}`, { method: 'POST' });
         if (!refreshRes.ok) {
            console.error('[Carousel] Refresh failed:', refreshRes.status);
         }
      },
      onSuccess: () => {
         if (!selectedDevice.id) return;
         void queryClient.invalidateQueries({queryKey: queryKeys.displays(selectedDevice.id)});
         void queryClient.invalidateQueries({queryKey: queryKeys.lastCommand(selectedDevice.id)});
      },
   });
   const activating = activateDisplayMutation.isPending;

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
         void queryClient.invalidateQueries({queryKey: queryKeys.lastCommand(selectedDevice.id)});
      },
      onError: (error) => {
         setQuietHoursError(error instanceof Error ? error.message : 'Unable to update quiet hours.');
      },
   });
   const quietHoursSaving = quietHoursMutation.isPending;
   const quietHoursInputsDisabled = !quietHoursEnabled || quietHoursLoading || quietHoursSaving;

   const activateDisplayOnDevice = async (display: DeviceDisplay) => {
      if (!selectedDevice.id || activating) return;
      try {
         await activateDisplayMutation.mutateAsync(display);
      } catch (err) {
         console.error('[Carousel] activateDisplayOnDevice error:', err);
      }
   };

   const persistQuietHours = async (
      enabled: boolean,
      draft: QuietHoursDraft,
   ) => {
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

   const moveCarousel = (direction: 1 | -1) => {
      if (carouselPresets.length === 0) return;
      const newIndex = (carouselIndex + direction + carouselPresets.length) % carouselPresets.length;
      setCarouselIndex(newIndex);
      const preset = carouselPresets[newIndex];
      if (preset) void activateDisplayOnDevice(preset);
   };

   const heroSwipeResponder = useMemo(
      () =>
         PanResponder.create({
            onMoveShouldSetPanResponder: (_event, gestureState) =>
               Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
            onPanResponderRelease: (_event, gestureState) => {
               if (Math.abs(gestureState.dx) < 36) return;
               moveCarousel(gestureState.dx < 0 ? 1 : -1);
            },
            onPanResponderTerminate: () => {},
         }),
      [carouselIndex, carouselPresets.length],
   );

   // Show loading screen while auth hydration is in progress
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
      <TabScreen style={[styles.container, {paddingTop: insets.top}]} tabRoute="/dashboard">
         <AppBrandHeader email={user?.email} />

         <ScrollView contentContainerStyle={styles.scroll} bounces={false}>

            {/* ── Device Status ─────────────────────────────────────── */}
            {hasLinkedDevice ? (
               <View style={styles.pageHeader}>
                  <View style={styles.pageHeaderRow}>
                     <View style={styles.pageHeaderLeft}>
                        <Text style={styles.pageStatusText}>My Device</Text>
                        <Text style={styles.pageHeaderMeta}>{CITY_LABELS[city]}</Text>
                     </View>
                     <Pressable
                        style={[
                           styles.statusPill,
                           selectedDevice.status === 'Online' ? styles.statusPillOn : styles.statusPillOff,
                        ]}
                        onPress={() => {
                           if (selectedDevice.status !== 'Online') {
                              router.push('/reconnect-help');
                           }
                        }}
                     >
                        <View
                           style={[
                              styles.statusDot,
                              selectedDevice.status === 'Online' ? styles.statusDotOn : styles.statusDotOff,
                           ]}
                        />
                        <Text style={styles.statusPillText}>{selectedDevice.status}</Text>
                     </Pressable>
                  </View>

                  {deviceIds.length > 1 && (
                     <View style={styles.deviceSwitcherRow}>
                        <Text style={styles.switcherLabel}>Switch Device</Text>
                        <View style={{flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap'}}>
                           {deviceIds.map((id) => (
                              <Pressable
                                 key={id}
                                 style={[styles.devicePill, deviceId === id && styles.devicePillActive]}
                                 onPress={() => setDeviceId(id)}
                              >
                                 <Text style={[styles.devicePillText, deviceId === id && styles.devicePillTextActive]}>
                                    {id}
                                 </Text>
                              </Pressable>
                           ))}
                        </View>
                     </View>
                  )}
               </View>
            ) : (
               <Pressable style={[styles.card, styles.noDeviceCard]} onPress={() => router.push('/register-device')}>
                  <View style={styles.deviceHeaderRow}>
                     <View style={styles.deviceHeaderText}>
                        <Text style={styles.sectionLabel}>No Device Linked</Text>
                        <Text style={styles.deviceSubMeta}>
                           {espStatus === 'connected'
                              ? `CommuteLive device detected${espDeviceId ? ` — ID: ${espDeviceId}` : ''}`
                              : espStatus === 'checking'
                              ? 'Searching for nearby device…'
                              : 'Tap to connect a device'}
                        </Text>
                     </View>
                     <View
                        style={[
                           styles.statusPill,
                           espStatus === 'connected' ? styles.statusPillOn : styles.statusPillOff,
                        ]}
                     >
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
            )}

            {/* ── Current Live Display ──────────────────────────────── */}
            {hasLinkedDevice && (
               <View style={styles.sectionBlock}>
                  <Text style={styles.sectionBlockLabel}>Current live display</Text>

                  {activePreset ? (
                     <View style={styles.ledContainer}>
                        <DashboardPreviewSection
                           slots={toPreviewSlots(activePreset, activePresetBrand.accent, stopNames, liveArrivalLookup, {showDirectionFallback: false})}
                           displayType={activePreset.config.displayType ?? Number(activePreset.config.lines?.[0]?.displayType) ?? 1}
                           onSelectSlot={() =>
                              router.push({
                                 pathname: '/preset-editor',
                                 params: {city: activePresetCity, from: 'dashboard', mode: 'edit', displayId: activePreset.displayId},
                              })
                           }
                           onReorderSlot={() => {}}
                           onDragStateChange={() => {}}
                           showHint={false}
                           brightness={activePreset.config.brightness ?? 60}
                        />
                     </View>
                  ) : (
                     <View style={styles.emptyState}>
                        <View style={styles.emptyStateBody}>
                           <Text style={styles.emptyStateTitle}>Nothing here yet</Text>
                           {displaysError ? <Text style={styles.commandError}>{displaysError}</Text> : null}
                        </View>
                        <Pressable
                           style={styles.setupButton}
                           onPress={() =>
                              router.push({
                                 pathname: '/preset-editor',
                                 params: {city, from: 'dashboard', mode: 'new'},
                              })
                           }
                        >
                           <Text style={styles.setupButtonText}>Create Display</Text>
                        </Pressable>
                     </View>
                  )}
               </View>
            )}

            {/* ── Quiet Hours ───────────────────────────────────────── */}
            {hasLinkedDevice && (
               <View style={styles.sectionBlock}>
                  <View style={styles.quietHeaderRow}>
                     <View style={styles.quietHeaderCopy}>
                        <Text style={styles.sectionBlockLabel}>Quiet Hours</Text>
                        <Text style={[styles.quietMetaText, quietHoursLoading && styles.quietDescriptionDisabled]}>
                           {quietHoursLoading
                              ? 'Loading device settings…'
                              : `Blank the entire panel on selected days. Timezone: ${quietHoursTimezoneLabel}`}
                        </Text>
                     </View>
                     <Pressable
                        style={[
                           styles.toggleChip,
                           quietHoursEnabled ? styles.toggleChipOn : styles.toggleChipOff,
                        ]}
                        disabled={quietHoursLoading || quietHoursSaving}
                        onPress={() => {
                           const nextEnabled = !quietHoursEnabled;
                           setQuietHoursEnabled(nextEnabled);
                           void persistQuietHours(nextEnabled, quietHours);
                        }}
                     >
                        <View style={[styles.toggleDot, quietHoursEnabled ? styles.toggleDotOn : styles.toggleDotOff]} />
                        <Text style={styles.toggleChipText}>
                           {quietHoursSaving ? 'Saving…' : quietHoursEnabled ? 'On' : 'Off'}
                        </Text>
                     </Pressable>
                  </View>

                  {quietHoursEnabled ? (
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
                                       }}
                                    >
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
                                 onChange={(start) => updateQuietHoursDraft({start})}
                              />
                              <TimeAdjustField
                                 label="Wake At"
                                 value={quietHours.end}
                                 disabled={quietHoursInputsDisabled}
                                 onChange={(end) => updateQuietHoursDraft({end})}
                              />
                           </View>
                     </>
                  ) : null}
                  {quietHoursError || deviceSettingsError ? (
                     <Text style={styles.commandError}>{quietHoursError || deviceSettingsError}</Text>
                  ) : null}

               </View>
            )}


         </ScrollView>

      </TabScreen>
   );
}
