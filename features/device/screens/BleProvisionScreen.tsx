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
import {useLocalSearchParams, useRouter} from 'expo-router';
import {colors, layout, radii, spacing, typography} from '../../../theme';
import {useAppState} from '../../../state/appState';
import {apiFetch, API_BASE} from '../../../lib/api';
import {registerAndLinkDevice} from '../../../lib/devicePairing';
import {useAuth} from '../../../state/authProvider';
import {useBleProvision, WifiNetwork} from '../hooks/useBleProvision';
import {AppBrandHeader} from '../../../components/AppBrandHeader';
import {postPairingRoute, supportsBleProvisioning, unsupportedDeviceSetupMessage} from '../../../lib/deviceSetup';

type ProvisionStep = 'idle' | 'linking';

type ProgressDetail = {
  label: string;
  value: string;
};

const LINK_COMPLETION_TIMEOUT_MS = 15_000;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};

const PHASE_LABELS: Record<string, string> = {
  scanning: 'Scanning for network',
  wifi_connecting: 'Joining Wi-Fi',
  wifi_connected: 'Wi-Fi connected',
  provisioning: 'Provisioning device',
  provisioned: 'Provisioning complete',
};

const WIFI_STATUS_LABELS: Record<string, string> = {
  WL_IDLE_STATUS: 'Waiting for the network',
  WL_NO_SSID_AVAIL: 'Network not found',
  WL_SCAN_COMPLETED: 'Network scan completed',
  WL_CONNECTED: 'Connected',
  WL_CONNECT_FAILED: 'Password rejected',
  WL_CONNECTION_LOST: 'Connection lost',
  WL_DISCONNECTED: 'Disconnected',
};

const humanizeToken = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const getProvisionProgressCopy = ({
  statusUpdate,
  provisionStep,
  phase,
}: {
  statusUpdate: ReturnType<typeof useBleProvision>['state']['statusUpdate'];
  provisionStep: ProvisionStep;
  phase: ReturnType<typeof useBleProvision>['state']['phase'];
}): {
  title: string;
  message: string;
  details: ProgressDetail[];
} => {
  if (provisionStep === 'linking') {
    return {
      title: 'Finishing setup',
      message: 'Wi-Fi is connected. Linking the display to your account now.',
      details: statusUpdate?.deviceId
        ? [{label: 'Display', value: statusUpdate.deviceId}]
        : [],
    };
  }

  if (phase === 'reconnecting') {
    return {
      title: 'Still working on it',
      message: 'Keep the app open. The display is reconnecting and setup will continue automatically. This can take up to 6 minutes.',
      details: statusUpdate?.deviceId
        ? [{label: 'Display', value: statusUpdate.deviceId}]
        : [],
    };
  }

  const phaseLabel = statusUpdate?.phase ? (PHASE_LABELS[statusUpdate.phase] ?? humanizeToken(statusUpdate.phase)) : null;
  const wifiStatusLabel = statusUpdate?.wifiStatus
    ? (WIFI_STATUS_LABELS[statusUpdate.wifiStatus] ?? humanizeToken(statusUpdate.wifiStatus))
    : null;

  let title = 'Connecting to Wi-Fi';
  let message = 'The display is joining your network. This usually takes a few seconds.';

  switch (statusUpdate?.phase) {
    case 'scanning':
      title = 'Scanning for your network';
      message = 'The display is looking for the Wi-Fi network you selected.';
      break;
    case 'wifi_connecting':
      title = 'Joining Wi-Fi';
      message = 'The display is trying to connect to your network.';
      break;
    case 'wifi_connected':
      title = 'Wi-Fi connected';
      message = 'The display joined your network. Finalizing device setup.';
      break;
    case 'provisioning':
      title = 'Provisioning device';
      message = 'Sending the final setup details to your display.';
      break;
    case 'provisioned':
      title = 'Provisioning complete';
      message = 'The display finished setup. Finalizing your account link.';
      break;
    default:
      if (statusUpdate?.status === 'connected') {
        title = 'Wi-Fi connected';
        message = 'The display is online. Wrapping up setup now.';
      } else if (statusUpdate?.status === 'connecting') {
        title = 'Working on it';
        message = 'The display is still processing your Wi-Fi connection.';
      }
      break;
  }

  const details: ProgressDetail[] = [];

  if (phaseLabel) {
    details.push({label: 'Latest update', value: phaseLabel});
  }

  if (statusUpdate?.attempt !== null && statusUpdate?.attempt !== undefined) {
    details.push({
      label: 'Attempt',
      value:
        statusUpdate.attempts !== null && statusUpdate.attempts !== undefined
          ? `${statusUpdate.attempt} of ${statusUpdate.attempts}`
          : `${statusUpdate.attempt}`,
    });
  }

  if (wifiStatusLabel) {
    details.push({label: 'Wi-Fi status', value: wifiStatusLabel});
  }

  return {title, message, details};
};

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
  showProgress: boolean;
  progressTitle: string;
  progressMessage: string;
  progressDetails: ProgressDetail[];
  onClose: () => void;
  onConnect: (ssid: string, password: string, username: string) => void;
}

function PasswordModal({
  visible,
  network,
  isManual,
  isBusy,
  errorMsg,
  showProgress,
  progressTitle,
  progressMessage,
  progressDetails,
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
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!showProgress) {
          onClose();
        }
      }}>
      <SafeAreaView style={modal.container} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={{flex: 1}}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={modal.navBar}>
            <Pressable
              style={[modal.navBtn, showProgress && modal.navBtnDisabled]}
              onPress={onClose}
              disabled={showProgress}
              hitSlop={12}>
              <Text style={modal.navCancel}>✕</Text>
            </Pressable>
            <Text style={modal.navTitle} numberOfLines={1}>
              {title}
            </Text>
            {showProgress ? (
              <View style={[modal.navBtn, modal.navBtnRight]} />
            ) : (
              <Pressable
                style={[modal.navBtn, modal.navBtnRight]}
                onPress={handleConnect}
                disabled={!canConnect || isBusy}
                hitSlop={12}>
                <Text style={[modal.navConnect, (!canConnect || isBusy) && modal.navConnectDim]}>
                  Connect
                </Text>
              </Pressable>
            )}
          </View>

          <ScrollView
            contentContainerStyle={[modal.body, showProgress && modal.progressBody]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {showProgress ? (
              <View style={modal.progressShell}>
                <View style={modal.progressSpinnerWrap}>
                  <ActivityIndicator size="large" color={colors.accent} style={modal.progressSpinner} />
                </View>
                <View style={modal.progressCopy}>
                  <Text style={modal.progressTitle}>{progressTitle}</Text>
                  <Text style={modal.progressMessage}>{progressMessage}</Text>
                </View>
                {progressDetails.length > 0 && (
                  <View style={modal.progressDetails}>
                    {progressDetails.map(detail => (
                      <View key={`${detail.label}-${detail.value}`} style={modal.progressDetailRow}>
                        <Text style={modal.progressDetailLabel}>{detail.label}</Text>
                        <Text style={modal.progressDetailValue}>{detail.value}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <>
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
                      <Text style={modal.openText}>This network is open. No password is required.</Text>
                    </View>
                  )}
                </View>

                {errorMsg.length > 0 && (
                  <Text style={modal.errorText}>{errorMsg}</Text>
                )}
              </>
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
  const params = useLocalSearchParams<{deviceId?: string; mode?: string; offline?: string}>();
  const {setDeviceId, setDeviceStatus} = useAppState();
  const {hydrate} = useAuth();
  const targetDeviceId = typeof params.deviceId === 'string' ? params.deviceId : null;
  const isChangeWifiFlow = params.mode === 'change-wifi';
  const isDeviceOffline = isChangeWifiFlow && params.offline === 'true';

  const {state, startScan, selectFoundDevice, connectToDevice, sendCredentials, requestWifiScan, clearError, reset} =
    useBleProvision({targetDeviceId});

  const [modalVisible, setModalVisible] = useState(false);
  const [modalNetwork, setModalNetwork] = useState<WifiNetwork | null>(null);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [provisionStep, setProvisionStep] = useState<ProvisionStep>('idle');
  const pairingTokenRef = useRef<string | null>(null);
  const hasRequestedScanRef = useRef(false);
  const bluetoothMessage = state.bluetoothMessage;

  const isProvisioning = provisionStep !== 'idle';
  const isBusy =
    state.phase === 'requesting_permission' ||
    state.phase === 'scanning' ||
    state.phase === 'connecting' ||
    state.phase === 'provisioning' ||
    state.phase === 'waiting_wifi' ||
    state.phase === 'reconnecting' ||
    isProvisioning;
  const canStartScan = !isBusy && !bluetoothMessage;

  const modalError =
    state.errorMsg ??
    (linkError.length > 0 ? linkError : '');
  const showProvisionProgress =
    modalVisible &&
    (
      state.phase === 'provisioning' ||
      state.phase === 'waiting_wifi' ||
      state.phase === 'reconnecting' ||
      provisionStep !== 'idle' ||
      (state.statusUpdate?.status === 'connected' && !state.errorMsg && linkError.length === 0)
    );
  const provisionProgress = getProvisionProgressCopy({
    statusUpdate: state.statusUpdate,
    provisionStep,
    phase: state.phase,
  });

  useEffect(() => {
    if (targetDeviceId && state.phase === 'idle') {
      startScan();
    }
  }, [startScan, state.phase, targetDeviceId]);

  useEffect(() => {
    if (state.phase === 'connected' && !hasRequestedScanRef.current) {
      hasRequestedScanRef.current = true;
      requestWifiScan();
    }
  }, [state.phase, requestWifiScan]);

  // In offline change-wifi mode: auto-retry the scan every 20s after failure.
  // The device takes up to 2 minutes to start BLE advertising after WiFi drops.
  useEffect(() => {
    if (!isDeviceOffline || state.phase !== 'error') return;
    const timer = setTimeout(() => {
      reset();
      // reset() sets phase back to 'idle', which triggers the existing auto-scan effect above
    }, 20_000);
    return () => clearTimeout(timer);
  }, [isDeviceOffline, state.phase, reset]);

  const fetchPairingToken = async (expectedDeviceId?: string | null) => {
    pairingTokenRef.current = null;
    try {
      const res = await apiFetch('/device/pairing-token', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({expectedDeviceId: expectedDeviceId ?? state.deviceId ?? null}),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && typeof data?.token === 'string') {
        pairingTokenRef.current = data.token;
      }
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    if (!targetDeviceId || state.phase !== 'device_found' || state.foundDevice) {
      return;
    }
    const matchedDevice = state.foundDevices.find(device => device.name === targetDeviceId);
    if (!matchedDevice) {
      return;
    }
    selectFoundDevice(matchedDevice);
    void connectToDevice(matchedDevice).then(success => {
      if (success) {
        void fetchPairingToken(matchedDevice.name);
      }
    });
  }, [connectToDevice, selectFoundDevice, state.foundDevice, state.foundDevices, state.phase, targetDeviceId]);

  const openNetworkModal = (network: WifiNetwork) => {
    clearError();
    setModalNetwork(network);
    setIsManualEntry(false);
    setLinkError('');
    setModalVisible(true);
  };

  const openManualModal = () => {
    clearError();
    setModalNetwork(null);
    setIsManualEntry(true);
    setLinkError('');
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    clearError();
    setLinkError('');
    setModalNetwork(null);
    setIsManualEntry(false);
    setModalVisible(false);
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
    setDeviceStatus('pairedOffline');
    setProvisionStep('linking');

    try {
      const result = await withTimeout(
        registerAndLinkDevice(espDeviceId),
        LINK_COMPLETION_TIMEOUT_MS,
        'The display finished provisioning, but the app took too long to finish linking it to your account.',
      );
      if (!result.ok) {
        setLinkError(result.error);
        return;
      }

      setModalVisible(false);
      await withTimeout(
        hydrate(),
        LINK_COMPLETION_TIMEOUT_MS,
        'The display finished provisioning, but the app could not refresh your account in time.',
      );
      router.replace(postPairingRoute);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      setLinkError(
        message || 'The display finished provisioning, but the app could not finish setup. Check your internet connection and try again.',
      );
    } finally {
      setProvisionStep('idle');
    }
  };

  if (!supportsBleProvisioning) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <AppBrandHeader />
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
      <AppBrandHeader />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroBlock}>
          <Text style={styles.heading}>{isChangeWifiFlow ? 'Change Wi-Fi network' : 'Set up your device'}</Text>
        </View>

        {/* Phase: idle / error */}
        {(state.phase === 'idle' || state.phase === 'error') && (
          <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.section}>
            {bluetoothMessage && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{bluetoothMessage}</Text>
              </View>
            )}
            {state.phase === 'error' && state.errorMsg && state.errorMsg !== bluetoothMessage && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{state.errorMsg}</Text>
              </View>
            )}
            <Pressable
              style={[styles.primaryButton, !canStartScan && styles.primaryButtonDisabled]}
              onPress={startScan}
              disabled={!canStartScan}>
              <Text style={styles.primaryText}>
                {bluetoothMessage ? 'Turn on Bluetooth to continue' : 'Find my CommuteLive display'}
              </Text>
            </Pressable>
            {isDeviceOffline && state.phase !== 'error' && (
              <Text style={styles.scanHint}>
                Your display isn{"'"}t connected to Wi-Fi. It will appear here automatically once it enters setup mode — this can take up to 2 minutes.
              </Text>
            )}
            {isDeviceOffline && state.phase === 'error' && (
              <Text style={styles.scanHint}>
                Display not found yet — retrying automatically every 20 seconds. Keep this screen open.
              </Text>
            )}
            {!isDeviceOffline && state.phase === 'error' && (
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
              <Text style={styles.scanHint}>
                {isDeviceOffline
                  ? 'Waiting for display to enter setup mode. Keep this screen open.'
                  : 'Make sure the device is powered on.'}
              </Text>
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
                const connected = await connectToDevice();
                if (connected) {
                  fetchPairingToken(state.foundDevice?.name ?? state.deviceId);
                }
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
              <View style={[styles.dot, styles.dotActive]} />
              <Text style={styles.connectedText}>
                Connected to {state.foundDevice?.name ?? 'device'}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Choose a Wi‑Fi network</Text>

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
                <Text style={styles.rescanText}>↺  Rescan for networks</Text>
              </Pressable>
            )}
          </Animated.View>
        )}

        {/* Phase: done */}
        {state.phase === 'done' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.section}>
            <View style={styles.successCard}>
              <View style={styles.successIconWrap}>
                <Text style={styles.successIconText}>✓</Text>
              </View>
              <View style={styles.successCopy}>
                <Text style={styles.successTitle}>Display is online!</Text>
                <Text style={styles.successSubtitle}>Redirecting you to the dashboard...</Text>
              </View>
            </View>
          </Animated.View>
        )}

        <Pressable style={styles.skipLink} onPress={() => router.push('/dashboard')}>
          <Text style={styles.skipText}>I'll set this up later</Text>
        </Pressable>
      </ScrollView>

      {modalVisible && (
        <PasswordModal
          visible
          network={modalNetwork}
          isManual={isManualEntry}
          isBusy={isBusy}
          errorMsg={modalError}
          showProgress={showProvisionProgress}
          progressTitle={provisionProgress.title}
          progressMessage={provisionProgress.message}
          progressDetails={provisionProgress.details}
          onClose={handleCloseModal}
          onConnect={handleConnect}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  scrollView: {flex: 1},
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
    fontWeight: '800',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  section: {gap: spacing.md},
  sectionTitle: {color: colors.text, fontSize: typography.body, fontWeight: '700', marginBottom: spacing.sm},
  errorCard: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  errorText: {color: colors.dangerText, fontSize: typography.body, lineHeight: 20},
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: colors.successBorder,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  connectedText: {color: colors.successText, fontWeight: '700', fontSize: typography.body},
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
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  enterpriseText: {color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.3},
  manualEntryText: {flex: 1, color: colors.accent, fontSize: typography.bodyLg, fontWeight: '600'},
  rescanRow: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rescanText: {color: colors.accent, fontSize: typography.body, fontWeight: '700'},
  dot: {width: 8, height: 8, borderRadius: 4},
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
  primaryText: {color: colors.onAccent, fontWeight: '800', fontSize: 15},
  secondaryButton: {
    borderColor: colors.border,
    borderWidth: 1,
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {color: colors.textMuted, fontWeight: '700', fontSize: typography.bodyLg},
  successCard: {
    backgroundColor: colors.successSurface,
    borderColor: colors.successBorder,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: layout.cardPaddingLg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  successIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  successIconText: {color: '#fff', fontSize: 18, fontWeight: '800'},
  successCopy: {flex: 1, gap: spacing.xxs},
  successTitle: {color: colors.successText, fontSize: typography.bodyLg, fontWeight: '800'},
  successSubtitle: {color: colors.successTextSoft, fontSize: typography.body},
  skipLink: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skipText: {color: colors.textSecondary, fontWeight: '600', fontSize: typography.body},
  unsupportedWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.screenPadding,
    gap: spacing.md,
  },
  unsupportedCard: {
    backgroundColor: colors.card,
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
  navBtnDisabled: {
    opacity: 0.3,
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
  progressBody: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
  },
  progressShell: {
    minHeight: 420,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
  },
  progressSpinnerWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSpinner: {
    transform: [{scale: 1.8}],
  },
  progressCopy: {
    gap: spacing.xs,
    alignItems: 'center',
  },
  progressTitle: {
    color: colors.text,
    fontSize: typography.titleLg,
    fontWeight: '800',
    textAlign: 'center',
  },
  progressMessage: {
    color: colors.textMuted,
    fontSize: typography.bodyLg,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
  progressDetails: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  progressDetailRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xxs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  progressDetailLabel: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '600',
  },
  progressDetailValue: {
    color: colors.text,
    fontSize: typography.bodyLg,
    fontWeight: '600',
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
    color: colors.dangerText,
    fontSize: typography.body,
    textAlign: 'center',
    lineHeight: 20,
  },
});
