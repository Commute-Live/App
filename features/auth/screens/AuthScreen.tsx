import React, {useState} from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import {MaterialIcons} from '@expo/vector-icons';
import {GoogleLogo} from '../../../components/GoogleLogo';
import {colors, spacing, radii} from '../../../theme';
import {ExternalLink} from '../../../components/ExternalLink';
import {useAppleAuth} from '../hooks/useAppleAuth';
import {useGoogleAuth} from '../hooks/useGoogleAuth';

export default function AuthScreen() {
  const {isAvailable: appleAvailable, signInWithApple} = useAppleAuth();
  const {signInWithGoogle} = useGoogleAuth();
  const [errorText, setErrorText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleApple = async () => {
    setErrorText('');
    setIsLoading(true);
    const result = await signInWithApple();
    setIsLoading(false);
    if (!result.ok && result.error !== 'cancelled') {
      setErrorText(result.error ?? 'Apple Sign-In failed');
    }
  };

  const handleGoogle = async () => {
    setErrorText('');
    setIsLoading(true);
    const result = await signInWithGoogle();
    setIsLoading(false);
    if (!result.ok && result.error !== 'cancelled') {
      setErrorText(result.error ?? 'Google Sign-In failed');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <View style={styles.brandSection}>
          <View style={styles.logoFrame}>
            <Image source={require('../../../assets/images/app-logo.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.title}>CommuteLive</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        <View style={styles.actionsCard}>
          <View style={styles.actionsHeader}>
            <Text style={styles.actionsTitle}>Welcome back</Text>
            <Text style={styles.actionsSubtitle}>Choose a trusted provider to access your account.</Text>
          </View>

          <View style={styles.actionsSection}>
            {Platform.OS === 'ios' && appleAvailable && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={radii.md}
                style={[styles.appleButton, isLoading && styles.buttonDisabled]}
                onPress={handleApple}
              />
            )}

            <Pressable
              style={[styles.googleButton, isLoading && styles.buttonDisabled]}
              onPress={handleGoogle}
              disabled={isLoading}>
              <View style={styles.googleIcon}>
                <GoogleLogo size={18} />
              </View>
              <Text style={styles.googleText}>Continue with Google</Text>
            </Pressable>

            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

            <View style={styles.securityNote}>
              <View style={styles.securityIconWrap}>
                <MaterialIcons name="lock" size={14} color={colors.success} />
              </View>
              <View style={styles.securityCopy}>
                <Text style={styles.securityTitle}>Secure sign-in</Text>
                <Text style={styles.securityText}>Authentication is handled through trusted Apple and Google sign-in.</Text>
              </View>
            </View>
          </View>
        </View>

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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  brandSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
  },
  logoFrame: {
    width: 192,
    height: 192,
    borderRadius: 40,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logo: {
    width: 150,
    height: 150,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  actionsCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  actionsHeader: {
    gap: 4,
  },
  actionsTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  actionsSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  actionsSection: {
    gap: spacing.md,
  },
  appleButton: {
    height: 52,
    borderRadius: radii.md,
  },
  googleButton: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: colors.card,
    minHeight: 52,
  },
  googleIcon: {marginRight: 8},
  googleText: {color: colors.text, fontWeight: '700', fontSize: 15},
  buttonDisabled: {opacity: 0.5},
  errorText: {color: '#FCA5A5', fontSize: 12, fontWeight: '700', textAlign: 'center'},
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  securityIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0F1A14',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  securityCopy: {
    flex: 1,
  },
  securityTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  securityText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  legalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: spacing.lg,
  },
  legalText: {color: colors.textMuted, fontSize: 12},
  legalLink: {color: colors.accent, fontSize: 12, fontWeight: '700'},
});
