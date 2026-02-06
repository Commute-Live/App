import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {colors, spacing, radii} from '../theme';

export default function MainEntry() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Commute Live</Text>
      <Text style={styles.subheading}>Choose how you'd like to continue.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Welcome</Text>
        <Text style={styles.cardSubtitle}>
          First-time users set up a device. Returning users pick a connected display.
        </Text>
      </View>

      <Pressable
        onPress={() => router.push('/setup-intro')}
        style={({pressed}) => [styles.actionCard, pressed && styles.pressed]}>
        <View style={styles.actionRow}>
          <View style={styles.iconWrap}>
            <Ionicons name="link-outline" size={22} color={colors.accent} />
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>First-time user</Text>
            <Text style={styles.actionSubtitle}>Set up your display and pair</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      </Pressable>

      <Pressable
        onPress={() => router.push('/paired-online')}
        style={({pressed}) => [styles.actionCard, pressed && styles.pressed]}>
        <View style={styles.actionRow}>
          <View style={styles.iconWrap}>
            <Ionicons name="sparkles-outline" size={22} color={colors.accent} />
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Old user</Text>
            <Text style={styles.actionSubtitle}>Select a connected device</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg},
  heading: {color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: spacing.xs},
  subheading: {color: colors.textMuted, fontSize: 14, marginBottom: spacing.lg},
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  cardTitle: {color: colors.text, fontSize: 16, fontWeight: '700'},
  cardSubtitle: {color: colors.textMuted, fontSize: 13, marginTop: 4},
  actionCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  pressed: {opacity: 0.85},
  actionRow: {flexDirection: 'row', alignItems: 'center'},
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#0F1A1D',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  actionText: {flex: 1},
  actionTitle: {color: colors.text, fontSize: 16, fontWeight: '700'},
  actionSubtitle: {color: colors.textMuted, fontSize: 13, marginTop: 2},
});
