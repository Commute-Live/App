import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {ScreenHeader} from '../../../components/ScreenHeader';
import {colors, layout, radii, spacing, typography} from '../../../theme';
import {useAppState} from '../../../state/appState';
import {useAuth} from '../../../state/authProvider';
import {resetDeviceWifi} from '../../../lib/deviceSetup';
import {logger} from '../../../lib/datadog';

const tips = [
  {
    icon: 'power-outline' as const,
    title: 'Power cycle the display',
    subtitle: 'Unplug for 10 seconds, plug it back in, then wait up to 2 minutes to see if Wi-Fi reconnects.',
  },
  {
    icon: 'wifi-outline' as const,
    title: 'Still offline?',
    subtitle: 'If it is still not back online, tap "Change Wi-Fi network" at the bottom.',
  },
];

export default function ReconnectHelpScreen() {
  const router = useRouter();
  const {deviceId: authDeviceId} = useAuth();
  const {state: appState} = useAppState();
  const currentDeviceId = authDeviceId ?? appState.deviceId;
  const [isChangingWifi, setIsChangingWifi] = useState(false);
  const [changeWifiError, setChangeWifiError] = useState('');

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

        <View style={styles.heroCard}>
          <Text style={styles.heading}>Display Offline</Text>
          <Text style={styles.subheading}>
            Work through these steps in order before starting Wi-Fi setup again.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What To Do</Text>
          <View style={styles.checklist}>
            {tips.map((tip, index) => (
              <View key={tip.title} style={[styles.stepCard, index !== tips.length - 1 && styles.stepCardSeparated]}>
                <View style={styles.stepIconWrap}>
                  <Ionicons name={tip.icon} size={18} color={colors.accent} />
                </View>
                <View style={styles.stepTextWrap}>
                  <Text style={styles.stepEyebrow}>Step {index + 1}</Text>
                  <Text style={styles.stepTitle}>{tip.title}</Text>
                  <Text style={styles.stepSubtitle}>{tip.subtitle}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {currentDeviceId ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Need To Reconnect Wi-Fi?</Text>
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
          </View>
        ) : null}

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
  content: {padding: layout.screenPadding, paddingBottom: spacing.lg, gap: spacing.lg},
  footer: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: layout.cardPaddingLg,
    gap: spacing.xs,
  },
  heading: {color: colors.text, fontSize: typography.titleLg, fontWeight: '800'},
  subheading: {color: colors.textMuted, fontSize: typography.body, lineHeight: 20},
  section: {gap: spacing.sm},
  sectionTitle: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  checklist: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: spacing.md,
  },
  stepCardSeparated: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepTextWrap: {flex: 1, gap: spacing.xxs},
  stepEyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepTitle: {color: colors.text, fontSize: typography.bodyLg, fontWeight: '700'},
  stepSubtitle: {color: colors.textMuted, fontSize: typography.body, lineHeight: 19},
  primaryButton: {
    backgroundColor: colors.accent,
    minHeight: layout.buttonHeight,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {color: colors.onAccent, fontWeight: '800', fontSize: typography.bodyLg},
  secondaryButton: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    minHeight: layout.buttonHeight,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  secondaryText: {color: colors.text, fontWeight: '700', fontSize: typography.body},
  buttonDisabled: {opacity: 0.5},
  errorText: {color: colors.dangerText, fontSize: typography.label, textAlign: 'center'},
});
