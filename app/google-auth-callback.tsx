import React, {useEffect} from 'react';
import {ActivityIndicator, Platform, StyleSheet, Text, View} from 'react-native';
import {GOOGLE_AUTH_MESSAGE_TYPE} from '../lib/googleWebAuth';
import {colors, spacing, typography} from '../theme';

export default function GoogleAuthCallbackScreen() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        {
          type: GOOGLE_AUTH_MESSAGE_TYPE,
          hash: window.location.hash,
        },
        window.location.origin,
      );
    }

    window.close();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.text}>Finishing Google sign-in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  text: {
    color: colors.text,
    fontSize: typography.body,
    textAlign: 'center',
  },
});
