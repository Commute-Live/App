import React, {useState} from 'react';
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
import {colors, spacing, radii} from '../../../theme';
import {useAuth} from '../../../state/authProvider';

export default function LoginScreen() {
  const router = useRouter();
  const {signIn, clearAuth} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState('');

  const onLogin = async () => {
    if (!email.trim() || !password) {
      setErrorText('Email and password are required');
      return;
    }

    setIsSubmitting(true);
    setErrorText('');

    const result = await signIn(email, password);
    setIsSubmitting(false);

    if (!result.ok) {
      setErrorText(result.error);
      return;
    }

    router.replace('/dashboard');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Image source={require('../../../app-logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Log in</Text>
          <Text style={styles.subtitle}>Access your account to manage your display.</Text>

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
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={styles.input}
              returnKeyType="done"
            />
          </View>

          <Pressable
            style={styles.primaryButton}
            disabled={isSubmitting}
            onPress={() => {
              void onLogin();
            }}>
            <Text style={styles.primaryText}>{isSubmitting ? 'Logging in...' : 'Log in'}</Text>
          </Pressable>

          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

          <Pressable style={styles.resetLink}>
            <Text style={styles.resetText}>Forgot password?</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              clearAuth();
              router.push('/auth');
            }}>
            <Text style={styles.secondaryText}>Back</Text>
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
  resetLink: {alignItems: 'center', marginTop: spacing.sm},
  resetText: {color: colors.textMuted, fontWeight: '700', fontSize: 12},
  errorText: {color: '#FCA5A5', fontSize: 12, fontWeight: '700', marginTop: spacing.sm, textAlign: 'center'},
});
