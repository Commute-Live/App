import React, { useState } from 'react';
import {
   Image,
   Pressable,
   ScrollView,
   StyleSheet,
   Text,
   TextInput,
   View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, spacing, radii } from '../../../theme';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../state/authProvider';

const TIMEZONES = [
   { label: 'Eastern (EST)', value: 'America/New_York' },
   { label: 'Central (CST)', value: 'America/Chicago' },
   { label: 'Mountain (MST)', value: 'America/Denver' },
   { label: 'Pacific (PST)', value: 'America/Los_Angeles' },
   { label: 'Alaska (AKST)', value: 'America/Anchorage' },
   { label: 'Hawaii (HST)', value: 'Pacific/Honolulu' },
];

export default function SignUpScreen() {
   const router = useRouter();
   const { signIn } = useAuth();
   const [username, setUsername] = useState('');
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [timezone, setTimezone] = useState('America/New_York');
   const [timezoneOpen, setTimezoneOpen] = useState(false);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [errorText, setErrorText] = useState('');
   const selectedTimezone =
      TIMEZONES.find((item) => item.value === timezone) ?? TIMEZONES[0];

   const onCreateAccount = async () => {
      const nextEmail = email.trim().toLowerCase();
      if (!nextEmail || !password) {
         setErrorText('Email and password are required');
         return;
      }

      setIsSubmitting(true);
      setErrorText('');

      try {
         const response = await apiFetch('/user/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               email: nextEmail,
               password,
               username: username.trim(),
               timezone,
            }),
         });
         console.log(response);

         const data = await response.json().catch(() => null);
         if (!response.ok) {
            setErrorText(
               data?.error === 'email already registered'
                  ? 'Email already registered'
                  : 'Sign up failed',
            );
            return;
         }

         const loginResult = await signIn(nextEmail, password);
         if (!loginResult.ok) {
            setErrorText('Account created. Please log in.');
            router.replace('/login');
            return;
         }

         router.replace('/dashboard');
      } catch (e) {
         console.error(e);
         setErrorText('Network error');
      } finally {
         setIsSubmitting(false);
      }
   };

   return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
         <ScrollView contentContainerStyle={styles.content}>
            <ScreenHeader title='Sign Up' />

            <Image
               source={require('../../../app-logo.png')}
               style={styles.logo}
               resizeMode='contain'
            />
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Set up your profile.</Text>

            <View style={styles.field}>
               <Text style={styles.label}>Username</Text>
               <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder='yourname'
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize='none'
                  style={styles.input}
               />
            </View>

            <View style={styles.field}>
               <Text style={styles.label}>Email</Text>
               <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder='you@example.com'
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize='none'
                  keyboardType='email-address'
                  style={styles.input}
               />
            </View>

            <View style={styles.field}>
               <Text style={styles.label}>Password</Text>
               <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder='••••••••'
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  style={styles.input}
               />
            </View>

            <View style={styles.field}>
               <Text style={styles.label}>Time zone</Text>
               <Pressable
                  style={styles.select}
                  onPress={() => setTimezoneOpen((prev) => !prev)}
               >
                  <Text style={styles.selectValue}>
                     {selectedTimezone.label}
                  </Text>
                  <Text style={styles.selectChevron}>
                     {timezoneOpen ? '▲' : '▼'}
                  </Text>
               </Pressable>
               {timezoneOpen ? (
                  <View style={styles.selectList}>
                     {TIMEZONES.map((item) => (
                        <Pressable
                           key={item.value}
                           style={({ pressed }) => [
                              styles.selectItem,
                              pressed && styles.pressed,
                           ]}
                           onPress={() => {
                              setTimezone(item.value);
                              setTimezoneOpen(false);
                           }}
                        >
                           <Text style={styles.selectItemText}>
                              {item.label}
                           </Text>
                        </Pressable>
                     ))}
                  </View>
               ) : null}
            </View>

            <Pressable
               style={styles.primaryButton}
               disabled={isSubmitting}
               onPress={() => {
                  void onCreateAccount();
               }}
            >
               <Text style={styles.primaryText}>
                  {isSubmitting ? 'Creating account...' : 'Create account'}
               </Text>
            </Pressable>

            {errorText ? (
               <Text style={styles.errorText}>{errorText}</Text>
            ) : null}
         </ScrollView>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: colors.background },
   content: { padding: spacing.lg, paddingBottom: spacing.xl },
   logo: {
      width: 190,
      height: 190,
      alignSelf: 'center',
      marginBottom: spacing.xs,
   },
   title: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'center',
   },
   subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: 'center',
      marginTop: spacing.xs,
      marginBottom: spacing.lg,
   },
   field: { marginBottom: spacing.md },
   label: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm },
   input: {
      borderRadius: radii.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      color: colors.text,
   },
   select: {
      borderRadius: radii.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
   },
   selectValue: { color: colors.text, fontWeight: '600' },
   selectChevron: { color: colors.textMuted, fontSize: 12 },
   selectList: {
      marginTop: spacing.sm,
      borderRadius: radii.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
   },
   selectItem: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
   },
   selectItemText: { color: colors.text },
   pressed: { opacity: 0.85 },
   primaryButton: {
      backgroundColor: colors.accent,
      paddingVertical: spacing.md,
      borderRadius: radii.md,
      alignItems: 'center',
      marginTop: spacing.sm,
   },
   primaryText: { color: colors.background, fontWeight: '800', fontSize: 15 },
   errorText: {
      color: '#FCA5A5',
      fontSize: 12,
      fontWeight: '700',
      marginTop: spacing.sm,
      textAlign: 'center',
   },
});
