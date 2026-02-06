import React from 'react';
import {ScrollView, StyleSheet, Text, View, Pressable} from 'react-native';
import {useRouter} from 'expo-router';
import {ActionCard} from '../components/ActionCard';
import {PreviewCard} from '../components/PreviewCard';
import {colors, spacing} from '../theme';
import {useAppState} from '../state/appState';

export default function Dashboard() {
  const router = useRouter();
  const {
    state: {selectedStations},
  } = useAppState();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Commute Live</Text>
      <Text style={styles.subheading}>
        What your display shows • {selectedStations.length} stations selected
      </Text>

      <PreviewCard />

      <ActionCard
        title="Edit Stations"
        subtitle="Choose which stops appear"
        icon="train-outline"
        onPress={() => router.push('/edit-stations')}
      />
      <ActionCard
        title="Change Layout"
        subtitle="Theme, behavior, density"
        icon="color-palette-outline"
        onPress={() => router.push('/change-layout')}
      />
      <ActionCard
        title="Switch Preset"
        subtitle="Morning / Evening / Event"
        icon="sparkles-outline"
        onPress={() => router.push('/switch-preset')}
      />
      <ActionCard
        title="Brightness"
        subtitle="Display intensity & auto-dim"
        icon="sunny-outline"
        onPress={() => router.push('/brightness')}
      />

      <Pressable style={styles.advanced} onPress={() => router.push('/modal')}>
        <Text style={styles.advancedText}>Advanced Settings</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg},
  heading: {color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: spacing.xs},
  subheading: {color: colors.textMuted, fontSize: 14, marginBottom: spacing.lg},
  advanced: {marginTop: spacing.sm, alignSelf: 'flex-start', paddingVertical: spacing.sm},
  advancedText: {color: colors.textMuted, textDecorationLine: 'underline', fontSize: 13},
});
