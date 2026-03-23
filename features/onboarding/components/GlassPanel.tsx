import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {StyleSheet, View} from 'react-native';
import {onboardingPalette} from '../constants';
import {BlurViewCompat} from '../../../lib/nativeCompat';

export default function GlassPanel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.panel, style]}>
      <BlurViewCompat intensity={28} tint="dark" style={styles.blur}>
        <View style={styles.content}>{children}</View>
      </BlurViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: onboardingPalette.border,
    backgroundColor: onboardingPalette.surface,
    boxShadow: `0 10px 28px ${onboardingPalette.shadow}`,
  },
  blur: {
    backgroundColor: onboardingPalette.surface,
  },
  content: {
    backgroundColor: 'rgba(3, 3, 3, 0.08)',
    padding: 18,
  },
});
