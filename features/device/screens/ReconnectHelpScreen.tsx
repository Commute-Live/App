import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {ScreenHeader} from '../../../components/ScreenHeader';
import {colors, layout, radii, spacing, typography} from '../../../theme';
import {useAppState} from '../../../state/appState';
import {useAuth} from '../../../state/authProvider';
import {forceReconnectMqtt, resetDeviceWifi} from '../../../lib/deviceSetup';
import {logger} from '../../../lib/datadog';

const tips = [
  {
    icon: 'power-outline' as const,
    title: 'Power cycle the display',
    subtitle: 'Unplug for 10 seconds, then plug back in.',
  },
  {
    icon: 'wifi-outline' as const,
    title: 'Check Wi-Fi status',
    subtitle: 'Confirm the display is on the same network.',
  },
  {
    icon: 'refresh-outline' as const,
    title: 'Retry pairing',
    subtitle: 'Resend the pairing request if needed.',
  },
];

export default function ReconnectHelpScreen() {
  const router = useRouter();
  const {deviceId: authDeviceId} = useAuth();
  const {state: appState} = useAppState();
  const currentDeviceId = authDeviceId ?? appState.deviceId;
  const [isChangingWifi, setIsChangingWifi] = useState(false);
  const [changeWifiError, setChangeWifiError] = useState('');
  const [isReconnectingMqtt, setIsReconnectingMqtt] = useState(false);
  const [mqttReconnectError, setMqttReconnectError] = useState('');

  const handleReconnectMqtt = async () => {
    if (!currentDeviceId || isReconnectingMqtt) return;
    setIsReconnectingMqtt(true);
    setMqttReconnectError('');
    try {
      const result = await forceReconnectMqtt(currentDeviceId);
      if (!result.ok) {
        logger.error('ReconnectHelp: MQTT reconnect failed', {deviceId: currentDeviceId, error: result.error});
        setMqttReconnectError(result.error);
        return;
      }
      router.push('/dashboard');
    } finally {
      setIsReconnectingMqtt(false);
    }
  };

  const handleChangeWifi = async () => {
    if (!currentDeviceId || isChangingWifi) return;
    setIsChangingWifi(true);
    setChangeWifiError('');
    try {
      const result = await resetDeviceWifi(currentDeviceId);
      if (!result.ok) {
        logger.error('ReconnectHelp: Wi-Fi reset failed', {deviceId: currentDeviceId, error: result.error});
        setChangeWifiError(result.error);
        return;
      }
      const offlineParam = result.deviceOnline ? '' : '&offline=true';
      router.push(`/ble-provision?deviceId=${encodeURIComponent(currentDeviceId)}&mode=change-wifi${offlineParam}`);
    } finally {
      setIsChangingWifi(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Reconnect Help" />

        <Text style={styles.heading}>Paired, but offline</Text>
        <Text style={styles.subheading}>
          Let's get your display back online with a few quick checks.
        </Text>

        {tips.map(tip => (
          <View key={tip.title} style={styles.card}>
            <View style={styles.row}>
              <Ionicons name={tip.icon} size={20} color={colors.accent} />
              <View style={styles.textWrap}>
                <Text style={styles.cardTitle}>{tip.title}</Text>
                <Text style={styles.cardSubtitle}>{tip.subtitle}</Text>
              </View>
            </View>
          </View>
        ))}

        {currentDeviceId ? (
          <>
            <Pressable
              style={[styles.secondaryButton, isReconnectingMqtt && styles.buttonDisabled]}
              onPress={() => { void handleReconnectMqtt(); }}
              disabled={isReconnectingMqtt}>
              <Text style={styles.secondaryText}>
                {isReconnectingMqtt ? 'Reconnecting…' : 'Force MQTT reconnect'}
              </Text>
            </Pressable>
            {mqttReconnectError ? (
              <Text style={styles.errorText}>{mqttReconnectError}</Text>
            ) : null}
            <Pressable
              style={[styles.secondaryButton, isChangingWifi && styles.buttonDisabled]}
              onPress={() => { void handleChangeWifi(); }}
              disabled={isChangingWifi}>
              <Text style={styles.secondaryText}>
                {isChangingWifi ? 'Starting setup…' : 'Change Wi-Fi network'}
              </Text>
            </Pressable>
            {changeWifiError ? (
              <Text style={styles.errorText}>{changeWifiError}</Text>
            ) : null}
          </>
        ) : null}

        <Pressable style={styles.ghostButton} onPress={() => router.back()}>
          <Text style={styles.ghostText}>Back to status</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/dashboard')}>
          <Text style={styles.primaryText}>I'm back online</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: layout.screenPadding, paddingBottom: spacing.md, gap: spacing.md},
  footer: {padding: layout.screenPadding, paddingBottom: spacing.sm},
  heading: {color: colors.text, fontSize: typography.titleLg, fontWeight: '800'},
  subheading: {color: colors.textMuted, fontSize: typography.body, lineHeight: 18, marginBottom: spacing.sm},
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: layout.cardPadding,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  textWrap: {flex: 1},
  cardTitle: {color: colors.text, fontSize: typography.bodyLg, fontWeight: '700'},
  cardSubtitle: {color: colors.textMuted, fontSize: typography.label, marginTop: spacing.xxs},
  primaryButton: {
    backgroundColor: colors.accent,
    minHeight: layout.buttonHeight,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {color: colors.onAccent, fontWeight: '800', fontSize: typography.bodyLg},
  secondaryButton: {
    borderColor: colors.border,
    borderWidth: 1,
    minHeight: layout.buttonHeight,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {color: colors.text, fontWeight: '700', fontSize: typography.body},
  buttonDisabled: {opacity: 0.5},
  ghostButton: {
    minHeight: layout.buttonHeight,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {color: colors.textMuted, fontWeight: '700', fontSize: typography.body},
  errorText: {color: colors.dangerText, fontSize: typography.label, textAlign: 'center'},
});
