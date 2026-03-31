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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.mainSection}>
          <View style={styles.brandSection}>
            <View style={styles.logoFrame}>
              <Image source={require('../../../assets/images/app-logo.png')} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={styles.title}>CommuteLive</Text>
            <Text style={styles.subtitle}>Your live transit board, ready when you are.</Text>
          </View>

          <View style={styles.actionsCard}>
            <View style={styles.actionsSection}>
              {Platform.OS === 'ios' && appleAvailable && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
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
            </View>

            <Text style={styles.securityText}>Secure sign-in is handled directly by Apple and Google.</Text>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    justifyContent: 'space-between',
  },
  mainSection: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  brandSection: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  logoFrame: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 74,
    height: 74,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 260,
  },
  actionsCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  actionsSection: {
    gap: spacing.sm,
  },
  appleButton: {
    height: 44,
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
    minHeight: 48,
  },
  googleIcon: {marginRight: 8},
  googleText: {color: colors.text, fontWeight: '700', fontSize: 15},
  buttonDisabled: {opacity: 0.5},
  errorText: {color: '#FCA5A5', fontSize: 12, fontWeight: '700', textAlign: 'center'},
  securityText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  legalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  legalText: {color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center'},
  legalLink: {color: colors.accent, fontSize: 12, fontWeight: '700'},
});
