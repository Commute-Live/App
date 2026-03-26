import React, {useState} from 'react';
import {Alert, Image, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {colors, spacing, radii} from '../../../theme';
import {useAuth} from '../../../state/authProvider';
import {BottomNav, type BottomNavItem} from '../../../components/BottomNav';

const navItems: BottomNavItem[] = [
  {key: 'home', label: 'Home', icon: 'home-outline', route: '/dashboard'},
  {key: 'presets', label: 'Displays', icon: 'albums-outline', route: '/presets'},
  {key: 'settings', label: 'Settings', icon: 'settings-outline', route: '/settings'},
];
import {useAppState} from '../../../state/appState';
import {CITY_BRANDS, CITY_LABELS, CITY_OPTIONS} from '../../../constants/cities';


type SectionKey = 'Account' | 'Device' | 'City' | 'Time Format' | 'Notifications' | 'Privacy';

const SECTIONS: {key: SectionKey; label: string; icon: keyof typeof Ionicons.glyphMap; iconBg: string; iconColor: string}[] = [
  {key: 'Account',       label: 'Account',        icon: 'person-outline',          iconBg: '#1A2744', iconColor: '#6EA8FE'},
  {key: 'Device',        label: 'Device',          icon: 'hardware-chip-outline',   iconBg: '#1A2B1A', iconColor: '#6EE7B7'},
  {key: 'City',          label: 'City',            icon: 'map-outline',             iconBg: '#2B1F0E', iconColor: '#FCD34D'},
  {key: 'Time Format',   label: 'Time Format',     icon: 'time-outline',            iconBg: '#1E1A2B', iconColor: '#C4B5FD'},
  {key: 'Notifications', label: 'Notifications',   icon: 'notifications-outline',   iconBg: '#2B1A1A', iconColor: '#FCA5A5'},
  {key: 'Privacy',       label: 'Privacy & Legal', icon: 'shield-checkmark-outline',iconBg: '#1A2428', iconColor: '#67E8F9'},
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {deviceId, disconnectDevice, signOut, deleteAccount, user, currentProvider} = useAuth();
  const {state: appState, setSelectedCity} = useAppState();
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [deviceNotice, setDeviceNotice] = useState<{kind: 'success' | 'error'; text: string} | null>(null);
  const [timeFormat, setTimeFormat] = useState<'ampm' | '24h'>('ampm');
  const currentDeviceId = deviceId ?? appState.deviceId;

  const toggle = (key: SectionKey) =>
    setOpenSection(prev => (prev === key ? null : key));

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
            try { await deleteAccount(); } catch { setIsDeleting(false); }
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
      if (!result.ok) { setDeviceNotice({kind: 'error', text: result.error}); return; }
      if (result.deviceIds.length === 0) { router.replace('/ble-provision'); return; }
      setDeviceNotice({kind: 'success', text: `Unpaired. Switched to device ${result.deviceIds[0]}.`});
    } finally {
      setIsDisconnecting(false);
    }
  };

  const confirmUnpairDevice = () => {
    if (!currentDeviceId || isDisconnecting) return;
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
      case 'Device': return currentDeviceId ? 'Paired' : 'Not paired';
      case 'City': return CITY_LABELS[appState.selectedCity];
      case 'Time Format': return timeFormat === 'ampm' ? 'AM / PM' : '24-hour';
      case 'Notifications': return 'Enabled';
      case 'Privacy': return 'View';
    }
  };

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
                          <Text style={styles.detailLabel}>Signed in with</Text>
                          <Text style={styles.detailValue}>
                            {currentProvider === 'apple' ? 'Apple' : currentProvider === 'google' ? 'Google' : '-'}
                          </Text>
                        </View>
                        <Pressable
                          style={styles.destructiveButton}
                          onPress={async () => {
                            if (isSigningOut || isDeleting) return;
                            setIsSigningOut(true);
                            try { await signOut(); } catch { setIsSigningOut(false); }
                          }}>
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
                          <Text style={styles.detailLabel}>Device ID</Text>
                          <Text style={styles.detailValue}>{currentDeviceId ?? '-'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Status</Text>
                          <Text style={styles.detailValue}>{currentDeviceId ? 'Paired' : 'No device paired'}</Text>
                        </View>
                        {deviceNotice ? (
                          <Text style={[styles.notice, deviceNotice.kind === 'error' ? styles.noticeError : styles.noticeSuccess]}>
                            {deviceNotice.text}
                          </Text>
                        ) : null}
                        {currentDeviceId ? (
                          <Pressable
                            style={[styles.destructiveButton, isDisconnecting && styles.buttonDisabled]}
                            onPress={confirmUnpairDevice}
                            disabled={isDisconnecting}>
                            <Text style={styles.destructiveButtonText}>
                              {isDisconnecting ? 'Unpairing…' : 'Unpair display'}
                            </Text>
                          </Pressable>
                        ) : null}
                      </>
                    )}

                    {section.key === 'City' && (
                      <>
                        <View style={styles.pillRow}>
                          {CITY_OPTIONS.map(city => {
                            const active = city.id === appState.selectedCity;
                            return (
                              <Pressable
                                key={city.id}
                                style={[styles.pill, active && styles.pillActive]}
                                onPress={() => setSelectedCity(city.id)}>
                                <Text style={[styles.pillText, active && styles.pillTextActive]}>{city.shortLabel}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        <View style={styles.cityGrid}>
                          {CITY_OPTIONS.map(city => {
                            const active = city.id === appState.selectedCity;
                            const brand = CITY_BRANDS[city.id];
                            return (
                              <Pressable
                                key={`${city.id}-preview`}
                                style={[styles.cityCard, active && styles.cityCardActive]}
                                onPress={() => setSelectedCity(city.id)}>
                                <View style={[styles.cityBadge, {backgroundColor: brand.badgeBg, borderColor: brand.badgeBorder}]}>
                                  <Text style={[styles.cityBadgeText, {color: brand.badgeText}]}>{city.agencyCode}</Text>
                                </View>
                                <Text style={styles.cityCardTitle}>{city.label}</Text>
                                <Text style={styles.cityCardBody} numberOfLines={2}>{city.description}</Text>
                                <View style={[styles.cityCardAccent, {backgroundColor: brand.accent}]} />
                              </Pressable>
                            );
                          })}
                        </View>
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

      <BottomNav items={navItems} />
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
    gap: spacing.sm,
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

  // ─── Page Title ───────────────────────────────────────────────────────────
  pageHeader: {
    paddingTop: 0,
    paddingBottom: spacing.xs,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 33,
  },

  // ─── Settings List ────────────────────────────────────────────────────────
  listGroup: {
    gap: 0,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  listRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBox: {
    width: 32,
    height: 32,
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
    paddingLeft: 44,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },

  // ─── Detail Rows ──────────────────────────────────────────────────────────
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {color: colors.textMuted, fontSize: 13},
  detailValue: {color: colors.text, fontSize: 13, fontWeight: '600'},

  // ─── Pills ────────────────────────────────────────────────────────────────
  pillRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingTop: spacing.xs},
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
  cityGrid: {gap: spacing.xs},
  cityCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.sm,
    gap: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  cityCardActive: {borderColor: colors.accent, backgroundColor: colors.accentMuted},
  cityBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cityBadgeText: {fontSize: 10, fontWeight: '900', letterSpacing: 0.4},
  cityCardTitle: {color: colors.text, fontSize: 13, fontWeight: '800'},
  cityCardBody: {color: colors.textMuted, fontSize: 11, lineHeight: 15, paddingRight: 12},
  cityCardAccent: {position: 'absolute', right: 0, top: 0, bottom: 0, width: 4},

  // ─── Buttons ──────────────────────────────────────────────────────────────
  destructiveButton: {
    backgroundColor: '#2B1010',
    borderColor: '#5B1C1C',
    borderWidth: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  destructiveButtonText: {color: '#FCA5A5', fontWeight: '700', fontSize: 13},
  ghostButton: {paddingVertical: spacing.xs, alignItems: 'center'},
  ghostButtonText: {color: colors.textMuted, fontWeight: '600', fontSize: 12},
  buttonDisabled: {opacity: 0.5},

  // ─── Notices ─────────────────────────────────────────────────────────────
  notice: {fontSize: 12, lineHeight: 18},
  noticeError: {color: '#FCA5A5'},
  noticeSuccess: {color: colors.textMuted},
});
