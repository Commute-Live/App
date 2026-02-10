import React, {useCallback, useEffect, useState} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {ScreenHeader} from '../../../components/ScreenHeader';
import {colors, spacing, radii} from '../../../theme';
import {useAppState} from '../../../state/appState';

export default function RegisterDeviceScreen() {
  const router = useRouter();
  const {state, setDeviceId} = useAppState();
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  const checkConnection = useCallback(async () => {
    setStatus('checking');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch('http://192.168.4.1/heartbeat', {
        method: 'GET',
        signal: controller.signal,
      });
      if (response.ok) {
        setStatus('connected');
      } else {
        setStatus('disconnected');
      }
    } catch {
      setStatus('disconnected');
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    if (status !== 'connected') return;
    if (state.deviceId) return;
    const fetchDeviceInfo = async () => {
      try {
        const response = await fetch('http://192.168.4.1/device-info', {method: 'GET'});
        if (!response.ok) return;
        const data = await response.json();
        if (data?.deviceId) {
          setDeviceId(String(data.deviceId));
        }
      } catch {
        // ignore
      }
    };
    fetchDeviceInfo();
  }, [status, state.deviceId, setDeviceId]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Connect your device" />
      <View style={styles.content}>
        <Image source={require('../../../app-logo.png')} style={styles.logo} resizeMode="contain" />

        <Text style={styles.title}>Connect your device</Text>
        <Text style={styles.subtitle}>
          Power on the device, connect to its Wi‑Fi, then register it below.
        </Text>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {flex: 1, padding: spacing.lg, alignItems: 'center'},
  logo: {width: 210, height: 210, marginTop: spacing.sm, marginBottom: spacing.xs},
  title: {color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center'},
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  statusCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statusCardConnected: {borderColor: colors.accent},
  statusHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  statusTitleRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  statusLabel: {color: colors.textMuted, fontSize: 12},
  statusAction: {color: colors.accent, fontSize: 12, fontWeight: '700'},
  statusText: {color: colors.text, fontWeight: '700', marginTop: spacing.xs, textAlign: 'center'},
  statusDot: {width: 10, height: 10, borderRadius: 5},
  statusDotConnected: {backgroundColor: colors.success},
  statusDotDisconnected: {backgroundColor: colors.warning},
  statusDotChecking: {backgroundColor: colors.textMuted},
  stepRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.sm,
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
  stepIndexText: {color: colors.text, fontWeight: '700', fontSize: 12},
  stepTextWrap: {flex: 1, alignItems: 'flex-start'},
  stepTitle: {color: colors.text, fontWeight: '700'},
  stepSubtitle: {color: colors.textMuted, fontSize: 12, marginTop: 2},
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    width: '100%',
  },
  primaryText: {color: colors.background, fontWeight: '800', fontSize: 15},
  primaryButtonDisabled: {backgroundColor: colors.border},
  primaryTextDisabled: {color: colors.textMuted},
  secondaryButton: {
    borderColor: colors.border,
    borderWidth: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.sm,
  },
  secondaryText: {color: colors.textMuted, fontWeight: '700', fontSize: 14},
});
