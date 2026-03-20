import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {BottomNav, BottomNavItem} from '../../../components/BottomNav';
import {colors, spacing, radii} from '../../../theme';
import {useAuth} from '../../../state/authProvider';
import {useAppState} from '../../../state/appState';
import {CITY_BRANDS, CITY_LABELS, CITY_OPTIONS} from '../../../constants/cities';

const navItems: BottomNavItem[] = [
  {key: 'home', label: 'Home', icon: 'home-outline', route: '/dashboard'},
  {key: 'presets', label: 'Displays', icon: 'albums-outline', route: '/presets'},
  {key: 'settings', label: 'Settings', icon: 'settings-outline', route: '/settings'},
];

export default function SettingsScreen() {
  const router = useRouter();
  const {signOut, user} = useAuth();
  const {state: appState, setSelectedCity} = useAppState();
  const [openSection, setOpenSection] = useState<string | null>('Account');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [timeFormat, setTimeFormat] = useState<'ampm' | '24h'>('ampm');

  const toggleSection = (key: string) =>
    setOpenSection(prev => (prev === key ? null : key));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.body}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Settings</Text>
          </View>

          <Pressable style={styles.card} onPress={() => toggleSection('Account')}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Account</Text>
                <Text style={styles.cardSubtitle}>Profile, email, security</Text>
              </View>
              <Ionicons
                name={openSection === 'Account' ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </View>
            {openSection === 'Account' ? (
              <View style={styles.cardContent}>
                <Text style={styles.itemLabel}>Email</Text>
                <Text style={styles.itemValue}>{user?.email ?? '-'}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable style={styles.card} onPress={() => toggleSection('Device')}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Device</Text>
                <Text style={styles.cardSubtitle}>Pairing, Wi‑Fi, display name</Text>
              </View>
              <Ionicons
                name={openSection === 'Device' ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </View>
            {openSection === 'Device' ? (
              <View style={styles.cardContent}>
                <Text style={styles.itemLabel}>Device ID</Text>
                <Text style={styles.itemValue}>{appState.deviceId ?? '-'}</Text>
                <Text style={styles.itemLabel}>Status</Text>
                <Text style={styles.itemValue}>{appState.deviceId ? 'Paired' : 'No device paired'}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable style={styles.card} onPress={() => toggleSection('City')}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>City</Text>
                <Text style={styles.cardSubtitle}>Default transit city for displays and home preview</Text>
              </View>
              <Ionicons
                name={openSection === 'City' ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </View>
            {openSection === 'City' ? (
              <View style={styles.cardContent}>
                <View style={styles.cityPillRow}>
                  {CITY_OPTIONS.map(city => {
                    const active = city.id === appState.selectedCity;
                    return (
                      <Pressable
                        key={city.id}
                        style={[styles.cityPill, active && styles.cityPillActive]}
                        onPress={() => setSelectedCity(city.id)}>
                        <Text style={[styles.cityPillText, active && styles.cityPillTextActive]}>{city.shortLabel}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.cityPreviewGrid}>
                  {CITY_OPTIONS.map(city => {
                    const active = city.id === appState.selectedCity;
                    const brand = CITY_BRANDS[city.id];
                    return (
                      <Pressable
                        key={`${city.id}-preview`}
                        style={[styles.cityPreviewCard, active && styles.cityPreviewCardActive]}
                        onPress={() => setSelectedCity(city.id)}>
                        <View style={[styles.cityPreviewBadge, {backgroundColor: brand.badgeBg, borderColor: brand.badgeBorder}]}>
                          <Text style={[styles.cityPreviewBadgeText, {color: brand.badgeText}]}>{city.agencyCode}</Text>
                        </View>
                        <Text style={styles.cityPreviewTitle}>{city.label}</Text>
                        <Text style={styles.cityPreviewBody} numberOfLines={2}>
                          {city.description}
                        </Text>
                        <View style={[styles.cityPreviewAccent, {backgroundColor: brand.accent}]} />
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.itemLabel}>Current selection</Text>
                <Text style={styles.itemValue}>{CITY_LABELS[appState.selectedCity]}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable style={styles.card} onPress={() => toggleSection('Notifications')}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Notifications</Text>
                <Text style={styles.cardSubtitle}>Arrival alerts and status updates</Text>
              </View>
              <Ionicons
                name={openSection === 'Notifications' ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </View>
            {openSection === 'Notifications' ? (
              <View style={styles.cardContent}>
                <Text style={styles.itemLabel}>Arrivals</Text>
                <Text style={styles.itemValue}>Enabled</Text>
                <Text style={styles.itemLabel}>Offline alerts</Text>
                <Text style={styles.itemValue}>Enabled</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable style={styles.card} onPress={() => toggleSection('Time Format')}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Time Format</Text>
                <Text style={styles.cardSubtitle}>Choose how times are shown across the app</Text>
              </View>
              <Ionicons
                name={openSection === 'Time Format' ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </View>
            {openSection === 'Time Format' ? (
              <View style={styles.cardContent}>
                <View style={styles.cityPillRow}>
                  <Pressable
                    style={[styles.cityPill, timeFormat === 'ampm' && styles.cityPillActive]}
                    onPress={() => setTimeFormat('ampm')}>
                    <Text style={[styles.cityPillText, timeFormat === 'ampm' && styles.cityPillTextActive]}>AM / PM</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.cityPill, timeFormat === '24h' && styles.cityPillActive]}
                    onPress={() => setTimeFormat('24h')}>
                    <Text style={[styles.cityPillText, timeFormat === '24h' && styles.cityPillTextActive]}>24-hour</Text>
                  </Pressable>
                </View>
                <Text style={styles.itemLabel}>Current format</Text>
                <Text style={styles.itemValue}>{timeFormat === 'ampm' ? 'AM / PM' : '24-hour'}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable style={styles.card} onPress={() => toggleSection('Privacy')}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Privacy & Legal</Text>
                <Text style={styles.cardSubtitle}>Permissions, terms, privacy policy</Text>
              </View>
              <Ionicons
                name={openSection === 'Privacy' ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </View>
            {openSection === 'Privacy' ? (
              <View style={styles.cardContent}>
                <Text style={styles.itemLabel}>Permissions</Text>
                <Text style={styles.itemValue}>Location, Notifications</Text>
                <Text style={styles.itemLabel}>Terms</Text>
                <Text style={styles.itemValue}>View terms of service</Text>
                <Text style={styles.itemLabel}>Privacy</Text>
                <Text style={styles.itemValue}>View privacy policy</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable style={styles.card} onPress={() => toggleSection('Sign out')}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Sign out</Text>
                <Text style={styles.cardSubtitle}>End your session on this device</Text>
              </View>
              <Ionicons
                name={openSection === 'Sign out' ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </View>
            {openSection === 'Sign out' ? (
              <View style={styles.cardContent}>
                <Text style={styles.itemLabel}>You’re signed in as</Text>
                <Text style={styles.itemValue}>{user?.email ?? '-'}</Text>
                <Pressable
                  style={styles.signOutButton}
                  onPress={async () => {
                    if (isSigningOut) return;
                    setIsSigningOut(true);
                    try {
                      await signOut();
                    } finally {
                      setIsSigningOut(false);
                      router.replace('/auth');
                    }
                  }}>
                  <Text style={styles.signOutText}>{isSigningOut ? 'Signing out...' : 'Sign out'}</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        </ScrollView>

        <BottomNav items={navItems} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  body: {flex: 1},
  scroll: {flex: 1},
  content: {padding: spacing.lg},
  headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  title: {color: colors.text, fontSize: 22, fontWeight: '800'},
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  cardHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  cardTitle: {color: colors.text, fontSize: 15, fontWeight: '700'},
  cardSubtitle: {color: colors.textMuted, fontSize: 12, marginTop: 4},
  cardContent: {marginTop: spacing.sm, gap: 6},
  itemLabel: {color: colors.textMuted, fontSize: 12},
  itemValue: {color: colors.text, fontSize: 13, fontWeight: '600'},
  cityPillRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs},
  cityPill: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  cityPillActive: {borderColor: colors.accent, backgroundColor: colors.accentMuted},
  cityPillText: {color: colors.text, fontSize: 12, fontWeight: '700'},
  cityPillTextActive: {color: colors.accent},
  cityPreviewGrid: {marginTop: spacing.xs, gap: spacing.xs},
  cityPreviewCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  cityPreviewCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  cityPreviewBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cityPreviewBadgeText: {fontSize: 10, fontWeight: '900', letterSpacing: 0.4},
  cityPreviewTitle: {color: colors.text, fontSize: 13, fontWeight: '800'},
  cityPreviewBody: {color: colors.textMuted, fontSize: 11, lineHeight: 15, paddingRight: 12},
  cityPreviewAccent: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  signOutButton: {
    marginTop: spacing.sm,
    backgroundColor: '#2B1010',
    borderColor: '#5B1C1C',
    borderWidth: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  signOutText: {color: '#FCA5A5', fontWeight: '700', fontSize: 13},
});
