import React, {useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {ScreenHeader} from '../components/ScreenHeader';
import {colors, spacing, radii} from '../theme';
import {useAppState} from '../state/appState';

const STATION_CATALOG = [
  'Westlake Station',
  'South Lake Union',
  'Capitol Hill',
  'University District',
  'International District',
  'Beacon Hill',
  'Airport Link',
  'Ballard Rapid',
  'Fremont Bridge',
];

export default function EditStations() {
  const {state, addStation, removeStation} = useAppState();
  const [query, setQuery] = useState('');

  const results = useMemo(
    () =>
      STATION_CATALOG.filter(name =>
        name.toLowerCase().includes(query.trim().toLowerCase()),
      ).slice(0, 6),
    [query],
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="Edit Stations" />

      <View style={styles.section}>
        <Text style={styles.label}>City / Provider</Text>
        <Text style={styles.value}>Seattle • King County Metro</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Selected stations</Text>
        {state.selectedStations.map(station => (
          <View key={station} style={styles.selectedRow}>
            <Text style={styles.selectedText}>{station}</Text>
            <Pressable onPress={() => removeStation(station)} style={styles.removeBtn}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        ))}
        {state.selectedStations.length === 0 && (
          <Text style={styles.empty}>No stations yet. Add one below.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Search & add</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search station name"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        {results.map(station => (
          <Pressable key={station} style={styles.resultRow} onPress={() => addStation(station)}>
            <Text style={styles.resultText}>{station}</Text>
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg},
  section: {marginBottom: spacing.lg},
  label: {color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm},
  value: {color: colors.text, fontSize: 15, fontWeight: '600'},
  selectedRow: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  selectedText: {color: colors.text, flex: 1, fontWeight: '700'},
  removeBtn: {paddingHorizontal: spacing.sm, paddingVertical: spacing.xs},
  removeText: {color: colors.textMuted, fontSize: 13},
  empty: {color: colors.textMuted, fontSize: 13},
  input: {
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B0F13',
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  resultText: {flex: 1, color: colors.text},
  addText: {color: colors.accent, fontWeight: '700'},
});
