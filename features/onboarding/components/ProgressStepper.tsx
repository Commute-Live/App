import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {onboardingPalette} from '../constants';

export default function ProgressStepper({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.dots}>
        {Array.from({length: total}, (_, index) => (
          <View
            key={index}
            style={[styles.dot, index < current ? styles.dotActive : styles.dotIdle]}
          />
        ))}
      </View>
      <Text style={styles.label} selectable>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 28,
    height: 4,
    borderRadius: 999,
  },
  dotActive: {
    backgroundColor: onboardingPalette.text,
  },
  dotIdle: {
    backgroundColor: 'rgba(233, 236, 239, 0.16)',
  },
  label: {
    color: onboardingPalette.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
