import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {colors, spacing, radii} from '../../../theme';
import {ExternalLink} from '../../../components/ExternalLink';

export default function AuthScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <Image source={require('../../../app-logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.subtitle}>Welcome back. Continue to your account.</Text>

        <Pressable style={styles.primaryButton} onPress={() => router.push('/login')}>
          <Text style={styles.primaryText}>Login</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.push('/sign-up')}>
          <Text style={styles.secondaryText}>Sign Up</Text>
        </Pressable>

        <View style={styles.legalRow}>
          <Text style={styles.legalText}>By continuing, you agree to our </Text>
          <ExternalLink href="https://example.com/terms">
            <Text style={styles.legalLink}>Terms</Text>
          </ExternalLink>
          <Text style={styles.legalText}> and </Text>
          <ExternalLink href="https://example.com/privacy">
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </ExternalLink>
          <Text style={styles.legalText}>.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background, justifyContent: 'center'},
  content: {padding: spacing.lg, gap: 6},
  logo: {width: 280, height: 280, alignSelf: 'center'},
  subtitle: {color: colors.textMuted, fontSize: 14, textAlign: 'center'},
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  primaryText: {color: colors.background, fontWeight: '800', fontSize: 15},
  secondaryButton: {
    borderColor: colors.border,
    borderWidth: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  secondaryText: {color: colors.text, fontWeight: '700', fontSize: 15},
  legalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  legalText: {color: colors.textMuted, fontSize: 12},
  legalLink: {color: colors.accent, fontSize: 12, fontWeight: '700'},
});
