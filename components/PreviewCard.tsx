import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors, layout, spacing, radii, typography} from '../theme';
import {useAppState} from '../state/appState';

const themeBackground: Record<string, string> = {
  mono: '#3B2C21',
  metro: '#4B3829',
  bold: '#5B4331',
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
    padding: layout.cardPaddingLg,
    borderWidth: 1,
    borderColor: colors.previewBorder,
    gap: spacing.sm,
  },
  headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  statusRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  label: {color: colors.previewTextMuted, fontSize: typography.body, letterSpacing: 0.4},
  meta: {color: colors.previewText, fontSize: typography.body, fontWeight: '600'},
  arrivalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomColor: colors.previewBorderMuted,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  linePill: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    marginRight: spacing.md,
  },
  lineText: {color: colors.onAccent, fontWeight: '700', fontSize: typography.body},
  destination: {flex: 1, color: colors.previewText, fontSize: typography.bodyLg, fontWeight: '600'},
  minutes: {color: colors.successTextSoft, fontWeight: '700'},
});
