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
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader title="Connect your device" />
        <View style={styles.unsupportedWrap}>
          <View style={styles.unsupportedCard}>
            <Text style={styles.unsupportedTitle}>Use the mobile app for setup</Text>
            <Text style={styles.unsupportedText}>{unsupportedDeviceSetupMessage}</Text>
          </View>
          <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isConnected = status === 'connected';
  const isChecking = status === 'checking';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title="Connect your device" />

      <View style={styles.content}>
        <View style={styles.heroSection}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
          <View style={styles.heroCopy}>
            <Text style={styles.title}>Connect your device</Text>
            <Text style={styles.subtitle}>
              Power on the display, join its Wi‑Fi, then register below.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <StepRow index={1} title="Power on the display" subtitle="Plug it in and wait for the setup Wi‑Fi to appear." />
          <View style={styles.stepDivider} />
          <StepRow index={2} title="Connect in Settings" subtitle="Go to your phone Settings → Wi‑Fi and connect to the network starting with CommuteLive." />
        </View>

        <View style={[styles.statusCard, isConnected && styles.statusCardConnected]}>
          <View style={styles.statusHeader}>
            <View style={styles.statusTitleRow}>
              <View style={[
                styles.statusDot,
                isConnected ? styles.statusDotConnected : isChecking ? styles.statusDotChecking : styles.statusDotDisconnected,
              ]} />
              <Text style={styles.statusLabel}>Wi‑Fi connection</Text>
            </View>
            <Pressable onPress={checkConnection} hitSlop={8}>
              <Text style={styles.statusAction}>Check again</Text>
            </Pressable>
          </View>
          <Text style={[styles.statusText, isConnected && styles.statusTextConnected]}>
            {isChecking
              ? 'Checking for CommuteLive Wi‑Fi...'
              : isConnected
                ? 'Connected to CommuteLive Wi‑Fi'
                : 'Not connected — check your Wi‑Fi settings'}
          </Text>
        </View>

        <View style={styles.actionGroup}>
          <Pressable
            style={[styles.primaryButton, !isConnected && styles.primaryButtonDisabled]}
            disabled={!isConnected}
            onPress={() => router.push('/setup-intro')}>
            <Text style={[styles.primaryText, !isConnected && styles.primaryTextDisabled]}>
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

function StepRow({index, title, subtitle}: {index: number; title: string; subtitle: string}) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepIndex}>
        <Text style={styles.stepIndexText}>{index}</Text>
      </View>
      <View style={styles.stepTextWrap}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.xxl,
    gap: layout.screenGap,
  },
  heroSection: {alignItems: 'center', gap: spacing.md},
  heroCopy: {alignItems: 'center', gap: spacing.xs},
  logo: {width: 140, height: 140},
  title: {
    color: colors.text,
    fontSize: typography.titleLg,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: layout.cardPaddingLg,
    gap: spacing.md,
  },
  stepDivider: {height: StyleSheet.hairlineWidth, backgroundColor: colors.border},
  stepRow: {flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start'},
  stepIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  stepIndexText: {color: colors.onAccent, fontWeight: '800', fontSize: typography.label},
  stepTextWrap: {flex: 1, gap: spacing.xxs},
  stepTitle: {color: colors.text, fontWeight: '700', fontSize: typography.body},
  stepSubtitle: {color: colors.textMuted, fontSize: typography.label, lineHeight: 18},
  statusCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: layout.cardPaddingLg,
    gap: spacing.sm,
  },
  statusCardConnected: {
    backgroundColor: colors.successSurface,
    borderColor: colors.successBorder,
  },
  statusHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  statusTitleRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  statusLabel: {color: colors.textMuted, fontSize: typography.label, fontWeight: '600'},
  statusAction: {color: colors.accent, fontSize: typography.label, fontWeight: '700'},
  statusDot: {width: 10, height: 10, borderRadius: 5},
  statusDotConnected: {backgroundColor: colors.success},
  statusDotDisconnected: {backgroundColor: colors.dangerText},
  statusDotChecking: {backgroundColor: colors.textMuted},
  statusText: {color: colors.text, fontWeight: '600', fontSize: typography.body, lineHeight: 20},
  statusTextConnected: {color: colors.successText},
  actionGroup: {gap: spacing.sm, marginTop: 'auto'},
  primaryButton: {
    backgroundColor: colors.accent,
    minHeight: layout.buttonHeight,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {backgroundColor: colors.border},
  primaryText: {color: colors.onAccent, fontWeight: '800', fontSize: typography.bodyLg},
  primaryTextDisabled: {color: colors.textMuted},
  secondaryButton: {
    borderColor: colors.border,
    borderWidth: 1,
    minHeight: layout.buttonHeight,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {color: colors.textMuted, fontWeight: '700', fontSize: typography.bodyLg},
  unsupportedWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: layout.screenPadding,
    gap: spacing.md,
  },
  unsupportedCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: layout.cardPaddingLg,
    gap: spacing.sm,
  },
  unsupportedTitle: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
    textAlign: 'center',
  },
  unsupportedText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 20,
    textAlign: 'center',
  },
});
