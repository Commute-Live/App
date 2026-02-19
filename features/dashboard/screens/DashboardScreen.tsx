import React, {useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {BottomNav, BottomNavItem} from '../../../components/BottomNav';
import {colors, spacing, radii} from '../../../theme';
import {useSelectedDevice} from '../../../hooks/useSelectedDevice';
import NycSubwayConfig from '../components/NycSubwayConfig';
import ChicagoSubwayConfig from '../components/ChicagoSubwayConfig';
import RegionalTransitConfig from '../components/RegionalTransitConfig';
import {apiFetch} from '../../../lib/api';
import {useAuth} from '../../../state/authProvider';

type CityOption = {id: 'new-york' | 'philadelphia' | 'boston' | 'chicago'; label: string};
type ModeOption = {id: 'train' | 'bus'; label: string};

const cityOptions: CityOption[] = [
  {id: 'new-york', label: 'New York'},
  {id: 'philadelphia', label: 'Philly'},
  {id: 'boston', label: 'Boston'},
  {id: 'chicago', label: 'Chicago'},
];
const modeOptions: ModeOption[] = [
  {id: 'train', label: 'Train'},
  {id: 'bus', label: 'Bus'},
];

const navItems: BottomNavItem[] = [
  {key: 'stations', label: 'Stations', icon: 'train-outline', route: '/edit-stations'},
  {key: 'layout', label: 'Layout', icon: 'color-palette-outline', route: '/change-layout'},
  {key: 'bright', label: 'Bright', icon: 'sunny-outline', route: '/brightness'},
  {key: 'settings', label: 'Settings', icon: 'settings-outline', route: '/settings'},
];

export default function DashboardScreen() {
  const router = useRouter();
  const {deviceId, deviceIds, setDeviceId} = useAuth();
  const hasLinkedDevice = deviceIds.length > 0;
  const selectedDevice = useSelectedDevice();
  const [selectedCity, setSelectedCity] = useState<CityOption['id']>('new-york');
  const [selectedMode, setSelectedMode] = useState<ModeOption['id']>('train');

  useEffect(() => {
    if (!deviceId && deviceIds.length > 0) {
      setDeviceId(deviceIds[0]);
    }
  }, [deviceId, deviceIds, setDeviceId]);

  useEffect(() => {
    let cancelled = false;
    const loadProviderFromConfig = async () => {
      try {
        const response = await apiFetch(`/device/${selectedDevice.id}/config`);
        if (!response.ok) return;
        const data = await response.json();
        const firstProvider = typeof data?.config?.lines?.[0]?.provider === 'string' ? data.config.lines[0].provider : '';

        if (cancelled) return;
        if (firstProvider === 'mta-subway' || firstProvider === 'mta') {
          setSelectedCity('new-york');
          setSelectedMode('train');
          return;
        }
        if (firstProvider === 'mta-bus') {
          setSelectedCity('new-york');
          setSelectedMode('bus');
          return;
        }
        if (firstProvider === 'mbta') {
          setSelectedCity('boston');
          const firstLine = typeof data?.config?.lines?.[0]?.line === 'string' ? data.config.lines[0].line : '';
          const isBusLike = /^[0-9]/.test(firstLine.trim());
          setSelectedMode(isBusLike ? 'bus' : 'train');
          return;
        }
        if (firstProvider === 'cta-subway') {
          setSelectedCity('chicago');
          setSelectedMode('train');
          return;
        }
        if (firstProvider === 'septa-bus' || firstProvider === 'philly-bus') {
          setSelectedCity('philadelphia');
          setSelectedMode('bus');
          return;
        }
        if (firstProvider === 'septa-rail' || firstProvider === 'philly-rail') {
          setSelectedCity('philadelphia');
          setSelectedMode('train');
        }
      } catch {
        // Keep default provider.
      }
    };

    if (hasLinkedDevice && selectedDevice.id) {
      void loadProviderFromConfig();
    }

    return () => {
      cancelled = true;
    };
  }, [hasLinkedDevice, selectedDevice.id]);

  const availableModes = selectedCity === 'chicago' ? modeOptions.filter(m => m.id === 'train') : modeOptions;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.body}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <View style={styles.deviceHeaderCard}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.heading}>Your Device</Text>
                <Text style={styles.subheading}>Device ID: {deviceId ?? 'Not connected'}</Text>
              </View>
              <View style={styles.statusChip}>
                <View
                  style={[
                    styles.statusDot,
                    selectedDevice.status === 'Online' ? styles.statusDotOnline : styles.statusDotOffline,
                  ]}
                />
                <Text style={styles.statusText}>{selectedDevice.status}</Text>
              </View>
            </View>
          </View>

          {!hasLinkedDevice ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>No Device Connected</Text>
              <Text style={styles.subheading}>
                Your account is ready. Add a Commute Live device when you are ready to configure routes.
              </Text>
              <Pressable style={styles.addDeviceButton} onPress={() => router.push('/register-device')}>
                <Text style={styles.addDeviceButtonText}>Add Device</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Pick City</Text>
                <View style={styles.providerRow}>
                  {cityOptions.map(option => (
                    <Pressable
                      key={option.id}
                      style={[styles.providerChip, selectedCity === option.id && styles.providerChipActive]}
                      onPress={() => setSelectedCity(option.id)}>
                      <Text
                        style={[styles.providerChipText, selectedCity === option.id && styles.providerChipTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.sectionTitle, styles.modeTitle]}>Pick Type</Text>
                <View style={styles.providerRow}>
                  {availableModes.map(option => (
                    <Pressable
                      key={option.id}
                      style={[styles.providerChip, selectedMode === option.id && styles.providerChipActive]}
                      onPress={() => setSelectedMode(option.id)}>
                      <Text
                        style={[styles.providerChipText, selectedMode === option.id && styles.providerChipTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {selectedCity === 'new-york' ? (
                <NycSubwayConfig
                  deviceId={selectedDevice.id}
                  providerId={selectedMode === 'bus' ? 'mta-bus' : 'mta-subway'}
                />
              ) : selectedCity === 'chicago' ? (
                <ChicagoSubwayConfig deviceId={selectedDevice.id} />
              ) : (
                <RegionalTransitConfig
                  deviceId={selectedDevice.id}
                  city={selectedCity === 'boston' ? 'boston' : 'philadelphia'}
                  mode={selectedMode}
                />
              )}
            </>
          )}
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
  deviceHeaderCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  heading: {color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 1},
  subheading: {color: colors.textMuted, fontSize: 10},
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
  },
  statusDot: {width: 6, height: 6, borderRadius: 3},
  statusDotOnline: {backgroundColor: colors.success},
  statusDotOffline: {backgroundColor: colors.warning},
  statusText: {color: colors.text, fontSize: 10, fontWeight: '700'},
  sectionCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.sm},
  modeTitle: {marginTop: spacing.sm},
  providerRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs},
  providerChip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  providerChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  providerChipText: {color: colors.text, fontSize: 12, fontWeight: '700'},
  providerChipTextActive: {color: colors.accent},
  addDeviceButton: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  addDeviceButtonText: {color: colors.background, fontWeight: '800', fontSize: 14},
});
