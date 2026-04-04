import {useCallback} from 'react';
import {GoogleSignin, statusCodes} from '../../../lib/googleSignIn';
import {useRouter} from 'expo-router';
import {Platform} from 'react-native';
import {useAuth} from '../../../state/authProvider';
import {getPostAuthRoute} from '../../../lib/deviceSetup';
import {googleAuthConfig} from '../../../lib/googleAuthConfig';
import {signInWithGooglePopup} from '../../../lib/googleWebAuth';

const DEVELOPER_ERROR_CODES = new Set(['10', 'DEVELOPER_ERROR']);
const SIGN_IN_FAILED_CODES = new Set(['8', '12500', 'SIGN_IN_FAILED']);
const NETWORK_ERROR_CODES = new Set(['7', 'NETWORK_ERROR']);

function getGoogleAuthErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as {code?: unknown}).code) : '';
  const message =
    typeof error === 'object' && error && 'message' in error ? String((error as {message?: unknown}).message) : '';

  if (code === statusCodes.SIGN_IN_CANCELLED) {
    return 'cancelled';
  }

  if (code === statusCodes.IN_PROGRESS) {
    return 'Google Sign-In is already in progress.';
  }

  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return 'Google Play Services is unavailable on this device or emulator.';
  }

  if (Platform.OS === 'android' && (DEVELOPER_ERROR_CODES.has(code) || /developer_error/i.test(message))) {
    return 'Android Google Sign-In is misconfigured. Add package com.commutelive.app and this build\'s SHA-1 to your Google OAuth client, then rebuild the app.';
  }

  if (Platform.OS === 'android' && NETWORK_ERROR_CODES.has(code)) {
    return 'Google Sign-In failed because the emulator could not reach Google services. Check network connectivity in the emulator and try again.';
  }

  if (Platform.OS === 'android' && SIGN_IN_FAILED_CODES.has(code)) {
    const detail = message && message !== 'Error' ? ` ${message}` : '';
    return `Android Google Sign-In was rejected by Google.${detail} Verify the emulator account is allowed as a test user and that the Android OAuth client matches package com.commutelive.app.`;
  }

  if (message && message !== 'Error') {
    return message;
  }

  if (Platform.OS === 'android' && code) {
    return `Google Sign-In failed on Android (code ${code}).`;
  }

  return 'Google Sign-In failed';
}

export function useGoogleAuth() {
  const {socialSignIn} = useAuth();
  const router = useRouter();

  const signInWithGoogle = useCallback(async (): Promise<{ok: boolean; error?: string}> => {
    try {
      if (Platform.OS === 'web') {
        const webClientId = googleAuthConfig.webClientId;
        if (!webClientId) {
          return {ok: false, error: 'Google Sign-In is not configured'};
        }

        const webResult = await signInWithGooglePopup(webClientId);
        if (!webResult.ok) {
          return {ok: false, error: webResult.error};
        }

        const result = await socialSignIn('google', webResult.token);
        if (result.ok) {
          router.replace(getPostAuthRoute(result.deviceIds));
        }
        return result;
      }

      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signOut().catch(() => {});
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        return {ok: false, error: 'Google Sign-In completed but no ID token was returned. Verify the configured Google client IDs for this build.'};
      }

      const result = await socialSignIn('google', idToken);
      if (result.ok) {
        router.replace(getPostAuthRoute(result.deviceIds));
      }
      return result;
    } catch (error: unknown) {
      const resolvedError = getGoogleAuthErrorMessage(error);
      if (resolvedError !== 'cancelled') {
        console.warn('Google Sign-In failed', error);
      }
      return {ok: false, error: resolvedError};
    }
  }, [router, socialSignIn]);

  return {signInWithGoogle};
}
