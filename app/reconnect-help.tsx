import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {ScreenHeader} from '../components/ScreenHeader';
import {colors, spacing, radii} from '../theme';

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

export default function ReconnectHelp() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg},
  heading: {color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: spacing.xs},
  subheading: {color: colors.textMuted, fontSize: 13, marginBottom: spacing.lg},
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  textWrap: {flex: 1},
  cardTitle: {color: colors.text, fontSize: 15, fontWeight: '700'},
  cardSubtitle: {color: colors.textMuted, fontSize: 12, marginTop: 4},
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryText: {color: colors.background, fontWeight: '800', fontSize: 14},
  secondaryButton: {
    borderColor: colors.border,
    borderWidth: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryText: {color: colors.textMuted, fontWeight: '700', fontSize: 13},
});
