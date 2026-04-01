import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import {colors, layout, radii, spacing, typography} from '../../../theme';
import {useAppState} from '../../../state/appState';
import {apiFetch, API_BASE} from '../../../lib/api';
import {useAuth} from '../../../state/authProvider';
import {useBleProvision, WifiNetwork} from '../hooks/useBleProvision';
import {AppBrandHeader} from '../../../components/AppBrandHeader';

type ProvisionStep = 'idle' | 'online';

const SignalBars = ({rssi}: {rssi: number}) => {
  const bars = rssi > -50 ? 3 : rssi > -70 ? 2 : 1;
  return (
    <View style={{flexDirection: 'row', alignItems: 'flex-end', gap: 2}}>
      {[1, 2, 3].map(i => (
        <View
          key={i}
          style={{
            width: 4,
            height: 4 + i * 4,
            borderRadius: 1,
            backgroundColor: i <= bars ? colors.accent : colors.border,
          }}
        />
      ))}
    </View>
  );
};

const NetworkRow = ({
  network,
  onPress,
  isFirst,
  isLast,
}: {
  network: WifiNetwork;
  onPress: () => void;
  isFirst: boolean;
  isLast: boolean;
}) => (
  <Pressable
    style={[
      styles.networkRow,
      isFirst && styles.networkRowFirst,
      isLast && styles.networkRowLast,
      !isLast && styles.networkRowBorder,
    ]}
    onPress={onPress}>
    <SignalBars rssi={network.rssi} />
    <Text style={styles.networkName} numberOfLines={1}>
      {network.ssid}
    </Text>
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
      {network.encryption > 0 && (
        <Text style={styles.lockIcon}>&#x1F512;</Text>
      )}
      {network.encryption === 4 && (
        <View style={styles.enterpriseBadge}>
          <Text style={styles.enterpriseText}>ENT</Text>
        </View>
      )}
      <Text style={styles.chevron}>›</Text>
    </View>
  </Pressable>
);

// ── Full-screen password modal ───────────────────────────────────────────────
interface PasswordModalProps {
  visible: boolean;
  network: WifiNetwork | null;
  isManual: boolean;
  isBusy: boolean;
  errorMsg: string;
  onClose: () => void;
  onConnect: (ssid: string, password: string, username: string) => void;
}

function PasswordModal({
  visible,
  network,
  isManual,
  isBusy,
  errorMsg,
  onClose,
  onConnect,
}: PasswordModalProps) {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const isOpen = !isManual && network?.encryption === 0;
  const isEnterprise = !isManual && network?.encryption === 4;
  const title = isManual ? 'Other Network' : (network?.ssid ?? '');
  const canConnect = isManual
    ? ssid.trim().length > 0 && (isOpen || password.trim().length > 0)
    : isOpen || password.trim().length > 0;

  useEffect(() => {
    if (visible) {
      setSsid(isManual ? '' : (network?.ssid ?? ''));
      setPassword('');
      setUsername('');
    }
  }, [visible, network, isManual]);

  const handleConnect = () => {
    const finalSsid = isManual ? ssid.trim() : (network?.ssid ?? '');
    onConnect(finalSsid, password, username.trim());
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={modal.container} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={{flex: 1}}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {/* Navigation bar */}
          <View style={modal.navBar}>
            <Pressable style={modal.navBtn} onPress={onClose} hitSlop={12}>
              <Text style={modal.navCancel}>✕</Text>
            </Pressable>
            <Text style={modal.navTitle} numberOfLines={1}>
              {title}
            </Text>
            <Pressable
              style={[modal.navBtn, modal.navBtnRight]}
              onPress={handleConnect}
              disabled={!canConnect || isBusy}
              hitSlop={12}>
              {isBusy ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={[modal.navConnect, (!canConnect || isBusy) && modal.navConnectDim]}>
                  Connect
                </Text>
              )}
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={modal.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* Fields grouped card */}
            <View style={modal.fieldGroup}>
              {isManual && (
                <>
                  <View style={modal.fieldRow}>
                    <Text style={modal.fieldLabel}>Network name</Text>
                    <TextInput
                      style={modal.fieldInput}
                      value={ssid}
                      onChangeText={setSsid}
                      placeholder="SSID"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isBusy}
                      autoFocus
                    />
                  </View>
                  <View style={modal.fieldDivider} />
                </>
              )}

              {(isEnterprise || isManual) && (
                <>
                  <View style={modal.fieldRow}>
                    <Text style={modal.fieldLabel}>Username</Text>
                    <TextInput
                      style={modal.fieldInput}
                      value={username}
                      onChangeText={setUsername}
                      placeholder="Optional"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isBusy}
                    />
                  </View>
                  <View style={modal.fieldDivider} />
                </>
              )}

              {!isOpen && (
                <View style={modal.fieldRow}>
                  <Text style={modal.fieldLabel}>Password</Text>
                  <TextInput
                    style={modal.fieldInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Required"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                    editable={!isBusy}
                    autoFocus={!isManual}
                    returnKeyType="go"
                    onSubmitEditing={canConnect && !isBusy ? handleConnect : undefined}
                  />
                </View>
              )}

              {isOpen && !isManual && (
                <View style={modal.openRow}>
                  <Text style={modal.openText}>This network is open — no password required.</Text>
                </View>
              )}
            </View>

            {errorMsg.length > 0 && (
              <Text style={modal.errorText}>{errorMsg}</Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function BleProvisionScreen() {
  const router = useRouter();
  const {setDeviceId, setDeviceStatus} = useAppState();
  const {hydrate} = useAuth();

  const {state, startScan, selectFoundDevice, connectToDevice, sendCredentials, requestWifiScan, reset} =
    useBleProvision();

  const [modalVisible, setModalVisible] = useState(false);
  const [modalNetwork, setModalNetwork] = useState<WifiNetwork | null>(null);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [provisionStep, setProvisionStep] = useState<ProvisionStep>('idle');
  const pairingTokenRef = useRef<string | null>(null);
  const hasRequestedScanRef = useRef(false);

  const isProvisioning = provisionStep !== 'idle';
  const isBusy =
    state.phase === 'requesting_permission' ||
    state.phase === 'scanning' ||
    state.phase === 'connecting' ||
    state.phase === 'provisioning' ||
    state.phase === 'waiting_wifi' ||
    isProvisioning;

  const modalError =
    state.errorMsg ??
    (linkError.length > 0 ? linkError : '');

  useEffect(() => {
    if (state.phase === 'connected' && !hasRequestedScanRef.current) {
      hasRequestedScanRef.current = true;
      requestWifiScan();
    }
  }, [state.phase, requestWifiScan]);

  // Re-open modal on wifi failure so user can retry
  useEffect(() => {
    if (state.phase === 'connected' && state.errorMsg && !modalVisible) {
      setModalVisible(true);
    }
  }, [state.phase, state.errorMsg, modalVisible]);

  const fetchPairingToken = async () => {
    try {
      const res = await apiFetch('/device/pairing-token', {method: 'POST'});
      const data = await res.json().catch(() => null);
      if (res.ok && typeof data?.token === 'string') {
        pairingTokenRef.current = data.token;
      }
    } catch {
      // non-fatal
    }
  };

  const pollUntilOnline = async (espDeviceId: string): Promise<boolean> => {
    const INTERVAL_MS = 2000;
    const TIMEOUT_MS = 20000;
    const start = Date.now();
    while (Date.now() - start < TIMEOUT_MS) {
      const res = await apiFetch(`/device/${encodeURIComponent(espDeviceId)}/online`).catch(
        () => null,
      );
      if (res?.ok) {
        const data = await res.json().catch(() => null);
        if (data?.online === true) return true;
      }
      await new Promise(r => setTimeout(r, INTERVAL_MS));
    }
    return false;
  };

  const openNetworkModal = (network: WifiNetwork) => {
    setModalNetwork(network);
    setIsManualEntry(false);
    setLinkError('');
    setModalVisible(true);
  };

  const openManualModal = () => {
    setModalNetwork(null);
    setIsManualEntry(true);
    setLinkError('');
    setModalVisible(true);
  };

  const handleConnect = async (ssid: string, password: string, username: string) => {
    setLinkError('');
    const token = pairingTokenRef.current ?? '';
    if (!token) {
      setLinkError('Could not get pairing token — check your internet connection and try again.');
      return;
    }

    const espDeviceId = await sendCredentials(ssid, password, username, token, API_BASE);
    if (!espDeviceId) return;

    // Keep modal open showing progress, close once done
    setDeviceId(espDeviceId);
    setProvisionStep('online');
    const online = await pollUntilOnline(espDeviceId);
    if (!online) {
      setLinkError('Device registered but took too long to come online — try reloading the app.');
    }
    setProvisionStep('idle');
    setModalVisible(false);
    setDeviceStatus('pairedOnline');
    await hydrate();
    router.replace('/dashboard');
  };

  const StatusLine = ({label, active}: {label: string; active: boolean}) => (
    <View style={styles.statusRow}>
      <View style={[styles.dot, active ? styles.dotActive : styles.dotIdle]} />
      <Text style={styles.statusLabel}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <AppBrandHeader />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBlock}>
          <Text style={styles.heading}>Set up your device</Text>
        </View>

        {/* Phase: idle / error */}
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
        {state.phase === 'device_found' && state.foundDevices.length > 0 && (
          <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.section}>
            <View style={styles.deviceCard}>
              <Text style={styles.deviceCardLabel}>Verify the name from the LED screen</Text>
              <Text style={styles.deviceVerifyText}>
                {state.foundDevices.length > 1
                  ? 'Multiple displays were found nearby. Choose the one that matches the name shown on your display.'
                  : 'Tap the display name below after confirming it matches what is shown on the LED screen.'}
              </Text>
            </View>
            <View style={styles.deviceList}>
              {state.foundDevices.map((device, index) => {
                const selected = state.foundDevice?.id === device.id;
                const isLast = index === state.foundDevices.length - 1;
                return (
                  <Pressable
                    key={device.id}
                    style={[
                      styles.deviceRow,
                      !isLast && styles.deviceRowBorder,
                      selected && styles.deviceRowSelected,
                    ]}
                    onPress={() => selectFoundDevice(device)}>
                    <View style={styles.deviceRowCopy}>
                      <Text style={styles.deviceRowName}>{device.name ?? device.id}</Text>
                      <Text style={styles.deviceRowMeta}>{selected ? 'Selected display' : 'Tap to select'}</Text>
                    </View>
                    <Text style={[styles.deviceRowAction, selected && styles.deviceRowActionSelected]}>
                      {selected ? 'Selected' : 'Select'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              style={[styles.primaryButton, !state.foundDevice && styles.primaryButtonDisabled]}
              disabled={!state.foundDevice}
              onPress={async () => {
                await connectToDevice();
                fetchPairingToken();
              }}>
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

        {/* Phase: connected — WiFi picker */}
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

            <Text style={styles.sectionTitle}>Choose a Wi-Fi network</Text>

            {state.isScanning && (
              <View style={styles.wifiScanCard}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.wifiScanText}>Scanning for Wi-Fi networks...</Text>
              </View>
            )}

            {!state.isScanning && state.wifiNetworks.length > 0 && (
              <View style={styles.networkList}>
                {state.wifiNetworks.map((network, index) => (
                  <NetworkRow
                    key={`${network.ssid}-${index}`}
                    network={network}
                    onPress={() => openNetworkModal(network)}
                    isFirst={index === 0}
                    isLast={index === state.wifiNetworks.length - 1}
                  />
                ))}
                <Pressable
                  style={[styles.networkRow, styles.networkRowLast, styles.networkRowOtherTop]}
                  onPress={openManualModal}>
                  <Text style={styles.manualEntryText}>Other network...</Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              </View>
            )}

            {!state.isScanning && state.wifiNetworks.length === 0 && (
              <View style={styles.wifiScanCard}>
                <Text style={styles.wifiScanText}>No Wi-Fi networks found</Text>
                <Pressable onPress={requestWifiScan}>
                  <Text style={styles.rescanText}>Tap to rescan</Text>
                </Pressable>
              </View>
            )}

            {!state.isScanning && !isBusy && state.wifiNetworks.length > 0 && (
              <Pressable style={styles.rescanRow} onPress={requestWifiScan}>
                <Text style={styles.rescanText}>Rescan</Text>
              </Pressable>
            )}

            {/* Progress shown while waiting for WiFi/online */}
            {(state.phase === 'waiting_wifi' || provisionStep !== 'idle') && (
              <View style={styles.progressCard}>
                <StatusLine label="Credentials sent" active />
                <StatusLine label="Wi-Fi connected" active={state.phase !== 'waiting_wifi'} />
                <StatusLine label="Device registered" active={provisionStep === 'online'} />
                <StatusLine label="Coming online..." active={false} />
                <ActivityIndicator color={colors.accent} style={{marginTop: spacing.sm}} />
              </View>
            )}
          </Animated.View>
        )}

        {/* Phase: done */}
        {state.phase === 'done' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.section}>
            <Text style={styles.successText}>Display is online! Redirecting...</Text>
          </Animated.View>
        )}

        <Pressable style={styles.skipLink} onPress={() => router.push('/dashboard')}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </ScrollView>

      <PasswordModal
        visible={modalVisible}
        network={modalNetwork}
        isManual={isManualEntry}
        isBusy={isBusy}
        errorMsg={modalError}
        onClose={() => setModalVisible(false)}
        onConnect={handleConnect}
      />
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.screenPadding,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
    gap: layout.sectionGap,
  },
  heroBlock: {
    gap: spacing.xs,
    alignItems: 'center',
  },
  heading: {
    color: colors.text,
    fontSize: typography.pageTitle,
    fontWeight: '900',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  section: {gap: spacing.md},
  sectionTitle: {color: colors.text, fontSize: typography.label, fontWeight: '700', marginBottom: spacing.sm},
  errorCard: {
    backgroundColor: colors.surface,
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  errorText: {color: colors.warning, fontSize: typography.body},
  scanCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: layout.cardPaddingLg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  scanText: {color: colors.text, fontWeight: '700', textAlign: 'center'},
  scanHint: {color: colors.textMuted, fontSize: typography.label, textAlign: 'center'},
  deviceCard: {
    backgroundColor: colors.card,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  deviceCardLabel: {color: colors.textMuted, fontSize: typography.label},
  deviceVerifyText: {
    color: colors.text,
    fontSize: typography.bodyLg,
    lineHeight: 20,
    marginTop: spacing.xxs,
  },
  deviceList: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
  },
  deviceRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  deviceRowSelected: {
    backgroundColor: colors.surface,
  },
  deviceRowCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  deviceRowName: {
    color: colors.text,
    fontSize: typography.bodyLg,
    fontWeight: '700',
  },
  deviceRowMeta: {
    color: colors.textMuted,
    fontSize: typography.label,
  },
  deviceRowAction: {
    color: colors.accent,
    fontSize: typography.label,
    fontWeight: '700',
  },
  deviceRowActionSelected: {
    color: colors.text,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  connectedText: {color: colors.success, fontWeight: '700', fontSize: typography.body},
  wifiScanCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: layout.cardPaddingLg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  wifiScanText: {color: colors.textMuted, fontSize: typography.body},
  networkList: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.buttonHeight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
  },
  networkRowFirst: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  networkRowLast: {
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
  },
  networkRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  networkRowOtherTop: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  networkName: {flex: 1, color: colors.text, fontSize: typography.bodyLg, fontWeight: '500'},
  lockIcon: {fontSize: typography.label},
  chevron: {color: colors.textMuted, fontSize: 18, fontWeight: '300'},
  enterpriseBadge: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xxs,
    paddingVertical: 1,
  },
  enterpriseText: {color: colors.textMuted, fontSize: 9, fontWeight: '800'},
  manualEntryText: {flex: 1, color: colors.accent, fontSize: typography.bodyLg, fontWeight: '600'},
  rescanRow: {alignSelf: 'center', marginTop: spacing.sm, paddingVertical: spacing.xs},
  rescanText: {color: colors.accent, fontSize: typography.body, fontWeight: '600'},
  progressCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statusRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  statusLabel: {color: colors.text, fontSize: typography.body},
  dot: {width: 8, height: 8, borderRadius: 4},
  dotIdle: {backgroundColor: colors.textMuted},
  dotActive: {backgroundColor: colors.success},
  primaryButton: {
    backgroundColor: colors.accent,
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryText: {color: colors.background, fontWeight: '800', fontSize: 15},
  secondaryButton: {
    borderColor: colors.border,
    borderWidth: 1,
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {color: colors.textMuted, fontWeight: '700', fontSize: typography.bodyLg},
  successText: {color: colors.success, fontWeight: '700', textAlign: 'center', fontSize: 15},
  skipLink: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  skipText: {color: colors.textMuted, fontWeight: '700', fontSize: typography.body},
});

const modal = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: layout.headerHeight,
  },
  navBtn: {
    minWidth: 72,
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
  },
  navBtnRight: {
    alignItems: 'flex-end',
  },
  navCancel: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '400',
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '700',
  },
  navConnect: {
    color: colors.accent,
    fontSize: typography.title,
    fontWeight: '700',
  },
  navConnectDim: {
    color: colors.textMuted,
  },
  body: {
    padding: layout.cardPaddingLg,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  fieldGroup: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    minHeight: layout.inputHeight,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: typography.bodyLg,
    fontWeight: '500',
    width: 100,
  },
  fieldInput: {
    flex: 1,
    color: colors.text,
    fontSize: typography.bodyLg,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
  },
  fieldDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.md,
  },
  openRow: {
    padding: spacing.md,
  },
  openText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 18,
  },
  errorText: {
    color: colors.warning,
    fontSize: typography.body,
    textAlign: 'center',
  },
});
