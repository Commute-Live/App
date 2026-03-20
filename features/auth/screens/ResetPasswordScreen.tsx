import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
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
import {useLocalSearchParams, useRouter} from 'expo-router';

import {apiFetch} from '../../../lib/api';
import {colors, radii, spacing} from '../../../theme';
import {validateStrongPassword} from '../passwordValidation';

type TokenStatus = 'loading' | 'valid' | 'invalid';

const extractToken = (value: string | string[] | undefined) => {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value[0]?.trim() ?? '';
  return '';
};

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{token?: string | string[]}>();
  const token = useMemo(() => extractToken(params.token), [params.token]);

  const [tokenStatus, setTokenStatus] = useState<TokenStatus>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorText, setErrorText] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const validateToken = async () => {
      if (!token) {
        setTokenStatus('invalid');
        return;
      }

      try {
        const response = await apiFetch(`/auth/reset-password/validate?token=${encodeURIComponent(token)}`);
        if (!isMounted) return;
        if (response.status === 429) {
          setErrorText('Too many attempts. Please wait a few minutes and request a new link if needed.');
          setTokenStatus('invalid');
          return;
        }
        setTokenStatus(response.ok ? 'valid' : 'invalid');
      } catch {
        if (!isMounted) return;
        setTokenStatus('invalid');
      }
    };

    void validateToken();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const onSubmit = async () => {
    if (!token) {
      setErrorText('This reset link is invalid.');
      return;
    }
    if (!password || !confirmPassword) {
      setErrorText('Enter and confirm your new password.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorText('Passwords do not match.');
      return;
    }

    const passwordErrors = validateStrongPassword(password);
    if (passwordErrors.length) {
      setErrorText(passwordErrors[0] ?? 'Choose a stronger password.');
      return;
    }

    setIsSubmitting(true);
    setErrorText('');

    try {
      const response = await apiFetch('/auth/reset-password', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({token, password, confirmPassword}),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (data?.error === 'INVALID_OR_EXPIRED' || data?.error === 'INVALID_TOKEN') {
          setTokenStatus('invalid');
          setErrorText('This reset link is invalid or has expired. Request a new one.');
          return;
        }
        if (data?.error === 'WEAK_PASSWORD' && Array.isArray(data?.details)) {
          setErrorText(String(data.details[0] ?? 'Choose a stronger password.'));
          return;
        }
        if (data?.error === 'RATE_LIMITED') {
          setErrorText('Too many attempts. Please wait a few minutes and try again.');
          return;
        }
        setErrorText('Unable to reset your password right now.');
        return;
      }

      setSuccess(true);
    } catch {
      setErrorText('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (tokenStatus === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.subtitle}>Validating your reset link...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (tokenStatus === 'invalid') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredCard}>
          <Text style={styles.title}>Reset link unavailable</Text>
          <Text style={styles.subtitle}>
            This reset link is invalid, expired, or has already been used.
          </Text>
          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
          <Pressable style={styles.primaryButton} onPress={() => router.replace('/forgot-password')}>
            <Text style={styles.primaryText}>Request a new link</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.replace('/login')}>
            <Text style={styles.secondaryText}>Back to login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredCard}>
          <Text style={styles.title}>Password updated</Text>
          <Text style={styles.subtitle}>
            Your password has been reset. Existing sessions were signed out for security.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.replace('/login')}>
            <Text style={styles.primaryText}>Go to login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>Choose a new password for your Commutelive account.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>New password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter a strong password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={styles.input}
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter your password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={styles.input}
              returnKeyType="done"
            />
          </View>

          <Text style={styles.hint}>
            Use at least 12 characters with uppercase, lowercase, number, and symbol.
          </Text>

          <Pressable
            style={styles.primaryButton}
            disabled={isSubmitting}
            onPress={() => {
              void onSubmit();
            }}>
            <Text style={styles.primaryText}>{isSubmitting ? 'Resetting...' : 'Reset password'}</Text>
          </Pressable>

          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  keyboardAvoid: {flex: 1},
  content: {padding: spacing.lg, paddingBottom: spacing.xl * 1.5},
  centered: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm},
  centeredCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
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
  hint: {color: colors.textMuted, fontSize: 12, marginBottom: spacing.md},
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryText: {color: colors.background, fontWeight: '800', fontSize: 15},
  secondaryButton: {
    borderColor: colors.border,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryText: {color: colors.textMuted, fontWeight: '700', fontSize: 13},
  errorText: {color: '#FCA5A5', fontSize: 12, fontWeight: '700', marginTop: spacing.sm, textAlign: 'center'},
});
