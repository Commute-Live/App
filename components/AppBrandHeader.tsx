import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import {colors, layout, spacing} from '../theme';

type Props = {
  email?: string | null;
};

export function AppBrandHeader({email}: Props) {
  const initial = email?.trim().charAt(0).toUpperCase();

  return (
    <View style={styles.header}>
      <View style={styles.logoWrap}>
        <Image source={require('../assets/images/app-logo.png')} style={styles.logo} resizeMode="contain" />
      </View>
      <View style={styles.wordmarkWrap}>
        <Text style={styles.wordmark}>CommuteLive</Text>
      </View>
      <View style={styles.rightWrap}>
        {initial ? (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: layout.headerHeight,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  logoWrap: {
    position: 'absolute',
    left: layout.screenPadding,
    width: layout.chromeSize,
    height: layout.chromeSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: layout.logoSize,
    height: layout.logoSize,
  },
  wordmarkWrap: {
    minWidth: 0,
  },
  wordmark: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  rightWrap: {
    position: 'absolute',
    right: layout.screenPadding,
    width: layout.chromeSize,
    height: layout.chromeSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: layout.chromeSize,
    height: layout.chromeSize,
    borderRadius: layout.chromeSize / 2,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  placeholder: {
    width: layout.chromeSize,
    height: layout.chromeSize,
  },
});
