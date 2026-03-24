import React, {useState} from 'react';
import {Image, Platform, Pressable, StyleSheet, Text, View} from 'react-native';
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <Image source={require('../../../assets/images/app-logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>CommuteLive</Text>
        <Text style={styles.subtitle}>Sign in to manage your transit display.</Text>

        {Platform.OS === 'ios' && appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={radii.md}
            style={styles.appleButton}
            onPress={handleApple}
          />
        )}

        <Pressable
          style={[styles.googleButton, isLoading && styles.buttonDisabled]}
          onPress={handleGoogle}
          disabled={isLoading}>
          <View style={styles.googleIcon}><GoogleLogo size={18} /></View>
          <Text style={styles.googleText}>Continue with Google</Text>
        </Pressable>

        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

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
  content: {padding: spacing.lg, gap: spacing.sm},
  logo: {width: 280, height: 280, alignSelf: 'center'},
  title: {color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center'},
  subtitle: {color: colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: spacing.sm},
  appleButton: {height: 50, borderRadius: radii.md},
  googleButton: {
    borderColor: colors.border,
    borderWidth: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  googleIcon: {marginRight: 8},
  googleText: {color: colors.text, fontWeight: '700', fontSize: 15},
  buttonDisabled: {opacity: 0.5},
  errorText: {color: '#FCA5A5', fontSize: 12, fontWeight: '700', textAlign: 'center'},
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
