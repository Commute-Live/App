import React, {useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {colors, spacing, radii} from '../../../theme';
import {useAppState} from '../../../state/appState';
import {apiFetch} from '../../../lib/api';
import {useAuth} from '../../../state/authProvider';
import {useBleProvision} from '../hooks/useBleProvision';

export default function BleProvisionScreen() {
  const router = useRouter();
  const {setDeviceId, setDeviceStatus} = useAppState();
  const {deviceIds, hydrate} = useAuth();

  const {state, startScan, connectToDevice, sendCredentials, reset} = useBleProvision();

  const [ssid, setSsid]     = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [linkError, setLinkError] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [isWaitingOnline, setIsWaitingOnline] = useState(false);

  const canSend = ssid.trim().length > 0 && password.trim().length > 0;
  const isBusy =
    state.phase === 'requesting_permission' ||
    state.phase === 'scanning' ||
    state.phase === 'connecting' ||
    state.phase === 'provisioning' ||
    state.phase === 'waiting_wifi' ||
    isLinking ||
    isWaitingOnline;

  const pollUntilOnline = async (espDeviceId: string): Promise<boolean> => {
    const INTERVAL_MS = 2000;
    const TIMEOUT_MS = 30000;
    const start = Date.now();
    while (Date.now() - start < TIMEOUT_MS) {
      const res = await apiFetch(`/device/${encodeURIComponent(espDeviceId)}/online`).catch(() => null);
      if (res?.ok) {
        const data = await res.json().catch(() => null);
        if (data?.online === true) return true;
      }
      await new Promise(r => setTimeout(r, INTERVAL_MS));
    }
    return false;
  };

  const registerAndLink = async (espDeviceId: string) => {
    console.log('[BLE] registerAndLink called with', espDeviceId);
    setIsLinking(true);
    setLinkError('');
    setDeviceId(espDeviceId);

    if (deviceIds.includes(espDeviceId)) {
      console.log('[BLE] device already in deviceIds, skipping registration');
      setDeviceStatus('pairedOnline');
      await hydrate();
      setIsLinking(false);
      router.replace('/dashboard');
      return;
    }

    try {
      console.log('[BLE] calling /device/register');
      const regRes = await apiFetch('/device/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: espDeviceId}),
      });
      console.log('[BLE] /device/register status:', regRes.status);
      if (!regRes.ok && regRes.status !== 409) {
        const data = await regRes.json().catch(() => null);
        console.log('[BLE] register failed:', data);
        setLinkError(
          typeof data?.error === 'string'
            ? `Register failed: ${data.error}`
            : `Register failed (${regRes.status})`,
        );
        setIsLinking(false);
        return;
      }

      console.log('[BLE] calling /user/device/link');
      const linkRes = await apiFetch('/user/device/link', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({deviceId: espDeviceId}),
      });
      console.log('[BLE] /user/device/link status:', linkRes.status);
      if (!linkRes.ok && linkRes.status !== 409) {
        const data = await linkRes.json().catch(() => null);
        console.log('[BLE] link failed:', data);
        setLinkError(
          typeof data?.error === 'string'
            ? `Link failed: ${data.error}`
            : `Link failed (${linkRes.status})`,
        );
        setIsLinking(false);
        return;
      }

      console.log('[BLE] registration complete, polling for online status');
      setIsLinking(false);
      setIsWaitingOnline(true);
      const online = await pollUntilOnline(espDeviceId);
      setIsWaitingOnline(false);
      if (!online) {
        setLinkError('Device registered but took too long to come online — try reloading the app.');
      }
      setDeviceStatus('pairedOnline');
      await hydrate();
      router.replace('/dashboard');
    } catch (e: unknown) {
      console.log('[BLE] registerAndLink error:', e);
      setLinkError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLinking(false);
      setIsWaitingOnline(false);
    }
  };

  const handleSendCredentials = async () => {
    setLinkError('');
    const deviceId = await sendCredentials(ssid.trim(), password, username.trim());
    console.log('[BLE] sendCredentials returned deviceId:', deviceId);
    if (deviceId) {
      await registerAndLink(deviceId);
    }
  };

  // Render helper: status chip
  const StatusLine = ({label, active}: {label: string; active: boolean}) => (
    <View style={styles.statusRow}>
      <View style={[styles.dot, active ? styles.dotActive : styles.dotIdle]} />
      <Text style={styles.statusLabel}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Set up your device</Text>
        <Text style={styles.subheading}>
          Your phone stays on home Wi-Fi the whole time. CommuteLive uses Bluetooth to securely send
          credentials to your display.
        </Text>

        {/* Phase: idle / error — show Scan button */}
        {(state.phase === 'idle' || state.phase === 'error') && (
          <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.section}>
            {state.phase === 'error' && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{state.errorMsg}</Text>
              </View>
            )}
            <Pressable style={styles.primaryButton} onPress={startScan}>
              <Text style={styles.primaryText}>Find my CommuteLive display</Text>
            </Pressable>
            {state.phase === 'error' && (
              <Pressable style={styles.secondaryButton} onPress={reset}>
                <Text style={styles.secondaryText}>Start over</Text>
              </Pressable>
            )}
          </Animated.View>
        )}

        {/* Phase: scanning */}
        {(state.phase === 'scanning' || state.phase === 'requesting_permission') && (
          <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.section}>
            <View style={styles.scanCard}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.scanText}>Scanning for CommuteLive displays nearby...</Text>
              <Text style={styles.scanHint}>Make sure the device is powered on.</Text>
            </View>
          </Animated.View>
        )}

        {/* Phase: device_found */}
        {state.phase === 'device_found' && state.foundDevice && (
          <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.section}>
            <View style={styles.deviceCard}>
              <Text style={styles.deviceCardLabel}>Found display</Text>
              <Text style={styles.deviceCardName}>{state.foundDevice.name}</Text>
            </View>
            <Pressable style={styles.primaryButton} onPress={connectToDevice}>
              <Text style={styles.primaryText}>Connect via Bluetooth</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Phase: connecting */}
        {state.phase === 'connecting' && (
          <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.section}>
            <View style={styles.scanCard}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.scanText}>Connecting to {state.foundDevice?.name}...</Text>
            </View>
          </Animated.View>
        )}

        {/* Phase: connected — enter WiFi credentials */}
        {(state.phase === 'connected' ||
          state.phase === 'provisioning' ||
          state.phase === 'waiting_wifi') && (
          <Animated.View entering={FadeIn.duration(350)} style={styles.section}>
            <View style={styles.connectedBadge}>
              <View style={styles.dotActive} />
              <Text style={styles.connectedText}>
                Connected to {state.foundDevice?.name ?? 'device'}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Enter your home Wi-Fi</Text>
            <TextInput
              style={styles.input}
              value={ssid}
              onChangeText={setSsid}
              placeholder="Wi-Fi SSID"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              editable={!isBusy}
            />
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Username (optional, for WPA2 Enterprise)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              editable={!isBusy}
            />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              editable={!isBusy}
            />

            {state.phase === 'waiting_wifi' && (
              <View style={styles.progressCard}>
                <StatusLine label="Credentials sent" active={true} />
                <StatusLine label="Device connecting to Wi-Fi..." active={true} />
                <ActivityIndicator color={colors.accent} style={{marginTop: spacing.sm}} />
              </View>
            )}

            {state.errorMsg ? (
              <Text style={styles.errorInline}>{state.errorMsg}</Text>
            ) : null}

            {linkError.length > 0 && (
              <Text style={styles.errorInline}>{linkError}</Text>
            )}

            {isLinking && (
              <View style={styles.progressCard}>
                <StatusLine label="Wi-Fi connected" active={true} />
                <StatusLine label="Registering device..." active={true} />
                <ActivityIndicator color={colors.accent} style={{marginTop: spacing.sm}} />
              </View>
            )}

            {isWaitingOnline && (
              <View style={styles.progressCard}>
                <StatusLine label="Credentials sent" active={true} />
                <StatusLine label="Wi-Fi connected" active={true} />
                <StatusLine label="Device registered" active={true} />
                <StatusLine label="Waiting for device to come online..." active={false} />
                <ActivityIndicator color={colors.accent} style={{marginTop: spacing.sm}} />
              </View>
            )}

            <Pressable
              style={[styles.primaryButton, (!canSend || isBusy) && styles.primaryButtonDisabled]}
              disabled={!canSend || isBusy}
              onPress={handleSendCredentials}>
              {state.phase === 'provisioning' || state.phase === 'waiting_wifi' || isLinking ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={[styles.primaryText, (!canSend || isBusy) && styles.primaryTextDisabled]}>
                  Connect display to Wi-Fi
                </Text>
              )}
            </Pressable>
          </Animated.View>
        )}

        {/* Phase: done (should navigate away, but fallback) */}
        {state.phase === 'done' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.section}>
            <Text style={styles.successText}>Display is online! Redirecting...</Text>
          </Animated.View>
        )}

        <Pressable style={styles.skipLink} onPress={() => router.push('/dashboard')}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, paddingBottom: spacing.xl},
  heading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subheading: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  section: {marginTop: spacing.sm},
  sectionTitle: {color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: spacing.sm},
  errorCard: {
    backgroundColor: colors.surface,
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  errorText: {color: colors.warning, fontSize: 13},
  errorInline: {color: colors.warning, fontSize: 12, marginTop: spacing.xs},
  scanCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  scanText: {color: colors.text, fontWeight: '700', textAlign: 'center'},
  scanHint: {color: colors.textMuted, fontSize: 12, textAlign: 'center'},
  deviceCard: {
    backgroundColor: colors.card,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  deviceCardLabel: {color: colors.textMuted, fontSize: 12},
  deviceCardName: {color: colors.text, fontWeight: '800', fontSize: 18, marginTop: 4},
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  connectedText: {color: colors.success, fontWeight: '700', fontSize: 13},
  input: {
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  progressCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  statusRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 6},
  statusLabel: {color: colors.text, fontSize: 13},
  dot: {width: 8, height: 8, borderRadius: 4},
  dotIdle: {backgroundColor: colors.textMuted},
  dotActive: {backgroundColor: colors.success},
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryButtonDisabled: {backgroundColor: colors.border},
  primaryText: {color: colors.background, fontWeight: '800', fontSize: 14},
  primaryTextDisabled: {color: colors.textMuted},
  secondaryButton: {
    borderColor: colors.border,
    borderWidth: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryText: {color: colors.textMuted, fontWeight: '700', fontSize: 14},
  successText: {color: colors.success, fontWeight: '700', textAlign: 'center', fontSize: 15},
  skipLink: {alignItems: 'center', marginTop: spacing.xl},
  skipText: {color: colors.textMuted, fontWeight: '700', fontSize: 13},
});
