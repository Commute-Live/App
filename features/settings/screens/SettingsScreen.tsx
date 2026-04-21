import React, {useEffect, useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {TextInput} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {colors, layout, radii, settingsSectionColors, spacing, typography} from '../../../theme';
import {useAuth} from '../../../state/authProvider';
import {AppBrandHeader} from '../../../components/AppBrandHeader';
import {TabScreen} from '../../../components/TabScreen';
import {useAppState} from '../../../state/appState';
import {logger} from '../../../lib/datadog';
import {resetDeviceWifi} from '../../../lib/deviceSetup';
import {useUserDevices} from '../../../hooks/useUserDevices';
import type {UserDevice} from '../../../lib/userDevices';
import {queryKeys} from '../../../lib/queryKeys';
import {updateDeviceSettings} from '../../../lib/deviceSettings';

type SectionKey = 'Account' | 'Session' | 'Device' | 'Time Format' | 'Notifications' | 'Privacy';

const SECTIONS: {key: SectionKey; label: string; icon: keyof typeof Ionicons.glyphMap; iconBg: string; iconColor: string}[] = [
  {key: 'Account',       label: 'Account',        icon: 'person-outline',          iconBg: settingsSectionColors.account.bg,       iconColor: settingsSectionColors.account.fg},
  {key: 'Device',        label: 'Device',          icon: 'hardware-chip-outline',   iconBg: settingsSectionColors.device.bg,        iconColor: settingsSectionColors.device.fg},
  {key: 'Time Format',   label: 'Time Format',     icon: 'time-outline',            iconBg: settingsSectionColors.timeFormat.bg,    iconColor: settingsSectionColors.timeFormat.fg},
  {key: 'Notifications', label: 'Notifications',   icon: 'notifications-outline',   iconBg: settingsSectionColors.notifications.bg, iconColor: settingsSectionColors.notifications.fg},
  {key: 'Privacy',       label: 'Privacy & Legal', icon: 'shield-checkmark-outline',iconBg: settingsSectionColors.privacy.bg,       iconColor: settingsSectionColors.privacy.fg},
  {key: 'Session',       label: 'Session',        icon: 'log-out-outline',         iconBg: settingsSectionColors.session.bg,       iconColor: settingsSectionColors.session.fg},
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{debug?: string}>();
  const {deviceId, disconnectDevice, signOut, deleteAccount, user, currentProvider, displayCount} = useAuth();
  const {state: appState} = useAppState();
  const {devices} = useUserDevices();
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isChangingWifi, setIsChangingWifi] = useState(false);
  const [deviceNameDraft, setDeviceNameDraft] = useState('');
  const [deviceNotice, setDeviceNotice] = useState<{kind: 'success' | 'error'; text: string} | null>(null);
  const [timeFormat, setTimeFormat] = useState<'ampm' | '24h'>('ampm');
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const [scrollContentHeight, setScrollContentHeight] = useState(0);
  const currentDeviceId = deviceId ?? appState.deviceId;
  const currentDevice = devices.find((device: UserDevice) => device.deviceId === currentDeviceId) ?? null;
  const isDeviceOnline = appState.deviceStatus === 'pairedOnline';
  const showDeviceDebug = params.debug === 'device';
  const scrollEnabled = scrollContentHeight > scrollViewportHeight + 1;
  const displayCountLabel = `${displayCount} ${displayCount === 1 ? 'display' : 'displays'}`;

  useEffect(() => {
    setDeviceNameDraft(currentDevice?.name ?? 'My Device');
  }, [currentDevice?.deviceId, currentDevice?.name]);

  const renameDeviceMutation = useMutation({
    mutationFn: async () => {
      if (!currentDeviceId) throw new Error('No device selected');
      const nextName = deviceNameDraft.trim() || 'My Device';
      await updateDeviceSettings(currentDeviceId, {
        deviceId: currentDeviceId,
        name: nextName,
        timezone: currentDevice?.timezone ?? 'UTC',
        quietHoursStart: currentDevice?.quietHoursStart ?? null,
        quietHoursEnd: currentDevice?.quietHoursEnd ?? null,
        quietHoursDays: currentDevice?.quietHoursDays ?? [],
      });
    },
    onSuccess: async () => {
      setDeviceNotice({kind: 'success', text: 'Display name updated.'});
      await queryClient.invalidateQueries({queryKey: queryKeys.user.devices});
      if (currentDeviceId) {
        await queryClient.invalidateQueries({queryKey: queryKeys.deviceSettings(currentDeviceId)});
      }
    },
    onError: (error) => {
      setDeviceNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Could not update display name.',
      });
    },
  });

  useEffect(() => {
    if (showDeviceDebug) {
      setOpenSection('Device');
    }
  }, [showDeviceDebug]);

  const toggle = (key: SectionKey) =>
    setOpenSection(prev => (prev === key ? null : key));

  const handleSignOut = async () => {
    if (isSigningOut || isDeleting) return;
    setIsSigningOut(true);
    try {
      await signOut();
      logger.info('User signed out', {userId: user?.id});
    } catch (e: unknown) {
      logger.error('Sign-out failed', {userId: user?.id, error: e instanceof Error ? e.message : String(e)});
      setIsSigningOut(false);
    }
  };

  const handleDeleteAccount = () => {
    const providerName = currentProvider === 'apple' ? 'Apple' : 'Google';
    Alert.alert(
      'Delete Account',
      `This will permanently delete your account and remove all association with ${providerName}. This cannot be undone.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteAccount();
              logger.info('User deleted account', {userId: user?.id});
            } catch (e: unknown) {
              logger.error('Delete account failed', {userId: user?.id, error: e instanceof Error ? e.message : String(e)});
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  const runUnpairDevice = async (targetDeviceId: string) => {
    setIsDisconnecting(true);
    setDeviceNotice(null);
    try {
      const result = await disconnectDevice(targetDeviceId);
      if (!result.ok) {
        logger.error('Device unpair failed', {userId: user?.id, deviceId: targetDeviceId, error: result.error});
        setDeviceNotice({kind: 'error', text: result.error});
        return;
      }
      logger.info('Device unpaired', {userId: user?.id, deviceId: targetDeviceId});
      if (result.deviceIds.length === 0) { router.replace('/ble-provision'); return; }
      setDeviceNotice({kind: 'success', text: `Unpaired. Switched to device ${result.deviceIds[0]}.`});
    } finally {
      setIsDisconnecting(false);
    }
  };

  const runChangeWifiNetwork = async (targetDeviceId: string) => {
    setIsChangingWifi(true);
    setDeviceNotice(null);
    try {
      const result = await resetDeviceWifi(targetDeviceId);
      if (!result.ok) {
        logger.error('Device Wi-Fi change failed', {userId: user?.id, deviceId: targetDeviceId, error: result.error});
        setDeviceNotice({kind: 'error', text: result.error});
        return;
      }
      logger.info('Device Wi-Fi change started', {userId: user?.id, deviceId: targetDeviceId, deviceOnline: result.deviceOnline});
      const offlineParam = result.deviceOnline ? '' : '&offline=true';
      router.push(`/ble-provision?deviceId=${encodeURIComponent(targetDeviceId)}&mode=change-wifi${offlineParam}`);
    } finally {
      setIsChangingWifi(false);
    }
  };

  const confirmChangeWifiNetwork = () => {
    if (!currentDeviceId || isChangingWifi || isDisconnecting) return;
    const message = isDeviceOnline
      ? 'The display will enter setup mode so you can choose a new network.'
      : 'Your display is offline. It will enter setup mode automatically within 2 minutes so you can connect it to a new network.';
    Alert.alert('Change Wi-Fi network?', message, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Continue', onPress: () => { void runChangeWifiNetwork(currentDeviceId); }},
    ]);
  };

  const confirmUnpairDevice = () => {
    if (!currentDeviceId || isDisconnecting || isChangingWifi) return;
    Alert.alert(
      'Unpair display?',
      "This will reset your display's Wi-Fi and put it back into setup mode.",
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Unpair', style: 'destructive', onPress: () => { void runUnpairDevice(currentDeviceId); }},
      ],
    );
  };

  const getSectionValue = (key: SectionKey): string => {
    switch (key) {
      case 'Account': return user?.email ?? '-';
      case 'Session': return 'Manage';
      case 'Device': return displayCountLabel;
      case 'Time Format': return timeFormat === 'ampm' ? 'AM / PM' : '24-hour';
      case 'Notifications': return 'Enabled';
      case 'Privacy': return 'View';
    }
  };

  return (
    <TabScreen style={[styles.container, {paddingTop: insets.top}]} tabRoute="/settings">
      <AppBrandHeader email={user?.email} />

      <ScrollView
        contentContainerStyle={[styles.scroll, styles.scrollContent]}
        bounces={false}
        scrollEnabled={scrollEnabled}
        onLayout={event => setScrollViewportHeight(event.nativeEvent.layout.height)}
        onContentSizeChange={(_, height) => setScrollContentHeight(height)}>

        {/* ── Page Title ───────────────────────────────────────────────── */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Settings</Text>
        </View>

        {/* ── Settings List ────────────────────────────────────────────── */}
        <View style={styles.listGroup}>
          {SECTIONS.map((section, index) => {
            const isOpen = openSection === section.key;
            const isLast = index === SECTIONS.length - 1;
            return (
              <View key={section.key}>
                <Pressable
                  style={[styles.listRow, !isLast && styles.listRowBorder]}
                  onPress={() => toggle(section.key)}
                >
                  <View style={[styles.iconBox, {backgroundColor: section.iconBg}]}>
                    <Ionicons name={section.icon} size={16} color={section.iconColor} />
                  </View>
                  <Text style={styles.rowTitle}>{section.label}</Text>
                  <Text style={styles.rowValue} numberOfLines={1}>{getSectionValue(section.key)}</Text>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={15}
                    color={colors.textMuted}
                  />
                </Pressable>

                {isOpen && (
                  <View style={[styles.expandedContent, !isLast && styles.listRowBorder]}>
                    {section.key === 'Account' && (
                      <>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Email</Text>
                          <Text style={styles.detailValue}>{user?.email ?? '-'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Displays</Text>
                          <Text style={styles.detailValue}>{displayCountLabel}</Text>
                        </View>
                      </>
                    )}

                    {section.key === 'Session' && (
                      <>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Signed in with</Text>
                          <Text style={styles.detailValue}>
                            {currentProvider === 'apple' ? 'Apple' : currentProvider === 'google' ? 'Google' : '-'}
                          </Text>
                        </View>
                        <Pressable
                          style={styles.destructiveButton}
                          onPress={handleSignOut}
                          disabled={isSigningOut || isDeleting}>
                          <Text style={styles.destructiveButtonText}>
                            {isSigningOut ? 'Signing out…' : 'Sign out'}
                          </Text>
                        </Pressable>
                        <Pressable style={styles.ghostButton} onPress={handleDeleteAccount} disabled={isDeleting || isSigningOut}>
                          <Text style={styles.ghostButtonText}>
                            {isDeleting ? 'Deleting…' : 'Delete account'}
                          </Text>
                        </Pressable>
                      </>
                    )}

                    {section.key === 'Device' && (
                      <>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Linked displays</Text>
                          <Text style={styles.detailValue}>{displayCountLabel}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Selected display</Text>
                          <Text style={styles.detailValue}>{currentDevice?.name ?? currentDeviceId ?? 'No device paired'}</Text>
                        </View>
                        {currentDeviceId ? (
                          <View style={styles.renameBlock}>
                            <Text style={styles.detailLabel}>Display name</Text>
                            <View style={styles.renameRow}>
                              <TextInput
                                value={deviceNameDraft}
                                onChangeText={setDeviceNameDraft}
                                placeholder="My Device"
                                placeholderTextColor={colors.textMuted}
                                style={styles.renameInput}
                                editable={!renameDeviceMutation.isPending}
                              />
                              <Pressable
                                style={[styles.renameSaveButton, renameDeviceMutation.isPending && styles.buttonDisabled]}
                                onPress={() => renameDeviceMutation.mutate()}
                                disabled={renameDeviceMutation.isPending}>
                                <Text style={styles.renameSaveButtonText}>
                                  {renameDeviceMutation.isPending ? 'Saving…' : 'Save'}
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : null}
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Status</Text>
                          <View style={styles.statusValue}>
                            {currentDeviceId ? (
                              <View style={[styles.statusDot, {backgroundColor: isDeviceOnline ? colors.success : colors.dangerText}]} />
                            ) : null}
                            <Text style={styles.detailValue}>{currentDeviceId ? (isDeviceOnline ? 'Online' : 'Offline') : 'No device paired'}</Text>
                          </View>
                        </View>
                        {showDeviceDebug ? (
                          <View style={styles.debugSection}>
                            <Text style={styles.debugLabel}>Debug</Text>
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Hardware ID</Text>
                              <Text style={styles.detailValue}>{currentDeviceId ?? '-'}</Text>
                            </View>
                          </View>
                        ) : null}
                        {deviceNotice ? (
                          <Text style={[styles.notice, deviceNotice.kind === 'error' ? styles.noticeError : styles.noticeSuccess]}>
                            {deviceNotice.text}
                          </Text>
                        ) : null}
                        {currentDeviceId ? (
                          <Pressable
                            style={[styles.secondaryActionButton, (isChangingWifi || isDisconnecting) && styles.buttonDisabled]}
                            onPress={confirmChangeWifiNetwork}
                            disabled={isChangingWifi || isDisconnecting}>
                            <Text style={styles.secondaryActionButtonText}>
                              {isChangingWifi ? 'Starting setup…' : isDeviceOnline ? 'Change Wi-Fi network' : 'Display offline — reconnect Wi-Fi'}
                            </Text>
                          </Pressable>
                        ) : null}
                        {currentDeviceId ? (
                          <Pressable
                            style={[styles.destructiveButton, (isDisconnecting || isChangingWifi) && styles.buttonDisabled]}
                            onPress={confirmUnpairDevice}
                            disabled={isDisconnecting || isChangingWifi}>
                            <Text style={styles.destructiveButtonText}>
                              {isDisconnecting ? 'Unpairing…' : 'Unpair display'}
                            </Text>
                          </Pressable>
                        ) : null}
                      </>
                    )}

                    {section.key === 'Time Format' && (
                      <View style={styles.pillRow}>
                        <Pressable
                          style={[styles.pill, timeFormat === 'ampm' && styles.pillActive]}
                          onPress={() => setTimeFormat('ampm')}>
                          <Text style={[styles.pillText, timeFormat === 'ampm' && styles.pillTextActive]}>AM / PM</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.pill, timeFormat === '24h' && styles.pillActive]}
                          onPress={() => setTimeFormat('24h')}>
                          <Text style={[styles.pillText, timeFormat === '24h' && styles.pillTextActive]}>24-hour</Text>
                        </Pressable>
                      </View>
                    )}

                    {section.key === 'Notifications' && (
                      <>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Arrivals</Text>
                          <Text style={styles.detailValue}>Enabled</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Offline alerts</Text>
                          <Text style={styles.detailValue}>Enabled</Text>
                        </View>
                      </>
                    )}

                    {section.key === 'Privacy' && (
                      <>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Permissions</Text>
                          <Text style={styles.detailValue}>Location, Notifications</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Terms</Text>
                          <Text style={styles.detailValue}>View terms of service</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Privacy</Text>
                          <Text style={styles.detailValue}>View privacy policy</Text>
                        </View>
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

      </ScrollView>

    </TabScreen>
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
  scrollContent: {
    flexGrow: 1,
  },

  // ─── Page Title ───────────────────────────────────────────────────────────
  pageHeader: {
    paddingTop: 0,
    paddingBottom: spacing.sm,
  },
  pageTitle: {
    color: colors.text,
    fontSize: typography.pageTitle,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 33,
  },

  // ─── Settings List ────────────────────────────────────────────────────────
  listGroup: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.tabHeight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  listRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBox: {
    width: layout.chromeSize,
    height: layout.chromeSize,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rowValue: {
    color: colors.textMuted,
    fontSize: 13,
    maxWidth: 120,
    textAlign: 'right',
  },

  // ─── Expanded Content ─────────────────────────────────────────────────────
  expandedContent: {
    paddingLeft: spacing.md + layout.chromeSize + spacing.sm,
    paddingRight: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.card,
  },

  // ─── Detail Rows ──────────────────────────────────────────────────────────
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {color: colors.textMuted, fontSize: 13},
  detailValue: {color: colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right'},
  statusValue: {flexDirection: 'row', alignItems: 'center', gap: 6},
  statusDot: {width: 8, height: 8, borderRadius: 4},
  debugSection: {
    gap: spacing.xs,
  },
  debugLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
  },

  // ─── Pills ────────────────────────────────────────────────────────────────
  pillRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs},
  pill: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pillActive: {borderColor: colors.accent, backgroundColor: colors.accentMuted},
  pillText: {color: colors.text, fontSize: 12, fontWeight: '700'},
  pillTextActive: {color: colors.accent},

  // ─── City Cards ───────────────────────────────────────────────────────────
  cityGrid: {gap: spacing.sm},
  cityCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: spacing.xs,
    position: 'relative',
    overflow: 'hidden',
  },
  cityCardActive: {borderColor: colors.accent, backgroundColor: colors.accentMuted},
  cityBadge: {
    alignSelf: 'flex-start',
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  cityBadgeText: {fontSize: 10, fontWeight: '900', letterSpacing: 0.4},
  cityCardTitle: {color: colors.text, fontSize: typography.body, fontWeight: '800'},
  cityCardBody: {color: colors.textMuted, fontSize: typography.caption, lineHeight: 16, paddingRight: spacing.sm},
  cityCardAccent: {position: 'absolute', right: 0, top: 0, bottom: 0, width: 4},

  // ─── Buttons ──────────────────────────────────────────────────────────────
  destructiveButton: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    minHeight: layout.buttonHeight,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  destructiveButtonText: {color: colors.dangerText, fontWeight: '700', fontSize: typography.body},
  secondaryActionButton: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    minHeight: layout.buttonHeight,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  secondaryActionButtonText: {color: colors.text, fontWeight: '700', fontSize: typography.body},
  ghostButton: {minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md},
  ghostButtonText: {color: colors.textMuted, fontWeight: '600', fontSize: typography.label},
  renameBlock: {
    gap: spacing.xs,
  },
  renameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  renameInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontSize: 13,
  },
  renameSaveButton: {
    minHeight: 40,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renameSaveButtonText: {
    color: colors.onAccent,
    fontSize: 13,
    fontWeight: '700',
  },
  buttonDisabled: {opacity: 0.5},

  // ─── Notices ─────────────────────────────────────────────────────────────
  notice: {fontSize: 12, lineHeight: 18},
  noticeError: {color: colors.dangerText},
  noticeSuccess: {color: colors.successText},
});
