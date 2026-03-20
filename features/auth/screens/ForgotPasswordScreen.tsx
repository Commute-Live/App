import React, {useEffect, useState} from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';

import {apiFetch} from '../../../lib/api';
import {colors, radii, spacing} from '../../../theme';

const GENERIC_SUCCESS =
  'If an account with that email exists, we sent a password reset link.';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setTimeout(() => setCooldownSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldownSeconds]);

  const onSubmit = async () => {
    const nextEmail = email.trim().toLowerCase();
    if (!nextEmail) {
      setErrorText('Email is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorText('');

    try {
      const response = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: nextEmail}),
      });
      const data = await response.json().catch(() => null);

      if (response.status === 429) {
        setErrorText('Too many reset requests. Please wait a few minutes and try again.');
        return;
      }

      if (!response.ok) {
        setErrorText('Unable to send reset instructions right now.');
        return;
      }

      setSuccessText(typeof data?.message === 'string' ? data.message : GENERIC_SUCCESS);
      setCooldownSeconds(60);
    } catch {
      setErrorText('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Image source={require('../../../app-logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Forgot password</Text>
          <Text style={styles.subtitle}>
            Enter your account email and we&apos;ll send a secure reset link.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              returnKeyType="done"
            />
          </View>

          <Pressable
            style={styles.primaryButton}
            disabled={isSubmitting || cooldownSeconds > 0}
            onPress={() => {
              void onSubmit();
            }}>
            <Text style={styles.primaryText}>
              {isSubmitting
                ? 'Sending...'
                : cooldownSeconds > 0
                  ? `Resend in ${cooldownSeconds}s`
                  : 'Send reset link'}
            </Text>
          </Pressable>

          {successText ? <Text style={styles.successText}>{successText}</Text> : null}
          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

          <Pressable style={styles.secondaryButton} onPress={() => router.replace('/login')}>
            <Text style={styles.secondaryText}>Back to login</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  keyboardAvoid: {flex: 1},
  content: {padding: spacing.lg, paddingBottom: spacing.xl * 1.5},
  logo: {width: 160, height: 160, alignSelf: 'center', marginBottom: spacing.xs},
  title: {color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center'},
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  field: {marginBottom: spacing.md},
  label: {color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm},
  input: {
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryText: {color: colors.background, fontWeight: '800', fontSize: 15},
  secondaryButton: {
    borderColor: colors.border,
    borderWidth: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryText: {color: colors.textMuted, fontWeight: '700', fontSize: 13},
  successText: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  errorText: {color: '#FCA5A5', fontSize: 12, fontWeight: '700', marginTop: spacing.sm, textAlign: 'center'},
});
