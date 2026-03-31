import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, spacing } from '../../../theme';
import { BottomNav, type BottomNavItem } from '../../../components/BottomNav';

const NAV_ITEMS: BottomNavItem[] = [
  {key: 'home', label: 'Home', icon: 'home-outline', route: '/dashboard'},
  {key: 'presets', label: 'Displays', icon: 'albums-outline', route: '/presets'},
  {key: 'settings', label: 'Settings', icon: 'settings-outline', route: '/settings'},
];
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
   fetchDisplays,
   getLiveArrivalLookup,
   updateDisplay,
   providerToCity,
   toDisplayScheduleText,
   toPreviewSlots,
   type DeviceDisplay,
   type DisplaySavePayload,
} from '../../../lib/displays';
import {getTransitStationName} from '../../../lib/transitApi';
import {styles} from './DashboardOverview.styles';
import {cycleTimeOption} from './DashboardOverview.time';
import {DashboardOverviewTimeAdjustField as TimeAdjustField} from './DashboardOverviewTimeAdjustField';

export default function DashboardOverviewScreen() {
   const insets = useSafeAreaInsets();
   const queryClient = useQueryClient();
   const router = useRouter();
   const { state: appState, setDeviceStatus } = useAppState();
   const { status, user, deviceId, deviceIds, setDeviceId } = useAuth();
   const selectedDevice = useSelectedDevice();
   const hasLinkedDevice = deviceIds.length > 0;
   const [carouselIndex, setCarouselIndex] = useState(0);
   const [quietHoursEnabled, setQuietHoursEnabled] = useState(true);
   const [quietHours, setQuietHours] = useState({ start: '23:00', end: '05:00' });
   const [isScreenFocused, setIsScreenFocused] = useState(false);

   const city = appState.selectedCity;
   const cityBrand = CITY_BRANDS[city];
   const cityOption = CITY_OPTIONS.find((option) => option.id === city);
   const cityAgency = cityOption?.agencyCode ?? CITY_LABELS[city];

   useFocusEffect(
      useCallback(() => {
         setIsScreenFocused(true);
         return () => setIsScreenFocused(false);
      }, []),
   );

   const displaysQuery = useQuery({
      queryKey: queryKeys.displays(selectedDevice.id || 'none'),
      queryFn: () => fetchDisplays(selectedDevice.id),
      enabled: isScreenFocused && hasLinkedDevice && !!selectedDevice.id && status === 'authenticated',
   });

   const deviceDisplays = displaysQuery.data?.displays ?? [];
   const displaysLoading = displaysQuery.isPending || displaysQuery.isFetching;
   const displaysError = displaysQuery.error instanceof Error ? displaysQuery.error.message : '';

   const stopPairs = useMemo(() => {
      const pairs: {key: string; provider: string; stop: string}[] = [];
      for (const display of deviceDisplays) {
         for (const line of display.config.lines ?? []) {
            if (line.provider && line.stop) {
               const key = `${line.provider}:${line.stop}`;
               if (!pairs.find(p => p.key === key)) {
                  pairs.push({key, provider: line.provider, stop: line.stop});
               }
            }
         }
      }
      return pairs;
   }, [deviceDisplays]);

   const stopNameQueries = useQueries({
      queries: stopPairs.map(({provider, stop}) => ({
         queryKey: queryKeys.transitStationName(provider, stop),
         queryFn: () => getTransitStationName(provider, stop),
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


   useFocusEffect(
      useCallback(() => {
         if (hasLinkedDevice && selectedDevice.id && status === 'authenticated') {
            void queryClient.invalidateQueries({queryKey: queryKeys.displays(selectedDevice.id)});
            void queryClient.invalidateQueries({queryKey: queryKeys.lastCommand(selectedDevice.id)});
         }
         if (!hasLinkedDevice) {
            void queryClient.invalidateQueries({queryKey: queryKeys.espHeartbeat});
            void queryClient.invalidateQueries({queryKey: queryKeys.espDeviceInfo});
         }
      }, [hasLinkedDevice, queryClient, selectedDevice.id, status]),
   );

   const activePreset = useMemo(
      () => carouselPresets.length === 0
         ? null
         : [...carouselPresets].sort((a, b) => b.priority - a.priority)[0] ?? null,
      [carouselPresets],
   );
   const activeScheduleText = activePreset ? toDisplayScheduleText(activePreset) : 'No schedule set';
   const liveArrivalLookup = useMemo(
      () => getLiveArrivalLookup(lastCommandPayload),
      [lastCommandPayload],
   );

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

   const activateDisplayOnDevice = async (display: DeviceDisplay) => {
      if (!selectedDevice.id || activating) return;
      try {
         await activateDisplayMutation.mutateAsync(display);
      } catch (err) {
         console.error('[Carousel] activateDisplayOnDevice error:', err);
      }
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
      <View style={[styles.container, {paddingTop: insets.top}]}>

         {/* ── Fixed App Header ──────────────────────────────────────── */}
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
                           slots={toPreviewSlots(activePreset, cityBrand.accent, stopNames, liveArrivalLookup, {
                              showDirectionFallback: false,
                           })}
                           displayType={activePreset.config.displayType ?? Number(activePreset.config.lines?.[0]?.displayType) ?? 1}
                           ledTypography
                           onSelectSlot={() =>
                              router.push({
                                 pathname: '/preset-editor',
                                 params: {city, from: 'dashboard', mode: 'edit', displayId: activePreset.displayId},
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
                  <View style={styles.heroNameRow}>
                     <Text style={styles.sectionBlockLabel}>Quiet Hours</Text>
                     <Pressable
                        style={[
                           styles.toggleChip,
                           quietHoursEnabled ? styles.toggleChipOn : styles.toggleChipOff,
                        ]}
                        onPress={() => setQuietHoursEnabled((prev) => !prev)}
                     >
                        <View style={[styles.toggleDot, quietHoursEnabled ? styles.toggleDotOn : styles.toggleDotOff]} />
                        <Text style={styles.toggleChipText}>{quietHoursEnabled ? 'On' : 'Off'}</Text>
                     </Pressable>
                  </View>

                  <View style={styles.quietRangeRow}>
                        <TimeAdjustField
                           label="Sleep From"
                           value={quietHours.start}
                           onPrev={() =>
                              setQuietHours((prev) => ({
                                 ...prev,
                                 start: cycleTimeOption(prev.start, -1),
                              }))
                           }
                           onNext={() =>
                              setQuietHours((prev) => ({
                                 ...prev,
                                 start: cycleTimeOption(prev.start, 1),
                              }))
                           }
                        />
                        <TimeAdjustField
                           label="Wake At"
                           value={quietHours.end}
                           onPrev={() =>
                              setQuietHours((prev) => ({
                                 ...prev,
                                 end: cycleTimeOption(prev.end, -1),
                              }))
                           }
                           onNext={() =>
                              setQuietHours((prev) => ({
                                 ...prev,
                                 end: cycleTimeOption(prev.end, 1),
                              }))
                           }
                        />
                     </View>

               </View>
            )}

         </ScrollView>

         <BottomNav items={NAV_ITEMS} />
      </View>
   );
}
