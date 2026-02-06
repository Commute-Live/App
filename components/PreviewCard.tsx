import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors, spacing, radii} from '../theme';
import {useAppState} from '../state/appState';

const themeBackground: Record<string, string> = {
  mono: '#0F1115',
  metro: '#0B1F2C',
  bold: '#1A0F21',
};

export const PreviewCard = () => {
  const {
    state: {arrivals, theme, density, brightness, preset, selectedStations, behavior},
  } = useAppState();

  return (
    <View style={[styles.card, {backgroundColor: themeBackground[theme]}]}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Live Preview</Text>
        <Text style={styles.meta}>{preset}</Text>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.meta}>{selectedStations.slice(0, 2).join(' • ') || 'No stations'}</Text>
        <Text style={styles.meta}>{behavior === 'stationary' ? 'Static' : behavior}</Text>
      </View>

      {arrivals.slice(0, density === 'large' ? 3 : 5).map(item => (
        <View key={`${item.line}-${item.destination}`} style={styles.arrivalRow}>
          <View style={styles.linePill}>
            <Text style={styles.lineText}>{item.line}</Text>
          </View>
          <Text style={styles.destination} numberOfLines={1}>
            {item.destination}
          </Text>
          <Text style={styles.minutes}>{item.minutes} min</Text>
        </View>
      ))}

    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  headerRow: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs},
  statusRow: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md},
  label: {color: colors.textMuted, fontSize: 13, letterSpacing: 0.4},
  meta: {color: colors.text, fontSize: 13, fontWeight: '600'},
  arrivalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  linePill: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 10,
    marginRight: spacing.md,
  },
  lineText: {color: colors.text, fontWeight: '700', fontSize: 13},
  destination: {flex: 1, color: colors.text, fontSize: 15, fontWeight: '600'},
  minutes: {color: colors.success, fontWeight: '700'},
});
