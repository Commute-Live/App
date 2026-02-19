import React, {useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {colors, spacing, radii} from '../../../theme';
import {useAppState} from '../../../state/appState';
import {apiFetch} from '../../../lib/api';
import {useAuth} from '../../../state/authProvider';

export default function SetupIntroScreen() {
  const router = useRouter();
  const {state, setDeviceStatus, setDeviceId} = useAppState();
  const {deviceIds} = useAuth();
  const setupSsid = 'Commute-Live-Setup-xxx';
  const statusUrl = 'http://192.168.4.1/status';
  const [ssid, setSsid] = useState('');
  const [wifiUsername, setWifiUsername] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const canConnect = ssid.length > 0 && wifiPassword.trim().length > 0;
  const [connectStatus, setConnectStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [pendingLinkDeviceId, setPendingLinkDeviceId] = useState<string | null>(null);
  const [needsHomeWifiForLink, setNeedsHomeWifiForLink] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const isConnecting = connectStatus === 'connecting';

  useEffect(() => {
    setDeviceStatus('notPaired');

    const loadStatus = async () => {
      try {
        const response = await fetch(statusUrl, {method: 'GET'});
        if (!response.ok) return;
        const data = await response.json();
        if (data?.deviceId) {
          setDeviceId(String(data.deviceId));
        }
        if (data?.wifiConnected === true) {
          setDeviceStatus('pairedOnline');
        } else if (data?.wifiConnected === false) {
          setDeviceStatus('pairedOffline');
        }
      } catch {
        // ignore
      }
    };

    loadStatus();
  }, [setDeviceId, setDeviceStatus, statusUrl]);

  const tryRegisterAndLinkDevice = async (deviceIdToLink: string) => {
    if (deviceIds.includes(deviceIdToLink)) {
      setPendingLinkDeviceId(null);
      setNeedsHomeWifiForLink(false);
      setDeviceStatus('pairedOnline');
      setErrorMsg('');
      return true;
    }

    setIsLinking(true);
    try {
      const registerResponse = await apiFetch('/device/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: deviceIdToLink}),
      });
      if (!registerResponse.ok && registerResponse.status !== 409) {
        const registerData = await registerResponse.json().catch(() => null);
        setConnectStatus('error');
        setNeedsHomeWifiForLink(false);
        setPendingLinkDeviceId(null);
        setErrorMsg(
          typeof registerData?.error === 'string'
            ? `Device register failed: ${registerData.error}`
            : `Device register failed (${registerResponse.status})`,
        );
        return false;
      }

      const linkResponse = await apiFetch('/user/device/link', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({deviceId: deviceIdToLink}),
      });

      if (!linkResponse.ok) {
        const linkData = await linkResponse.json().catch(() => null);
        setConnectStatus('error');
        setNeedsHomeWifiForLink(false);
        setPendingLinkDeviceId(null);
        setErrorMsg(
          typeof linkData?.error === 'string'
            ? `Wi-Fi connected, but device link failed: ${linkData.error}`
            : `Wi-Fi connected, but device link failed (${linkResponse.status})`,
        );
        return false;
      }

      setPendingLinkDeviceId(null);
      setNeedsHomeWifiForLink(false);
      setDeviceStatus('pairedOnline');
      setErrorMsg('');
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
    setApiResponse(null);
    setNeedsHomeWifiForLink(false);
    setPendingLinkDeviceId(null);

    try {
      const response = await fetch('http://192.168.4.1/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `ssid=${encodeURIComponent(ssid)}&password=${encodeURIComponent(wifiPassword)}&user=${encodeURIComponent(wifiUsername)}`,
      });
      const text = await response.text();
      setApiResponse(text);
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }
      if (!response.ok || data.error) {
        setConnectStatus('error');
        const rawError = String(data.error || 'Unknown error');
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

      let resolvedDeviceId = state.deviceId;
      if (!resolvedDeviceId) {
        try {
          const infoResponse = await fetch('http://192.168.4.1/device-info', {method: 'GET'});
          if (infoResponse.ok) {
            const info = await infoResponse.json();
            if (info?.deviceId) {
              resolvedDeviceId = String(info.deviceId);
              setDeviceId(resolvedDeviceId);
            }
          }
        } catch {
          // ignore
        }
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.body}>
        {isConnecting ? (
          <View style={styles.loadingOverlay} pointerEvents="auto">
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.loadingText}>Connecting to Wi-Fi...</Text>
            </View>
          </View>
        ) : null}
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.heading}>Register your device</Text>
          <Text style={styles.subheading}>Complete registration below.</Text>
          <View style={styles.section}>
            <View style={styles.deviceIdCard}>
              <Text style={styles.deviceIdLabel}>Device ID</Text>
              <Text style={styles.deviceIdValue}>{state.deviceId || 'Not available yet'}</Text>
              <Text style={styles.deviceIdLabel}>User ID</Text>
              <Text style={styles.deviceIdValue}>{state.userId || 'Not available yet'}</Text>
            </View>
            <Text style={styles.sectionTitle}>Wi‑Fi credentials</Text>
            <TextInput
              value={ssid}
              onChangeText={setSsid}
              placeholder="Wi-Fi SSID"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              value={wifiUsername}
              onChangeText={setWifiUsername}
              placeholder="Username (optional)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
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
            <Pressable
              style={[styles.primaryButton, !canConnect && styles.primaryButtonDisabled]}
              disabled={!canConnect || isConnecting}
              onPress={handleConnect}
            >
              {isConnecting ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={[styles.primaryText, !canConnect && styles.primaryTextDisabled]}>
                  Connect to Wi‑Fi
                </Text>
              )}
            </Pressable>
            {connectStatus === 'error' && <Text style={{ color: 'red', marginTop: 8 }}>{errorMsg}</Text>}
            {connectStatus === 'success' && (
              <Text style={{ color: 'green', marginTop: 8 }}>
                {needsHomeWifiForLink ? 'Connected to device Wi-Fi.' : 'Connected!'}
              </Text>
            )}
            {needsHomeWifiForLink && pendingLinkDeviceId ? (
              <View style={styles.pauseCard}>
                <Text style={styles.pauseTitle}>Pause: Switch Phone Network</Text>
                <Text style={styles.pauseText}>
                  Connect your phone to home Wi-Fi (or cellular), then continue.
                </Text>
                <Pressable
                  style={[styles.secondaryButton, {marginTop: spacing.sm}]}
                  disabled={isLinking}
                  onPress={handleRetryLink}>
                  <Text style={styles.secondaryText}>
                    {isLinking ? 'Registering + Linking...' : 'I have done it'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {apiResponse && (
              <Text style={{ color: colors.textMuted, marginTop: 8, fontSize: 12 }} selectable>
                API Response: {apiResponse}
              </Text>
            )}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Pressable
            style={styles.finishLink}
            disabled={isConnecting || isLinking || needsHomeWifiForLink}
            onPress={() => router.push('/dashboard')}
          >
            <Text style={styles.finishText}>Finish setup</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  body: {flex: 1},
  content: {padding: spacing.lg, paddingBottom: spacing.xl},
  heading: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subheading: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  textWrap: {flex: 1},
  cardTitle: {color: colors.text, fontSize: 14, fontWeight: '700'},
  cardSuccess: {borderColor: colors.success},
  cardError: {borderColor: colors.warning},
  statusIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconSuccess: {backgroundColor: colors.success},
  statusIconWarning: {backgroundColor: colors.warning},
  statusIconError: {backgroundColor: colors.warning},
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  portalWrap: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  portalHeader: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  portalTitle: {color: colors.text, fontSize: 14, fontWeight: '700'},
  portalUrl: {color: colors.textMuted, fontSize: 12, marginTop: 2},
  webView: {height: 380, backgroundColor: colors.surface},
  portalError: {color: colors.warning, fontSize: 12, padding: spacing.md},
  section: {marginTop: spacing.sm},
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionHeader: {color: colors.text, fontSize: 14, fontWeight: '700'},
  sectionTitle: {color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: spacing.sm},
  scanButton: {
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scanText: {color: colors.textMuted, fontSize: 12, fontWeight: '700'},
  networkList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  networkScroll: {maxHeight: 220},
  listHeader: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listHeaderText: {color: colors.textMuted, fontSize: 12, fontWeight: '700'},
  networkRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  networkRowSelected: {backgroundColor: '#0B1115'},
  networkLeft: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1},
  checkPlaceholder: {width: 16, height: 16},
  networkName: {color: colors.text, fontWeight: '600'},
  networkRight: {flexDirection: 'row', alignItems: 'center', gap: 8},
  selectedRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    marginBottom: spacing.md,
  },
  selectedLabel: {color: colors.textMuted, fontSize: 12},
  selectedValue: {color: colors.text, fontWeight: '700', marginTop: 4},
  input: {
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  deviceIdCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    marginBottom: spacing.md,
  },
  deviceIdLabel: {color: colors.textMuted, fontSize: 12, fontWeight: '700'},
  deviceIdValue: {color: colors.text, fontWeight: '800', marginTop: 4},
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
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
    width: '100%',
  },
  secondaryText: {color: colors.textMuted, fontWeight: '700', fontSize: 14},
  pauseCard: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  pauseTitle: {color: colors.text, fontSize: 13, fontWeight: '800'},
  pauseText: {color: colors.textMuted, fontSize: 12, marginTop: 4},
  pressed: {opacity: 0.85},
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  finishLink: {alignItems: 'center', marginTop: spacing.md},
  finishText: {color: colors.textMuted, fontWeight: '700', fontSize: 13},
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {color: colors.text, fontWeight: '700'},
});
