import React, {useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {ScreenHeader} from '../../../components/ScreenHeader';
import {useMutation, useQuery} from '@tanstack/react-query';
import {colors, layout, radii, spacing, typography} from '../../../theme';
import {useAppState} from '../../../state/appState';
import {apiFetch} from '../../../lib/api';
import {registerAndLinkDevice} from '../../../lib/devicePairing';
import {queryKeys} from '../../../lib/queryKeys';
import {useAuth} from '../../../state/authProvider';
import {postPairingRoute, supportsLocalDeviceSetup, unsupportedDeviceSetupMessage} from '../../../lib/deviceSetup';

export default function SetupIntroScreen() {
  const router = useRouter();
  const {state, setDeviceStatus, setDeviceId} = useAppState();
  const {deviceIds, hydrate} = useAuth();
  const setupSsid = 'Commute-Live-Setup-xxx';
  const statusUrl = 'http://192.168.4.1/status';
  const [ssid, setSsid] = useState('');
  const [wifiUsername, setWifiUsername] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const canConnect = ssid.length > 0 && wifiPassword.trim().length > 0;
  const [connectStatus, setConnectStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingLinkDeviceId, setPendingLinkDeviceId] = useState<string | null>(null);
  const [needsHomeWifiForLink, setNeedsHomeWifiForLink] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const isConnecting = connectStatus === 'connecting';

  const statusQuery = useQuery({
    queryKey: queryKeys.espStatus,
    queryFn: async () => {
      const response = await fetch(statusUrl, {method: 'GET'});
      if (!response.ok) return null;
      return response.json().catch(() => null);
    },
    enabled: supportsLocalDeviceSetup,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const registerAndLinkMutation = useMutation({
    mutationFn: registerAndLinkDevice,
  });

  const connectWifiMutation = useMutation({
    mutationFn: async (payload: {
      ssid: string;
      wifiPassword: string;
      wifiUsername: string;
      currentDeviceId: string | null;
    }) => {
      const response = await fetch('http://192.168.4.1/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `ssid=${encodeURIComponent(payload.ssid)}&password=${encodeURIComponent(payload.wifiPassword)}&user=${encodeURIComponent(payload.wifiUsername)}`,
      });
      const text = await response.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }

      let resolvedDeviceId = payload.currentDeviceId;
      if (!resolvedDeviceId) {
        try {
          const infoResponse = await fetch('http://192.168.4.1/device-info', {method: 'GET'});
          if (infoResponse.ok) {
            const info = await infoResponse.json().catch(() => null);
            if (info?.deviceId) {
              resolvedDeviceId = String(info.deviceId);
            }
          }
        } catch {
          // ignore
        }
      }

      return {
        responseOk: response.ok,
        text,
        data,
        resolvedDeviceId,
      };
    },
  });

  useEffect(() => {
    setDeviceStatus('notPaired');
    const data = statusQuery.data;
    if (!data) return;
    if (data?.deviceId) {
      setDeviceId(String(data.deviceId));
    }
    if (data?.wifiConnected === true) {
      setDeviceStatus('pairedOnline');
    } else if (data?.wifiConnected === false) {
      setDeviceStatus('pairedOffline');
    }
  }, [setDeviceId, setDeviceStatus, statusQuery.data]);

  const tryRegisterAndLinkDevice = async (deviceIdToLink: string) => {
    if (deviceIds.includes(deviceIdToLink)) {
      setPendingLinkDeviceId(null);
      setNeedsHomeWifiForLink(false);
      setDeviceStatus('pairedOnline');
      setErrorMsg('');
      router.replace(postPairingRoute);
      return true;
    }

    setIsLinking(true);
    try {
      const result = await registerAndLinkMutation.mutateAsync(deviceIdToLink);
      if (!result.ok) {
        setConnectStatus('error');
        setNeedsHomeWifiForLink(false);
        setPendingLinkDeviceId(null);
        setErrorMsg(result.error);
        return false;
      }

      setPendingLinkDeviceId(null);
      setNeedsHomeWifiForLink(false);
      setDeviceStatus('pairedOnline');
      setErrorMsg('');
      await hydrate();
      router.replace(postPairingRoute);
      return true;
    } catch {
      setPendingLinkDeviceId(deviceIdToLink);
      setNeedsHomeWifiForLink(true);
      setConnectStatus('success');
      setErrorMsg(
        'Now switch your phone from ESP Wi-Fi to home Wi-Fi/cellular, then tap "I have done it".',
      );
      return false;
    } finally {
      setIsLinking(false);
    }
  };

  const handleConnect = async () => {
    setConnectStatus('connecting');
    setErrorMsg('');
    setNeedsHomeWifiForLink(false);
    setPendingLinkDeviceId(null);

    try {
      const result = await connectWifiMutation.mutateAsync({
        ssid,
        wifiPassword,
        wifiUsername,
        currentDeviceId: state.deviceId,
      });
      if (!result.responseOk || result.data.error) {
        setConnectStatus('error');
        const rawError = String(result.data.error || 'Unknown error');
        if (rawError === 'No Eligible WiFi networks found') {
          setErrorMsg('No eligible Wi‑Fi networks found. Make sure the device can see your network.');
        } else if (rawError === 'Failed to connect to WiFi bc of credentials') {
          setErrorMsg('Wrong Wi‑Fi password. Please try again.');
        } else if (rawError === 'Target WiFi network not found') {
          setErrorMsg('Your Wi‑Fi network was not found. Check the SSID and try again.');
        } else if (rawError === 'credentials wrong') {
          setErrorMsg('Wrong Wi‑Fi password or SSID. Please try again.');
        } else if (rawError === 'Missing SSID') {
          setErrorMsg('Please enter a Wi‑Fi SSID.');
        } else {
          setErrorMsg(rawError);
        }
        return;
      }

      const resolvedDeviceId = result.resolvedDeviceId;
      if (resolvedDeviceId) {
        setDeviceId(resolvedDeviceId);
      }

      setConnectStatus('success');
      if (!resolvedDeviceId) return;
      await tryRegisterAndLinkDevice(resolvedDeviceId);
    } catch {
      if (state.deviceId) {
        setPendingLinkDeviceId(state.deviceId);
        setNeedsHomeWifiForLink(true);
        setConnectStatus('success');
        setErrorMsg(
          'Connection to ESP Wi-Fi dropped. This often means device switched networks. Switch phone to home Wi-Fi/cellular, then tap "I have done it".',
        );
      } else {
        setConnectStatus('error');
        setErrorMsg('Network error');
      }
    }
  };

  const handleRetryLink = async () => {
    if (!pendingLinkDeviceId) return;
    setErrorMsg('');
    setConnectStatus('success');
    await tryRegisterAndLinkDevice(pendingLinkDeviceId);
  };

  if (!supportsLocalDeviceSetup) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader title="Register device" />
        <View style={styles.unsupportedWrap}>
          <View style={styles.unsupportedCard}>
            <Text style={styles.unsupportedTitle}>Use the mobile app for setup</Text>
            <Text style={styles.unsupportedText}>{unsupportedDeviceSetupMessage}</Text>
          </View>
          <Pressable style={styles.primaryButton} onPress={() => router.replace('/dashboard')}>
            <Text style={styles.primaryText}>Open dashboard</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title="Register device" />
      <View style={styles.body}>
        {isConnecting ? (
          <View style={styles.loadingOverlay} pointerEvents="auto">
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.loadingText}>Connecting to Wi‑Fi...</Text>
            </View>
          </View>
        ) : null}

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.deviceIdCard}>
            <View style={styles.deviceIdRow}>
              <Text style={styles.deviceIdLabel}>Display</Text>
              <Text style={styles.deviceIdValue}>{state.deviceId ?? 'Not detected yet'}</Text>
            </View>
            <View style={styles.deviceIdDivider} />
            <View style={styles.deviceIdRow}>
              <Text style={styles.deviceIdLabel}>Account</Text>
              <Text style={styles.deviceIdValue}>{state.userId ? 'Signed in' : 'Sign in required'}</Text>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldGroupTitle}>Wi‑Fi credentials</Text>
            <TextInput
              value={ssid}
              onChangeText={setSsid}
              placeholder="Network name (SSID)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <TextInput
              value={wifiUsername}
              onChangeText={setWifiUsername}
              placeholder="Username (enterprise only)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <TextInput
              value={wifiPassword}
              onChangeText={setWifiPassword}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={styles.input}
            />
          </View>

          {connectStatus === 'error' && errorMsg.length > 0 && (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.dangerText} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {needsHomeWifiForLink && pendingLinkDeviceId ? (
            <View style={styles.pauseCard}>
              <View style={styles.pauseHeaderRow}>
                <Ionicons name="swap-horizontal-outline" size={18} color={colors.accent} />
                <Text style={styles.pauseTitle}>Switch your phone's Wi‑Fi</Text>
              </View>
              <Text style={styles.pauseText}>
                The display connected. Now switch your phone to home Wi‑Fi or cellular so we can finish linking it to your account.
              </Text>
              <Pressable
                style={[styles.primaryButton, isLinking && styles.primaryButtonDisabled]}
                disabled={isLinking}
                onPress={handleRetryLink}>
                {isLinking ? (
                  <ActivityIndicator color={colors.onAccent} />
                ) : (
                  <Text style={styles.primaryText}>I've switched — continue</Text>
                )}
              </Pressable>
            </View>
          ) : null}

          <Pressable
            style={[styles.primaryButton, !canConnect && styles.primaryButtonDisabled]}
            disabled={!canConnect || isConnecting || (needsHomeWifiForLink && !!pendingLinkDeviceId)}
            onPress={handleConnect}>
            {isConnecting ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={[styles.primaryText, !canConnect && styles.primaryTextDisabled]}>
                Connect to Wi‑Fi
              </Text>
            )}
          </Pressable>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={styles.skipButton}
            disabled={isConnecting || isLinking || needsHomeWifiForLink}
            onPress={() => router.push(postPairingRoute)}>
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  body: {flex: 1},
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.screenGap,
    paddingBottom: spacing.xxl,
    gap: layout.screenGap,
  },
  deviceIdCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  deviceIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: layout.buttonHeight,
  },
  deviceIdDivider: {height: StyleSheet.hairlineWidth, backgroundColor: colors.border},
  deviceIdLabel: {color: colors.textMuted, fontSize: typography.body, fontWeight: '600'},
  deviceIdValue: {color: colors.text, fontWeight: '700', fontSize: typography.body},
  fieldGroup: {gap: spacing.sm},
  fieldGroupTitle: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  } as any,
  input: {
    minHeight: layout.inputHeight,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: typography.body,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  errorText: {flex: 1, color: colors.dangerText, fontSize: typography.body, lineHeight: 20},
  pauseCard: {
    backgroundColor: colors.accentSurface,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: layout.cardPaddingLg,
    gap: spacing.md,
  },
  pauseHeaderRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  pauseTitle: {color: colors.text, fontSize: typography.bodyLg, fontWeight: '800'},
  pauseText: {color: colors.textSecondary, fontSize: typography.body, lineHeight: 21},
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
  footer: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  skipButton: {
    minHeight: layout.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {color: colors.textMuted, fontWeight: '700', fontSize: typography.body},
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlayStrong,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingVertical: layout.cardPaddingLg,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 220,
  },
  loadingText: {color: colors.text, fontWeight: '700', fontSize: typography.body},
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
