import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {ScreenHeader} from '../../../components/ScreenHeader';
import {colors, layout, radii, spacing, typography} from '../../../theme';

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Reconnect Help" />

        <Text style={styles.heading}>Paired, but offline</Text>
        <Text style={styles.subheading}>
          Let’s get your display back online with a few quick checks.
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

        <Pressable style={styles.primaryButton} onPress={() => router.push('/dashboard')}>
          <Text style={styles.primaryText}>I'm back online</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>Back to status</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: layout.screenPadding, gap: spacing.md},
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
  primaryText: {color: colors.background, fontWeight: '800', fontSize: typography.bodyLg},
  secondaryButton: {
    borderColor: colors.border,
    borderWidth: 1,
    minHeight: layout.buttonHeight,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {color: colors.textMuted, fontWeight: '700', fontSize: typography.body},
});
