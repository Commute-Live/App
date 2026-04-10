import React, {useEffect} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {useQuery} from '@tanstack/react-query';
import {ScreenHeader} from '../../../components/ScreenHeader';
import {colors, layout, radii, spacing, typography} from '../../../theme';
import {useAppState} from '../../../state/appState';
import {queryKeys} from '../../../lib/queryKeys';
import {supportsLocalDeviceSetup, unsupportedDeviceSetupMessage} from '../../../lib/deviceSetup';

export default function RegisterDeviceScreen() {
  const router = useRouter();
  const {state, setDeviceId} = useAppState();

  const heartbeatQuery = useQuery({
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
    enabled: supportsLocalDeviceSetup,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const deviceInfoQuery = useQuery({
    queryKey: queryKeys.espDeviceInfo,
    queryFn: async () => {
      const response = await fetch('http://192.168.4.1/device-info', {method: 'GET'});
      if (!response.ok) return null;
      const data = await response.json().catch(() => null);
      return data?.deviceId ? String(data.deviceId) : null;
    },
    enabled: supportsLocalDeviceSetup && heartbeatQuery.data === true && !state.deviceId,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const status: 'checking' | 'connected' | 'disconnected' =
    heartbeatQuery.isPending || heartbeatQuery.isFetching
      ? 'checking'
      : heartbeatQuery.data
        ? 'connected'
        : 'disconnected';

  useEffect(() => {
    if (!deviceInfoQuery.data) return;
    setDeviceId(deviceInfoQuery.data);
  }, [deviceInfoQuery.data, setDeviceId]);

  const checkConnection = () => {
    void heartbeatQuery.refetch().then(result => {
      if (result.data === true) {
        void deviceInfoQuery.refetch();
      }
    });
  };

  if (!supportsLocalDeviceSetup) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ScreenHeader title="Connect your device" />
        <View style={styles.unsupportedWrap}>
          <View style={styles.unsupportedCard}>
            <Text style={styles.title}>Use the mobile app for setup</Text>
            <Text style={styles.subtitle}>{unsupportedDeviceSetupMessage}</Text>
          </View>
          <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Connect your device" />
      <View style={styles.content}>
        <View style={styles.heroSection}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
          <View style={styles.heroCopy}>
            <Text style={styles.title}>Connect your device</Text>
            <Text style={styles.subtitle}>
              Power on the device, connect to its Wi‑Fi, then register it below.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.stepRow}>
            <View style={styles.stepIndex}>
              <Text style={styles.stepIndexText}>1</Text>
            </View>
            <View style={styles.stepTextWrap}>
              <Text style={styles.stepTitle}>Power on the display</Text>
              <Text style={styles.stepSubtitle}>Plug it in and wait for the setup Wi‑Fi.</Text>
            </View>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepIndex}>
              <Text style={styles.stepIndexText}>2</Text>
            </View>
            <View style={styles.stepTextWrap}>
              <Text style={styles.stepTitle}>Connect in Settings</Text>
              <Text style={styles.stepSubtitle}>
                Go to your phone settings and connect to the Wi‑Fi that starts with CommuteLive.
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.statusCard, status === 'connected' && styles.statusCardConnected]}>
          <View style={styles.statusHeader}>
            <View style={styles.statusTitleRow}>
              <View
                style={[
                  styles.statusDot,
                  status === 'connected'
                    ? styles.statusDotConnected
                    : status === 'disconnected'
                      ? styles.statusDotDisconnected
                      : styles.statusDotChecking,
                ]}
              />
              <Text style={styles.statusLabel}>Connection status</Text>
            </View>
            <Pressable onPress={checkConnection}>
              <Text style={styles.statusAction}>Check again</Text>
            </Pressable>
          </View>
          <Text style={styles.statusText}>
            {status === 'checking'
              ? 'Checking for CommuteLive Wi‑Fi...'
              : status === 'connected'
                ? 'Connected to CommuteLive Wi‑Fi'
                : 'Not connected to CommuteLive Wi‑Fi'}
          </Text>
        </View>

        <View style={styles.actionGroup}>
          <Pressable
            style={[
              styles.primaryButton,
              status !== 'connected' && styles.primaryButtonDisabled,
            ]}
            disabled={status !== 'connected'}
            onPress={() => router.push('/setup-intro')}
          >
            <Text
              style={[
                styles.primaryText,
                status !== 'connected' && styles.primaryTextDisabled,
              ]}
            >
              Register your device
            </Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryText}>Back</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {flex: 1, padding: layout.screenPadding, alignItems: 'stretch', gap: layout.screenGap},
  heroSection: {alignItems: 'center', gap: spacing.sm},
  heroCopy: {alignItems: 'center', gap: spacing.xs},
  logo: {width: 176, height: 176, marginTop: spacing.xs},
  title: {color: colors.text, fontSize: typography.titleLg, fontWeight: '800', textAlign: 'center'},
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: layout.cardPaddingLg,
    gap: spacing.md,
  },
  statusCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: layout.cardPaddingLg,
    gap: spacing.sm,
  },
  statusCardConnected: {borderColor: colors.accent},
  statusHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  statusTitleRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  statusLabel: {color: colors.textMuted, fontSize: typography.label},
  statusAction: {color: colors.accent, fontSize: typography.label, fontWeight: '700'},
  statusText: {color: colors.text, fontWeight: '700', marginTop: spacing.xs, textAlign: 'center'},
  statusDot: {width: 10, height: 10, borderRadius: 5},
  statusDotConnected: {backgroundColor: colors.success},
  statusDotDisconnected: {backgroundColor: colors.warning},
  statusDotChecking: {backgroundColor: colors.textMuted},
  stepRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  stepIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  stepIndexText: {color: colors.text, fontWeight: '700', fontSize: typography.label},
  stepTextWrap: {flex: 1, alignItems: 'flex-start', gap: spacing.xxs},
  stepTitle: {color: colors.text, fontWeight: '700'},
  stepSubtitle: {color: colors.textMuted, fontSize: typography.label, lineHeight: 18},
  actionGroup: {gap: spacing.sm},
  primaryButton: {
    backgroundColor: colors.accent,
    minHeight: layout.buttonHeight,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryText: {color: colors.onAccent, fontWeight: '800', fontSize: typography.bodyLg},
  primaryButtonDisabled: {backgroundColor: colors.border},
  primaryTextDisabled: {color: colors.textMuted},
  secondaryButton: {
    borderColor: colors.border,
    borderWidth: 1,
    minHeight: layout.buttonHeight,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  secondaryText: {color: colors.textMuted, fontWeight: '700', fontSize: typography.bodyLg},
  unsupportedWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: layout.screenPadding,
    gap: spacing.md,
  },
  unsupportedCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: layout.cardPaddingLg,
    gap: spacing.sm,
  },
});
