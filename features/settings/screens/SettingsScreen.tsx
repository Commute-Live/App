import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {BottomNav, BottomNavItem} from '../../../components/BottomNav';
import {colors, spacing, radii} from '../../../theme';
import {useAuth} from '../../../state/authProvider';

const navItems: BottomNavItem[] = [
  {key: 'home', label: 'Home', icon: 'home-outline', route: '/dashboard'},
  {key: 'stations', label: 'Stations', icon: 'train-outline', route: '/edit-stations'},
  {key: 'layout', label: 'Layout', icon: 'color-palette-outline', route: '/change-layout'},
  {key: 'bright', label: 'Bright', icon: 'sunny-outline', route: '/brightness'},
];

export default function SettingsScreen() {
  const router = useRouter();
  const {signOut, user} = useAuth();
  const [openSection, setOpenSection] = useState<string | null>('Account');
  const [isSigningOut, setIsSigningOut] = useState(false);

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
                <Text style={styles.itemLabel}>Name</Text>
                <Text style={styles.itemValue}>Alex Johnson</Text>
                <Text style={styles.itemLabel}>Email</Text>
                <Text style={styles.itemValue}>alex@example.com</Text>
                <Text style={styles.itemLabel}>Password</Text>
                <Text style={styles.itemValue}>Last updated 2 weeks ago</Text>
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
                <Text style={styles.itemLabel}>Device name</Text>
                <Text style={styles.itemValue}>Device 1</Text>
                <Text style={styles.itemLabel}>Wi‑Fi</Text>
                <Text style={styles.itemValue}>CommuteLive-Home</Text>
                <Text style={styles.itemLabel}>Status</Text>
                <Text style={styles.itemValue}>Online</Text>
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
