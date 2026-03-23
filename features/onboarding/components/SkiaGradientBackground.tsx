import React from 'react';
import {StyleSheet, View} from 'react-native';
import {onboardingPalette} from '../constants';

export default function SkiaGradientBackground() {
  return <View pointerEvents="none" style={styles.backdrop} />;
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: onboardingPalette.base,
  },
});
