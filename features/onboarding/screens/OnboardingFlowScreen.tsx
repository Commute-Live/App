import React, {
   useCallback,
   useEffect,
   useMemo,
   useRef,
   useState,
} from 'react';
import {
   ActivityIndicator,
   Platform,
   Pressable,
   ScrollView,
   StyleSheet,
   Text,
   View,
   type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import BottomSheetForm, {
   BottomSheetTextInputField,
} from '../components/BottomSheetForm';
import GlassPanel from '../components/GlassPanel';
import IslandSuccess from '../components/IslandSuccess';
import ProgressStepper from '../components/ProgressStepper';
import SkiaGradientBackground from '../components/SkiaGradientBackground';
import StaggeredEntrance from '../components/StaggeredEntrance';
import { ONBOARDING_MAX_WIDTH, onboardingPalette } from '../constants';
import { apiFetch } from '../../../lib/api';
import {
   getDeviceLinkFailureMessage,
   isBenignDeviceLinkConflict,
   readApiError,
} from '../../../lib/deviceLinking';
import {
   getHapticsModule,
   getLocalAuthenticationModule,
   useBleProvisionCompat,
} from '../../../lib/nativeCompat';
import { useAuth } from '../../../state/authProvider';
import { useAppState } from '../../../state/appState';

type OnboardingMode = 'signin' | 'signup';
type OnboardingStep =
   | 'welcome'
   | 'authSheet'
   | 'biometric'
   | 'deviceMethod'
   | 'bleScan'
   | 'wifiSheet'
   | 'linking'
   | 'complete';

const TIMEZONES = [
   { label: 'Eastern', value: 'America/New_York' },
   { label: 'Central', value: 'America/Chicago' },
   { label: 'Mountain', value: 'America/Denver' },
   { label: 'Pacific', value: 'America/Los_Angeles' },
];

const WIFI_VERIFICATION_ATTEMPTS = 7;
const WIFI_VERIFICATION_DELAY_MS = 1500;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const triggerImpact = (kind: 'light' | 'medium' | 'soft' = 'light') => {
   if (Platform.OS === 'web') return;
   const Haptics = getHapticsModule();
   if (!Haptics) return;

   const map = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      soft:
         Haptics.ImpactFeedbackStyle.Soft ?? Haptics.ImpactFeedbackStyle.Light,
   };

   void Haptics.impactAsync(map[kind]).catch(() => {});
};

const triggerNotification = (kind: 'success' | 'warning' | 'error') => {
   if (Platform.OS === 'web') return;
   const Haptics = getHapticsModule();
   if (!Haptics) return;

   const map = {
      success: Haptics.NotificationFeedbackType.Success,
      warning: Haptics.NotificationFeedbackType.Warning,
      error: Haptics.NotificationFeedbackType.Error,
   };

   void Haptics.notificationAsync(map[kind]).catch(() => {});
};

export default function OnboardingFlowScreen({
   initialMode = 'signin',
   autoOpenAuth = false,
}: {
   initialMode?: OnboardingMode;
   autoOpenAuth?: boolean;
}) {
   const router = useRouter();
   const params = useLocalSearchParams<{ resume?: string }>();
   const {
      status,
      isAuthenticated,
      deviceIds,
      deviceId: authDeviceId,
      signIn,
      hydrate,
   } = useAuth();
   const { setDeviceId, setDeviceStatus } = useAppState();
   const bleProvision = useBleProvisionCompat();

   const [step, setStep] = useState<OnboardingStep>('welcome');
   const [authMode, setAuthMode] = useState<OnboardingMode>(initialMode);
   const [authSheetVisible, setAuthSheetVisible] = useState(false);
   const [wifiSheetVisible, setWifiSheetVisible] = useState(false);
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [username, setUsername] = useState('');
   const [timezone, setTimezone] = useState(
      TIMEZONES[0]?.value ?? 'America/New_York',
   );
   const [ssid, setSsid] = useState('');
   const [wifiUsername, setWifiUsername] = useState('');
   const [wifiPassword, setWifiPassword] = useState('');
   const [authError, setAuthError] = useState('');
   const [wifiError, setWifiError] = useState('');
   const [deviceError, setDeviceError] = useState('');
   const [authSubmitting, setAuthSubmitting] = useState(false);
   const [wifiSubmitting, setWifiSubmitting] = useState(false);
   const [islandVisible, setIslandVisible] = useState(false);
   const [islandTitle, setIslandTitle] = useState('Signed in');
   const [islandSubtitle, setIslandSubtitle] = useState('Session approved');

   const autoOpenDoneRef = useRef(false);
   const autoConnectDoneRef = useRef(false);
   const wifiSheetOpenedRef = useRef(false);

   const hasLinkedDevice = deviceIds.length > 0 || !!authDeviceId;
   const stageKey = `${step}-${bleProvision.state.phase}-${authMode}`;

   useEffect(() => {
      if (status === 'loading') return;

      if (isAuthenticated && hasLinkedDevice) {
         router.replace('/dashboard');
         return;
      }

      if (isAuthenticated || params.resume === 'device') {
         setStep('deviceMethod');
         setAuthSheetVisible(false);
         return;
      }

      setStep('welcome');
   }, [hasLinkedDevice, isAuthenticated, params.resume, router, status]);

   useEffect(() => {
      if (
         !autoOpenAuth ||
         autoOpenDoneRef.current ||
         isAuthenticated ||
         params.resume === 'device'
      )
         return;

      autoOpenDoneRef.current = true;
      const timer = setTimeout(() => {
         setAuthMode(initialMode);
         setStep('authSheet');
         setAuthSheetVisible(true);
      }, 180);

      return () => clearTimeout(timer);
   }, [autoOpenAuth, initialMode, isAuthenticated, params.resume]);

   useEffect(() => {
      if (step !== 'bleScan') return;

      if (
         bleProvision.state.phase === 'device_found' &&
         !autoConnectDoneRef.current
      ) {
         autoConnectDoneRef.current = true;
         triggerImpact('medium');
         void bleProvision.connectToDevice();
         return;
      }

      if (
         bleProvision.state.phase === 'connected' &&
         !wifiSheetOpenedRef.current
      ) {
         wifiSheetOpenedRef.current = true;
         setWifiError('');
         setStep('wifiSheet');
         setWifiSheetVisible(true);
         triggerImpact();
         return;
      }

      if (bleProvision.state.phase === 'error') {
         setDeviceError(
            bleProvision.state.errorMsg ??
               'We could not find your display nearby.',
         );
         setStep('deviceMethod');
         triggerNotification('error');
      }
   }, [
      bleProvision,
      bleProvision.state.errorMsg,
      bleProvision.state.phase,
      step,
   ]);

   const progress = useMemo(() => {
      if (step === 'welcome' || step === 'authSheet' || step === 'biometric') {
         return { current: 1, label: 'Account' };
      }
      if (step === 'wifiSheet') {
         return { current: 2, label: 'Wi-Fi' };
      }
      if (step === 'deviceMethod' || step === 'bleScan') {
         return { current: 2, label: 'Bluetooth' };
      }
      return { current: 3, label: 'Done' };
   }, [step]);

   const openAuthSheet = useCallback((mode: OnboardingMode) => {
      setAuthMode(mode);
      setAuthError('');
      setStep('authSheet');
      setAuthSheetVisible(true);
      triggerImpact();
   }, []);

   const runBiometricMoment = useCallback(async () => {
      setStep('biometric');

      let title = 'Signed in';
      let subtitle = 'Account approved';

      const LocalAuthentication = getLocalAuthenticationModule();

      if (Platform.OS !== 'web' && LocalAuthentication) {
         try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();

            if (hasHardware && isEnrolled) {
               const result = await LocalAuthentication.authenticateAsync({
                  promptMessage: 'Confirm sign in',
                  disableDeviceFallback: false,
                  cancelLabel: 'Not now',
               });
               if (result.success) {
                  title =
                     Platform.OS === 'ios'
                        ? 'Face ID confirmed'
                        : 'Biometrics confirmed';
                  subtitle = 'Session approved';
               } else {
                  subtitle = 'Continuing';
               }
            }
         } catch {
            subtitle = 'Continuing';
         }
      }

      setIslandTitle(title);
      setIslandSubtitle(subtitle);
      setIslandVisible(true);
      triggerNotification('success');
      await wait(1200);
      setIslandVisible(false);
      setStep('deviceMethod');
   }, []);

   const ensureDeviceRegistered = useCallback(async (nextDeviceId: string) => {
      const registerResponse = await apiFetch('/device/register', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ id: nextDeviceId }),
      });

      if (!registerResponse.ok && registerResponse.status !== 409) {
         const data = await registerResponse.json().catch(() => null);
         throw new Error(
            typeof data?.error === 'string'
               ? `Device registration failed: ${data.error}`
               : `Device registration failed (${registerResponse.status})`,
         );
      }
   }, []);

   const verifyProvisionedWifi = useCallback(
      async (nextDeviceId: string) => {
         let lastError = '';

         for (
            let attempt = 0;
            attempt < WIFI_VERIFICATION_ATTEMPTS;
            attempt += 1
      ) {
         try {
               await apiFetch(`/refresh/device/${encodeURIComponent(nextDeviceId)}`, {
                  method: 'POST',
               }).catch(() => null);

               const response = await apiFetch(
                  `/refresh/device/${encodeURIComponent(nextDeviceId)}`,
                  {
                     method: 'GET',
                  },
               );

               if (response.status === 403) {
                  lastError =
                     'Refresh endpoint is denying access before the device is linked.';
               } else if (!response.ok) {
                  const data = await response.json().catch(() => null);
                  lastError =
                     typeof data?.error === 'string'
                        ? data.error
                        : `Verification failed (${response.status})`;
               } else {
                  const data = await response.json().catch(() => null);
                  if (data?.online === true) {
                     return { ok: true as const };
                  }

                  lastError =
                     typeof data?.status === 'string'
                        ? `Device is still ${data.status}.`
                        : 'The display is still offline.';
               }
            } catch {
               lastError = 'Verification timeout';
            }

            await wait(WIFI_VERIFICATION_DELAY_MS);
         }

         return {
            ok: false as const,
            error: lastError || 'The display did not come online.',
         };
      },
      [],
   );

   const prepareDeviceLink = useCallback(
      async (nextDeviceId: string) => {
         setDeviceError('');
         setDeviceId(nextDeviceId);

         await ensureDeviceRegistered(nextDeviceId);

         const linkResponse = await apiFetch('/user/device/link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: nextDeviceId }),
         });

         const data = await linkResponse.json().catch(() => null);
         const linkError = readApiError(data);
         if (!linkResponse.ok && !isBenignDeviceLinkConflict(linkResponse.status, linkError)) {
            throw new Error(
               getDeviceLinkFailureMessage(
                  linkResponse.status,
                  linkError,
                  'Device link failed',
               ),
            );
         }

         setDeviceStatus('pairedOffline');
      },
      [ensureDeviceRegistered, setDeviceId, setDeviceStatus],
   );

   const completeLinkedDeviceSetup = useCallback(async () => {
      setDeviceStatus('pairedOnline');
      await hydrate();
      setStep('complete');
      triggerNotification('success');
      await wait(420);
      router.replace('/presets');
   }, [hydrate, router, setDeviceStatus]);

   const submitAuth = useCallback(async () => {
      const nextEmail = email.trim().toLowerCase();
      const nextPassword = password;

      if (!nextEmail || !nextPassword) {
         setAuthError('Email and password are required.');
         triggerNotification('error');
         return;
      }

      setAuthSubmitting(true);
      setAuthError('');

      try {
         if (authMode === 'signup') {
            const response = await apiFetch('/user/register', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                  email: nextEmail,
                  password: nextPassword,
                  username: username.trim(),
                  timezone,
               }),
            });
            const data = await response.json().catch(() => null);

            if (!response.ok) {
               if (data?.error === 'email already registered') {
                  setAuthError('That email is already registered.');
               } else {
                  console.log(data);
                  setAuthError('Account creation failed.');
               }
               triggerNotification('error');
               return;
            }
         }

         const result = await signIn(nextEmail, nextPassword);
         if (!result.ok) {
            setAuthError(result.error);
            triggerNotification('error');
            return;
         }

         setAuthSheetVisible(false);
         await runBiometricMoment();
      } finally {
         setAuthSubmitting(false);
      }
   }, [
      authMode,
      email,
      password,
      runBiometricMoment,
      signIn,
      timezone,
      username,
   ]);

   const beginBleSetup = useCallback(async () => {
      if (Platform.OS === 'web' || !bleProvision.isAvailable) {
         setDeviceError(
            bleProvision.isAvailable
               ? 'Bluetooth setup requires the iOS or Android app.'
               : 'Bluetooth setup is unavailable in this build.',
         );
         triggerNotification('warning');
         return;
      }

      autoConnectDoneRef.current = false;
      wifiSheetOpenedRef.current = false;
      bleProvision.reset();
      setDeviceError('');
      setWifiError('');
      setStep('bleScan');
      triggerImpact('medium');
      await bleProvision.startScan();
   }, [bleProvision]);

   const submitWifi = useCallback(async () => {
      const nextSsid = ssid.trim();
      const nextWifiUsername = wifiUsername.trim();

      if (!nextSsid || !wifiPassword.trim()) {
         setWifiError('Enter your Wi-Fi name and password.');
         triggerNotification('error');
         return;
      }

      setWifiSubmitting(true);
      setWifiError('');
      setDeviceError('');

      try {
         const nextDeviceId = await bleProvision.sendCredentials(
            nextSsid,
            wifiPassword,
            nextWifiUsername,
         );

         if (!nextDeviceId) {
            setWifiError('Could not read the display ID. Try again.');
            triggerNotification('error');
            return;
         }

         setStep('linking');
         await prepareDeviceLink(nextDeviceId);

         const verification = await verifyProvisionedWifi(nextDeviceId);
         if (!verification.ok) {
            setStep('wifiSheet');
            setDeviceStatus('pairedOffline');
            setWifiError(verification.error);
            triggerNotification('error');
            return;
         }

         setWifiSheetVisible(false);
         await completeLinkedDeviceSetup();
      } catch (error) {
         setStep('wifiSheet');
         setDeviceStatus('notPaired');
         setWifiError(
            error instanceof Error ? error.message : 'Unable to finish setup.',
         );
         triggerNotification('error');
      } finally {
         setWifiSubmitting(false);
      }
   }, [
      bleProvision,
      completeLinkedDeviceSetup,
      prepareDeviceLink,
      ssid,
      setDeviceStatus,
      verifyProvisionedWifi,
      wifiPassword,
      wifiUsername,
   ]);

   const panelTitle =
      step === 'wifiSheet'
         ? 'Wi-Fi setup'
         : step === 'linking' || step === 'complete'
           ? 'Finishing setup'
           : 'Bluetooth setup';

   const panelBody =
      step === 'wifiSheet'
         ? 'Enter the network for the display.'
         : step === 'linking' || step === 'complete'
           ? 'Saving the display to your account.'
           : 'Connect the display with Bluetooth.';

   const heroTitle =
      step === 'linking' || step === 'complete'
         ? 'Finishing setup.'
         : step === 'wifiSheet'
           ? 'Add Wi-Fi.'
           : isAuthenticated
             ? 'Connect your display.'
             : 'Sign in to start.';

   const heroSubtitle =
      step === 'linking' || step === 'complete'
         ? 'Linking your display.'
         : step === 'wifiSheet'
           ? 'Finish setup for the display.'
           : isAuthenticated
             ? 'Bluetooth first. Then Wi-Fi.'
             : 'Account first. Display next.';

   return (
      <SafeAreaView
         style={styles.safeArea}
         edges={['top', 'left', 'right', 'bottom']}
      >
         <StatusBar style='light' />
         <View style={styles.container}>
            <SkiaGradientBackground />
            <IslandSuccess
               visible={islandVisible}
               title={islandTitle}
               subtitle={islandSubtitle}
            />

            <View style={styles.contentWrap}>
               <ScrollView
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps='handled'
               >
                  <View style={styles.contentInner}>
                     <View style={styles.topSection}>
                        <StaggeredEntrance animateKey={stageKey} index={0}>
                           <View style={styles.topRow}>
                              <View style={styles.brandBlock}>
                                 <Text style={styles.brand} selectable>
                                    CommuteLive
                                 </Text>
                                 <Text style={styles.meta} selectable>
                                    Setup
                                 </Text>
                              </View>
                              <ProgressStepper
                                 current={progress.current}
                                 total={3}
                                 label={progress.label}
                              />
                           </View>
                        </StaggeredEntrance>

                        <StaggeredEntrance animateKey={stageKey} index={1}>
                           <View style={styles.hero}>
                              <Text style={styles.heroTitle} selectable>
                                 {heroTitle}
                              </Text>
                              <Text style={styles.heroSubtitle} selectable>
                                 {heroSubtitle}
                              </Text>
                           </View>
                        </StaggeredEntrance>

                        {isAuthenticated ? (
                           <StaggeredEntrance animateKey={stageKey} index={2}>
                              <GlassPanel style={styles.devicePanel}>
                                 <Text style={styles.panelTitle} selectable>
                                    {panelTitle}
                                 </Text>
                                 <Text style={styles.panelBody} selectable>
                                    {panelBody}
                                 </Text>
                                 {deviceError ? (
                                    <View style={styles.messageRow}>
                                       <Ionicons
                                          name='alert-circle-outline'
                                          size={16}
                                          color={onboardingPalette.error}
                                       />
                                       <Text
                                          style={styles.errorText}
                                          selectable
                                       >
                                          {deviceError}
                                       </Text>
                                    </View>
                                 ) : null}
                              </GlassPanel>
                           </StaggeredEntrance>
                        ) : null}
                     </View>

                     {!isAuthenticated ? (
                        <StaggeredEntrance
                           animateKey={stageKey}
                           index={3}
                           style={styles.bottomSection}
                        >
                           <View style={styles.ctaGroup}>
                              <PrimaryButton
                                 label='Sign in'
                                 onPress={() => openAuthSheet('signin')}
                              />
                              <SecondaryButton
                                 label='Create account'
                                 onPress={() => openAuthSheet('signup')}
                              />
                           </View>
                        </StaggeredEntrance>
                     ) : null}

                     {isAuthenticated ? (
                        <StaggeredEntrance
                           animateKey={stageKey}
                           index={3}
                           style={styles.bottomSection}
                        >
                           <View style={styles.deviceActions}>
                              {step === 'bleScan' ? (
                                 <GlassPanel style={styles.statusCard}>
                                    <StatusRow
                                       icon='bluetooth-outline'
                                       label={
                                          bleProvision.state.phase ===
                                          'scanning'
                                             ? 'Scanning'
                                             : bleProvision.state.phase ===
                                                 'device_found'
                                               ? `Found ${bleProvision.state.deviceId ?? 'display'}`
                                               : bleProvision.state.phase ===
                                                   'connecting'
                                                 ? 'Connecting'
                                                 : bleProvision.state.phase ===
                                                     'connected'
                                                   ? 'Connected'
                                                   : 'Starting Bluetooth'
                                       }
                                       tone='default'
                                    />
                                    <Text style={styles.statusText} selectable>
                                       {bleProvision.state.phase === 'scanning'
                                          ? 'Looking for your display.'
                                          : bleProvision.state.phase ===
                                              'device_found'
                                            ? 'Display found.'
                                            : bleProvision.state.phase ===
                                                'connecting'
                                              ? 'Hold the phone near the display.'
                                              : bleProvision.state.phase ===
                                                  'connected'
                                                ? 'Opening Wi-Fi setup.'
                                                : 'Preparing Bluetooth.'}
                                    </Text>
                                    {(bleProvision.state.phase === 'scanning' ||
                                       bleProvision.state.phase ===
                                          'connecting') && (
                                       <ActivityIndicator
                                          size='small'
                                          color={onboardingPalette.text}
                                          style={styles.inlineLoader}
                                       />
                                    )}
                                    <View style={styles.inlineButtons}>
                                       <SecondaryButton
                                          label='Scan again'
                                          onPress={() => void beginBleSetup()}
                                          compact
                                       />
                                    </View>
                                 </GlassPanel>
                              ) : step === 'linking' || step === 'complete' ? (
                                 <GlassPanel style={styles.statusCard}>
                                    <StatusRow
                                       icon={
                                          step === 'complete'
                                             ? 'checkmark-circle-outline'
                                             : 'sync-outline'
                                       }
                                       label={
                                          step === 'complete'
                                             ? 'Display linked'
                                             : 'Linking display'
                                       }
                                       tone={
                                          step === 'complete'
                                             ? 'success'
                                             : 'default'
                                       }
                                    />
                                    <Text style={styles.statusText} selectable>
                                       {step === 'complete'
                                          ? 'Opening presets.'
                                          : 'Saving your display.'}
                                    </Text>
                                    {step === 'linking' ? (
                                       <ActivityIndicator
                                          size='small'
                                          color={onboardingPalette.text}
                                          style={styles.inlineLoader}
                                       />
                                    ) : null}
                                 </GlassPanel>
                              ) : (
                                 <PrimaryButton
                                    label='Connect with Bluetooth'
                                    onPress={() => void beginBleSetup()}
                                 />
                              )}
                           </View>
                        </StaggeredEntrance>
                     ) : null}
                  </View>
               </ScrollView>
            </View>

            <BottomSheetForm
               visible={authSheetVisible}
               title={authMode === 'signin' ? 'Sign in' : 'Create account'}
               subtitle=''
               onDismiss={() => {
                  setAuthSheetVisible(false);
                  if (!isAuthenticated) setStep('welcome');
               }}
               footer={
                  <>
                     <PrimaryButton
                        label={
                           authSubmitting
                              ? authMode === 'signin'
                                 ? 'Signing in...'
                                 : 'Creating...'
                              : authMode === 'signin'
                                ? 'Sign in'
                                : 'Create account'
                        }
                        onPress={() => void submitAuth()}
                        disabled={authSubmitting}
                     />
                     <View style={styles.sheetFooterRow}>
                        <Text style={styles.switchLabel} selectable>
                           {authMode === 'signin'
                              ? 'No account?'
                              : 'Have an account?'}
                        </Text>
                        <Pressable
                           onPress={() => {
                              setAuthMode(
                                 authMode === 'signin' ? 'signup' : 'signin',
                              );
                              setAuthError('');
                              triggerImpact();
                           }}
                        >
                           <Text style={styles.switchAction} selectable>
                              {authMode === 'signin' ? 'Sign up' : 'Sign in'}
                           </Text>
                        </Pressable>
                     </View>
                  </>
               }
            >
               {authMode === 'signup' ? (
                  <SheetField
                     label='Username'
                     value={username}
                     onChangeText={setUsername}
                     autoCapitalize='words'
                     placeholder='Your name'
                  />
               ) : null}
               <SheetField
                  label='Email'
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize='none'
                  keyboardType='email-address'
                  placeholder='you@example.com'
               />
               <SheetField
                  label='Password'
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder={
                     authMode === 'signin' ? 'Password' : 'Create a password'
                  }
               />
               {authMode === 'signup' ? (
                  <View style={styles.fieldBlock}>
                     <Text style={styles.fieldLabel} selectable>
                        Time zone
                     </Text>
                     <View style={styles.chipWrap}>
                        {TIMEZONES.map((item) => (
                           <Pressable
                              key={item.value}
                              style={[
                                 styles.timezoneChip,
                                 timezone === item.value &&
                                    styles.timezoneChipActive,
                              ]}
                              onPress={() => {
                                 setTimezone(item.value);
                                 triggerImpact();
                              }}
                           >
                              <Text
                                 style={[
                                    styles.timezoneChipText,
                                    timezone === item.value &&
                                       styles.timezoneChipTextActive,
                                 ]}
                                 selectable
                              >
                                 {item.label}
                              </Text>
                           </Pressable>
                        ))}
                     </View>
                  </View>
               ) : null}
               {authError ? (
                  <Text style={styles.errorText} selectable>
                     {authError}
                  </Text>
               ) : null}
            </BottomSheetForm>

            <BottomSheetForm
               visible={wifiSheetVisible}
               title='Wi-Fi'
               subtitle=''
               onDismiss={() => {
                  setWifiSheetVisible(false);
                  wifiSheetOpenedRef.current = false;
                  bleProvision.reset();
                  setStep('deviceMethod');
               }}
               footer={
                  <PrimaryButton
                     label={wifiSubmitting ? 'Connecting...' : 'Connect'}
                     onPress={() => void submitWifi()}
                     disabled={wifiSubmitting}
                  />
               }
            >
               <SheetField
                  label='Wi-Fi name'
                  value={ssid}
                  onChangeText={setSsid}
                  autoCapitalize='none'
                  placeholder='Home SSID'
               />
               <SheetField
                  label='Username'
                  value={wifiUsername}
                  onChangeText={setWifiUsername}
                  autoCapitalize='none'
                  placeholder='Optional'
               />
               <SheetField
                  label='Password'
                  value={wifiPassword}
                  onChangeText={setWifiPassword}
                  secureTextEntry
                  placeholder='Network password'
               />
               {wifiError ? (
                  <Text style={styles.errorText} selectable>
                     {wifiError}
                  </Text>
               ) : null}
            </BottomSheetForm>
         </View>
      </SafeAreaView>
   );
}

function StatusRow({
   icon,
   label,
   tone,
}: {
   icon: keyof typeof Ionicons.glyphMap;
   label: string;
   tone: 'default' | 'success';
}) {
   return (
      <View style={styles.statusRow}>
         <View
            style={[
               styles.statusIcon,
               tone === 'success' && styles.statusIconSuccess,
            ]}
         >
            <Ionicons
               name={icon}
               size={15}
               color={
                  tone === 'success'
                     ? onboardingPalette.success
                     : onboardingPalette.text
               }
            />
         </View>
         <Text style={styles.statusLabel} selectable>
            {label}
         </Text>
      </View>
   );
}

function SheetField(props: TextInputProps & { label: string }) {
   const { label, ...rest } = props;
   return (
      <View style={styles.fieldBlock}>
         <Text style={styles.fieldLabel} selectable>
            {label}
         </Text>
         <BottomSheetTextInputField
            {...rest}
            placeholderTextColor='rgba(154, 160, 166, 0.72)'
            selectionColor={onboardingPalette.accent}
            style={styles.input}
         />
      </View>
   );
}

function PrimaryButton({
   label,
   onPress,
   disabled,
   compact = false,
}: {
   label: string;
   onPress: () => void;
   disabled?: boolean;
   compact?: boolean;
}) {
   return (
      <Pressable
         disabled={disabled}
         onPress={() => {
            triggerImpact();
            onPress();
         }}
         style={({ pressed }) => [
            styles.primaryButton,
            compact && styles.compactButton,
            pressed && !disabled && styles.primaryPressed,
            disabled && styles.buttonDisabled,
         ]}
      >
         <Text
            style={[
               styles.primaryButtonText,
               disabled && styles.disabledButtonText,
            ]}
            selectable
         >
            {label}
         </Text>
      </Pressable>
   );
}

function SecondaryButton({
   label,
   onPress,
   disabled,
   compact = false,
}: {
   label: string;
   onPress: () => void;
   disabled?: boolean;
   compact?: boolean;
}) {
   return (
      <Pressable
         disabled={disabled}
         onPress={() => {
            triggerImpact('soft');
            onPress();
         }}
         style={({ pressed }) => [
            styles.secondaryButton,
            compact && styles.compactButton,
            pressed && !disabled && styles.secondaryPressed,
            disabled && styles.buttonDisabled,
         ]}
      >
         <Text style={styles.secondaryButtonText} selectable>
            {label}
         </Text>
      </Pressable>
   );
}

const styles = StyleSheet.create({
   safeArea: {
      flex: 1,
      backgroundColor: onboardingPalette.base,
   },
   container: {
      flex: 1,
      backgroundColor: onboardingPalette.base,
   },
   contentWrap: {
      flex: 1,
   },
   scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 28,
   },
   contentInner: {
      flex: 1,
      width: '100%',
      maxWidth: ONBOARDING_MAX_WIDTH,
      minHeight: 560,
      alignSelf: 'center',
      justifyContent: 'space-between',
      gap: 24,
   },
   topSection: {
      gap: 18,
   },
   bottomSection: {
      marginTop: 'auto',
   },
   topRow: {
      alignItems: 'center',
      gap: 12,
   },
   brandBlock: {
      alignItems: 'center',
   },
   brand: {
      color: onboardingPalette.text,
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.5,
      textAlign: 'center',
   },
   meta: {
      marginTop: 4,
      color: onboardingPalette.textMuted,
      fontSize: 12,
      fontWeight: '500',
      textAlign: 'center',
   },
   hero: {
      alignItems: 'center',
      paddingTop: 8,
   },
   heroTitle: {
      color: onboardingPalette.text,
      fontSize: 38,
      lineHeight: 40,
      fontWeight: '700',
      letterSpacing: -1.2,
      maxWidth: 320,
      textAlign: 'center',
   },
   heroSubtitle: {
      marginTop: 10,
      color: onboardingPalette.textMuted,
      fontSize: 15,
      lineHeight: 22,
      maxWidth: 320,
      textAlign: 'center',
   },
   devicePanel: {
      minHeight: 118,
      alignSelf: 'stretch',
   },
   panelTitle: {
      color: onboardingPalette.text,
      fontSize: 21,
      lineHeight: 25,
      fontWeight: '700',
      letterSpacing: -0.4,
      textAlign: 'center',
   },
   panelBody: {
      marginTop: 8,
      color: onboardingPalette.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
   },
   ctaGroup: {
      alignSelf: 'stretch',
      gap: 10,
   },
   primaryButton: {
      minHeight: 56,
      borderRadius: 10,
      backgroundColor: onboardingPalette.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
   },
   compactButton: {
      minHeight: 44,
      paddingHorizontal: 16,
   },
   primaryPressed: {
      opacity: 0.92,
   },
   secondaryPressed: {
      opacity: 0.86,
   },
   secondaryButton: {
      minHeight: 56,
      borderRadius: 10,
      backgroundColor: onboardingPalette.surfaceStrong,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      borderWidth: 1,
      borderColor: onboardingPalette.borderStrong,
   },
   buttonDisabled: {
      opacity: 0.56,
   },
   primaryButtonText: {
      color: onboardingPalette.onAccent,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.1,
      textAlign: 'center',
   },
   secondaryButtonText: {
      color: onboardingPalette.text,
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: -0.1,
      textAlign: 'center',
   },
   disabledButtonText: {
      color: 'rgba(3, 3, 3, 0.42)',
   },
   messageRow: {
      marginTop: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-start',
      gap: 10,
   },
   errorText: {
      color: onboardingPalette.error,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      flexShrink: 1,
   },
   deviceActions: {
      alignSelf: 'stretch',
      gap: 10,
   },
   statusCard: {
      minHeight: 156,
      alignSelf: 'stretch',
   },
   statusRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
   },
   statusIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: onboardingPalette.accentSoft,
   },
   statusIconSuccess: {
      backgroundColor: 'rgba(110, 231, 183, 0.12)',
   },
   statusLabel: {
      color: onboardingPalette.text,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: -0.2,
      textAlign: 'center',
   },
   statusText: {
      marginTop: 14,
      color: onboardingPalette.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
   },
   inlineLoader: {
      marginTop: 18,
   },
   inlineButtons: {
      marginTop: 18,
      gap: 10,
   },
   fieldBlock: {
      alignItems: 'center',
      gap: 8,
   },
   fieldLabel: {
      color: onboardingPalette.text,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
   },
   input: {
      minHeight: 52,
      width: '100%',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: onboardingPalette.border,
      backgroundColor: onboardingPalette.surfaceStrong,
      paddingHorizontal: 16,
      color: onboardingPalette.text,
      fontSize: 15,
      textAlign: 'center',
   },
   chipWrap: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      flexWrap: 'wrap',
   },
   timezoneChip: {
      minHeight: 36,
      borderRadius: 8,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: onboardingPalette.surfaceStrong,
      borderWidth: 1,
      borderColor: onboardingPalette.border,
   },
   timezoneChipActive: {
      backgroundColor: onboardingPalette.accent,
      borderColor: onboardingPalette.accent,
   },
   timezoneChipText: {
      color: onboardingPalette.text,
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
   },
   timezoneChipTextActive: {
      color: onboardingPalette.onAccent,
   },
   sheetFooterRow: {
      marginTop: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
   },
   switchLabel: {
      color: onboardingPalette.textMuted,
      fontSize: 13,
      textAlign: 'center',
   },
   switchAction: {
      color: onboardingPalette.text,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
   },
});
