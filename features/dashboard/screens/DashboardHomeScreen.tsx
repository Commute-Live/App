import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { BottomNav, type BottomNavItem } from '../../../components/BottomNav';
import { colors, radii, spacing } from '../../../theme';
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
import {
   fetchDisplays,
   providerToCity,
   toDisplayScheduleText,
   toPreviewSlots,
   type DeviceDisplay,
} from '../../../lib/displays';

const NAV_ITEMS: BottomNavItem[] = [
   { key: 'home', label: 'Home', icon: 'home-outline', route: '/dashboard' },
   {
      key: 'presets',
      label: 'Displays',
      icon: 'albums-outline',
      route: '/presets',
   },
   {
      key: 'settings',
      label: 'Settings',
      icon: 'settings-outline',
      route: '/settings',
   },
];
const TIME_OPTIONS = [
   '00:00',
   '05:00',
   '06:00',
   '07:00',
   '08:00',
   '09:00',
   '10:00',
   '17:00',
   '18:00',
   '20:00',
   '22:00',
   '23:00',
];
export default function DashboardHomeScreen() {
   const router = useRouter();
   const { state: appState } = useAppState();
   const { status, user, deviceId, deviceIds, setDeviceId } = useAuth();
   const selectedDevice = useSelectedDevice();
   const hasLinkedDevice = deviceIds.length > 0;
   const [carouselIndex, setCarouselIndex] = useState(0);
   const [deviceDisplays, setDeviceDisplays] = useState<DeviceDisplay[]>([]);
   const [displaysLoading, setDisplaysLoading] = useState(false);
   const [displaysError, setDisplaysError] = useState('');
   const [quietHoursEnabled, setQuietHoursEnabled] = useState(true);
   const [quietHours, setQuietHours] = useState({ start: '23:00', end: '05:00' });
   const [lastCommandJson, setLastCommandJson] = useState('');
   const [lastCommandTs, setLastCommandTs] = useState('');
   const [lastCommandError, setLastCommandError] = useState('');
   const [espStatus, setEspStatus] = useState<'idle' | 'checking' | 'connected' | 'disconnected'>('idle');
   const [espDeviceId, setEspDeviceId] = useState<string | null>(null);

   const city = appState.selectedCity;
   const cityBrand = CITY_BRANDS[city];
   const cityAgency =
      CITY_OPTIONS.find((option) => option.id === city)?.agencyCode ??
      CITY_LABELS[city];
   const loadDisplays = useCallback(async () => {
      if (!hasLinkedDevice || !selectedDevice.id || status !== 'authenticated') {
         setDeviceDisplays([]);
         setDisplaysError('');
         setDisplaysLoading(false);
         return;
      }

      setDisplaysLoading(true);
      setDisplaysError('');
      try {
         const data = await fetchDisplays(selectedDevice.id);
         setDeviceDisplays(data.displays);
      } catch (err) {
         setDisplaysError(err instanceof Error ? err.message : 'Failed to load displays');
         setDeviceDisplays([]);
      } finally {
         setDisplaysLoading(false);
      }
   }, [hasLinkedDevice, selectedDevice.id, status]);
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

   // ESP local pairing — check for a nearby CommuteLive device over its AP WiFi
   const checkEspConnection = useCallback(async () => {
      setEspStatus('checking');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
         const response = await fetch('http://192.168.4.1/heartbeat', {
            method: 'GET',
            signal: controller.signal,
         });
         setEspStatus(response.ok ? 'connected' : 'disconnected');
      } catch {
         setEspStatus('disconnected');
      } finally {
         clearTimeout(timeout);
      }
   }, []);

   // Run connection check once when there is no linked device
   useEffect(() => {
      if (hasLinkedDevice) return;
      void checkEspConnection();
   }, [hasLinkedDevice, checkEspConnection]);

   // Fetch device ID from the ESP once a local connection is confirmed
   useEffect(() => {
      if (espStatus !== 'connected') return;
      (async () => {
         try {
            const response = await fetch('http://192.168.4.1/device-info', { method: 'GET' });
            if (!response.ok) return;
            const data = await response.json();
            if (data?.deviceId) setEspDeviceId(String(data.deviceId));
         } catch {
            // ignore — device info is best-effort
         }
      })();
   }, [espStatus]);

   useEffect(() => {
      setCarouselIndex(0);
   }, [city, carouselPresets.length]);

   useFocusEffect(
      useCallback(() => {
         void loadDisplays();
      }, [loadDisplays]),
   );

   useEffect(() => {
      if (carouselPresets.length <= 1) return;
      const timer = setInterval(() => {
         setCarouselIndex((prev) => (prev + 1) % carouselPresets.length);
      }, 3500);
      return () => clearInterval(timer);
   }, [carouselPresets.length]);

   // Poll the last command sent to the ESP every 5 seconds
   useEffect(() => {
      if (!hasLinkedDevice || !selectedDevice.id) return;
      let cancelled = false;
      let timer: ReturnType<typeof setInterval> | null = null;

      const loadLastCommand = async () => {
         try {
            const response = await apiFetch(
               `/device/${selectedDevice.id}/last-command`,
            );
            const data = await response.json().catch(() => null);
            if (!response.ok) {
               const msg =
                  typeof data?.error === 'string'
                     ? data.error
                     : `Failed to load command (${response.status})`;
               if (!cancelled) setLastCommandError(msg);
               return;
            }
            const event = data?.event;
            if (!event) {
               if (!cancelled) {
                  setLastCommandJson('No command published yet.');
                  setLastCommandTs('');
                  setLastCommandError('');
               }
               return;
            }
            const payload = event.payload;
            const pretty =
               payload && typeof payload === 'object'
                  ? JSON.stringify(payload, null, 2)
                  : String(payload ?? '');
            if (!cancelled) {
               setLastCommandJson(pretty || 'No command payload.');
               setLastCommandTs(typeof event.ts === 'string' ? event.ts : '');
               setLastCommandError('');
            }
         } catch {
            if (!cancelled)
               setLastCommandError('Failed to load latest command payload.');
         }
      };

      void loadLastCommand();
      timer = setInterval(() => void loadLastCommand(), 5000);
      return () => {
         cancelled = true;
         if (timer) clearInterval(timer);
      };
   }, [hasLinkedDevice, selectedDevice.id]);

   const activePreset = carouselPresets[carouselIndex] ?? null;

   // Show loading screen while auth hydration is in progress
   if (status === 'loading') {
      return (
         <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.loadingContainer}>
               <ActivityIndicator size="large" color={colors.accent} />
               <Text style={styles.loadingText}>Loading…</Text>
            </View>
            <BottomNav items={NAV_ITEMS} />
         </SafeAreaView>
      );
   }

   const moveCarousel = (direction: 1 | -1) => {
      if (carouselPresets.length === 0) return;
      setCarouselIndex(
         (prev) =>
            (prev + direction + carouselPresets.length) %
            carouselPresets.length,
      );
   };

   return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
         <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.header}>
               <Text style={styles.title}>Home</Text>
               <Text style={styles.subtitle}>
                  Device status and what will be displayed next.
               </Text>
            </View>

            {hasLinkedDevice ? (
               <View style={styles.card}>
                  <View style={styles.deviceHeaderRow}>
                     <View style={styles.deviceHeaderText}>
                        <Text style={styles.deviceName}>{selectedDevice.name}</Text>
                        <Text style={styles.deviceSubMeta}>City: {CITY_LABELS[city]}</Text>
                        {user?.email ? (
                           <Text style={styles.deviceSubMeta}>{user.email}</Text>
                        ) : null}
                     </View>
                     <View
                        style={[
                           styles.onlineChip,
                           selectedDevice.status === 'Online'
                              ? styles.onlineChipOn
                              : styles.onlineChipOff,
                        ]}
                     >
                        <View
                           style={[
                              styles.onlineDot,
                              selectedDevice.status === 'Online'
                                 ? styles.onlineDotOn
                                 : styles.onlineDotOff,
                           ]}
                        />
                        <Text style={styles.onlineChipText}>{selectedDevice.status}</Text>
                     </View>
                  </View>
                  {deviceIds.length > 1 && (
                     <View style={styles.deviceSwitcherRow}>
                        <Text style={styles.switcherLabel}>Switch Device</Text>
                        <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
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
                           styles.onlineChip,
                           espStatus === 'connected' ? styles.onlineChipOn : styles.onlineChipOff,
                        ]}
                     >
                        <View
                           style={[
                              styles.onlineDot,
                              espStatus === 'connected' ? styles.onlineDotOn : styles.onlineDotOff,
                           ]}
                        />
                        <Text style={styles.onlineChipText}>
                           {espStatus === 'connected' ? 'Found' : espStatus === 'checking' ? '···' : 'None'}
                        </Text>
                     </View>
                  </View>
               </Pressable>
            )}

            {hasLinkedDevice && <View style={styles.heroCard}>
               <View style={styles.heroTopRow}>
                  <View style={styles.heroTitleWrap}>
                     <View style={styles.heroBrandRow}>
                        <View
                           style={[
                              styles.mtaBadge,
                              {
                                 backgroundColor: cityBrand.badgeBg,
                                 borderColor: cityBrand.badgeBorder,
                              },
                           ]}
                        >
                           <Text
                              style={[
                                 styles.mtaBadgeText,
                                 { color: cityBrand.badgeText },
                              ]}
                           >
                              {cityAgency}
                           </Text>
                        </View>
                        <Text style={styles.heroBrandText}>
                           Live Transit Preview
                        </Text>
                     </View>
                     <Text style={styles.heroLabel}>Preview Carousel</Text>
                     <Text style={styles.heroTitle}>
                        {activePreset?.name ?? 'No displays yet'}
                     </Text>
                     <Text style={styles.heroMeta}>
                        {activePreset
                           ? toDisplayScheduleText(activePreset)
                           : displaysLoading
                           ? 'Loading displays for this device'
                           : 'Create a display to preview it here'}
                     </Text>
                  </View>
                  <View style={styles.heroArrowRow}>
                     <Pressable
                        style={styles.heroArrowButton}
                        onPress={() => moveCarousel(-1)}
                     >
                        <Text style={styles.heroArrowText}>‹</Text>
                     </Pressable>
                     <Pressable
                        style={styles.heroArrowButton}
                        onPress={() => moveCarousel(1)}
                     >
                        <Text style={styles.heroArrowText}>›</Text>
                     </Pressable>
                  </View>
               </View>

               {activePreset ? (
                  <>
                     <DashboardPreviewSection
                        slots={toPreviewSlots(activePreset, cityBrand.accent)}
                        onSelectSlot={() => {}}
                        onReorderSlot={() => {}}
                        onDragStateChange={() => {}}
                        showHint={false}
                        brightness={activePreset.config.brightness ?? 60}
                     />
                     <View style={styles.heroFooter}>
                        <Text style={styles.heroHint}>
                           {carouselPresets.length > 1
                              ? `Looping ${carouselPresets.length} displays. Use arrows to move manually.`
                              : 'Only one display available for this device/city.'}
                        </Text>
                        <View style={styles.heroDots}>
                           {carouselPresets.map((preset, index) => (
                              <Pressable
                                 key={preset.displayId}
                                 style={[
                                    styles.heroDot,
                                    index === carouselIndex &&
                                       styles.heroDotActive,
                                 ]}
                                 onPress={() => setCarouselIndex(index)}
                              />
                           ))}
                        </View>
                        <View style={styles.actionsRow}>
                           <Pressable
                              style={styles.secondaryButton}
                              onPress={() =>
                                 router.push({
                                    pathname: '/preset-editor',
                                    params: { city, from: 'dashboard', mode: 'new' },
                                 })
                              }
                           >
                              <Text style={styles.secondaryButtonText}>Add Display</Text>
                           </Pressable>
                           <Pressable
                              style={styles.ghostButton}
                              onPress={() =>
                                 router.push({
                                    pathname: '/preset-editor',
                                    params: {
                                       city,
                                       from: 'dashboard',
                                       mode: 'edit',
                                       displayId: activePreset.displayId,
                                    },
                                 })
                              }
                           >
                              <Text style={styles.ghostButtonText}>Edit This Display</Text>
                           </Pressable>
                        </View>
                     </View>
                  </>
               ) : (
                  <View style={styles.emptyHeroState}>
                     <Text style={styles.emptyHeroText}>
                        No displays for {CITY_LABELS[city]} yet.
                     </Text>
                     {displaysError ? <Text style={styles.commandError}>{displaysError}</Text> : null}
                     <Pressable
                        style={styles.setupButton}
                        onPress={() =>
                           router.push({
                              pathname: '/preset-editor',
                              params: { city, from: 'dashboard', mode: 'new' },
                           })
                        }
                     >
                        <Text style={styles.setupButtonText}>Add First Display</Text>
                     </Pressable>
                  </View>
               )}
            </View>}

            {hasLinkedDevice && <View style={styles.card}>
               <View style={styles.quietHeaderRow}>
                  <View style={styles.deviceHeaderText}>
                     <Text style={styles.sectionLabel}>Quiet Hours</Text>
                     <Text style={styles.quietSubtext}>
                        Sleep window overrides all other displays.
                     </Text>
                  </View>
                  <Pressable
                     style={[
                        styles.stateChip,
                        quietHoursEnabled
                           ? styles.onlineChipOn
                           : styles.stateChipOff,
                     ]}
                     onPress={() => setQuietHoursEnabled((prev) => !prev)}
                  >
                     <Text style={styles.stateChipText}>
                        {quietHoursEnabled ? 'On' : 'Off'}
                     </Text>
                  </Pressable>
               </View>

               <View style={styles.quietRangeRow}>
                  <TimeAdjustField
                     label='Sleep From'
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
                     label='Wake At'
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
            </View>}

            {hasLinkedDevice && (
               <View style={styles.card}>
                  <Text style={styles.sectionLabel}>
                     Last Payload Sent To ESP
                  </Text>
                  {lastCommandError ? (
                     <Text style={styles.commandError}>{lastCommandError}</Text>
                  ) : (
                     <>
                        {lastCommandTs ? (
                           <Text style={styles.commandTs}>{lastCommandTs}</Text>
                        ) : null}
                        <Text style={styles.commandJson}>
                           {lastCommandJson || 'Waiting for data…'}
                        </Text>
                     </>
                  )}
               </View>
            )}
         </ScrollView>

         <BottomNav items={NAV_ITEMS} />
      </SafeAreaView>
   );
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

function cycleTimeOption(current: string, delta: 1 | -1) {
   const index = TIME_OPTIONS.indexOf(current);
   const safeIndex = index === -1 ? 0 : index;
   const nextIndex =
      (safeIndex + delta + TIME_OPTIONS.length) % TIME_OPTIONS.length;
   return TIME_OPTIONS[nextIndex];
}

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: colors.background },
   loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
   loadingText: { color: colors.textMuted, fontSize: 13 },
   scroll: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
   header: { gap: 4, alignItems: 'center' },
   title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '900',
      textAlign: 'center',
   },
   subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: 'center',
      maxWidth: 300,
   },
   card: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.sm,
   },
   sectionLabel: { color: colors.text, fontSize: 13, fontWeight: '800' },
   deviceHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.sm,
   },
   deviceHeaderText: { flex: 1 },
   deviceName: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
      marginTop: 2,
   },
   deviceSubMeta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
   onlineChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: radii.md,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
   },
   onlineChipOn: { backgroundColor: '#0E2B21', borderColor: '#1B5E4A' },
   onlineChipOff: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
   },
   onlineDot: { width: 8, height: 8, borderRadius: 4 },
   onlineDotOn: { backgroundColor: '#34D399' },
   onlineDotOff: { backgroundColor: colors.textMuted },
   onlineChipText: { color: colors.text, fontSize: 12, fontWeight: '800' },
   deviceSwitcherRow: { gap: spacing.xs },
   switcherLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
   },
   devicePill: {
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
   },
   devicePillActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentMuted,
   },
   devicePillText: { color: colors.text, fontSize: 12, fontWeight: '700' },
   devicePillTextActive: { color: colors.accent },
   heroCard: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.sm,
   },
   heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.sm,
   },
   heroTitleWrap: { flex: 1 },
   heroBrandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
   },
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
   mtaBadgeText: { fontSize: 10, fontWeight: '900' },
   heroBrandText: { color: colors.text, fontSize: 12, fontWeight: '800' },
   heroLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
   },
   heroTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
      marginTop: 2,
   },
   heroMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
   heroArrowRow: { flexDirection: 'row', gap: spacing.xs },
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
   heroArrowText: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '700',
      marginTop: -2,
   },
   heroFooter: { gap: spacing.xs },
   heroHint: { color: colors.textMuted, fontSize: 11 },
   heroDots: { flexDirection: 'row', gap: 6, alignSelf: 'flex-start' },
   heroDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
   },
   heroDotActive: { backgroundColor: colors.accent },
   emptyHeroState: {
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
   },
   emptyHeroText: { color: colors.textMuted, fontSize: 12 },
   actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
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
   secondaryButtonText: { color: colors.text, fontSize: 12, fontWeight: '700' },
   ghostButton: {
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: 'transparent',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
   },
   ghostButtonText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
   },
   noDeviceCard: { borderColor: colors.warning, borderStyle: 'dashed' },
   setupButton: {
      backgroundColor: colors.accent,
      paddingVertical: spacing.sm,
      borderRadius: radii.md,
      alignItems: 'center',
   },
   setupButtonText: { color: colors.background, fontWeight: '800', fontSize: 13 },
   scanAgainText: { color: colors.accent, fontSize: 12, fontWeight: '700', textAlign: 'center' },
   noDeviceText: {
      color: colors.warning,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
   },
   commandTs: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
      marginBottom: 4,
   },
   commandJson: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: 'monospace',
   },
   commandError: { color: colors.warning, fontSize: 12 },
   quietHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.sm,
   },
   quietSubtext: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
   stateChip: {
      borderRadius: radii.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
   },
   stateChipOff: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
   },
   stateChipText: { color: colors.text, fontSize: 11, fontWeight: '800' },
   quietRangeRow: { flexDirection: 'row', gap: spacing.xs },
   timeField: {
      flex: 1,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.xs,
      gap: 6,
   },
   timeFieldLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
   timeFieldControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.xs,
   },
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
   timeFieldButtonText: { color: colors.text, fontSize: 16, fontWeight: '800' },
   timeFieldValue: { color: colors.text, fontSize: 13, fontWeight: '800' },
});
