import {useCallback, useEffect, useState} from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import {useRouter} from 'expo-router';
import {useAuth} from '../../../state/authProvider';

export function useAppleAuth() {
  const {socialSignIn} = useAuth();
  const router = useRouter();
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setIsAvailable);
  }, []);

  const signInWithApple = useCallback(async (): Promise<{ok: boolean; error?: string}> => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        return {ok: false, error: 'Apple Sign-In failed'};
      }

      const result = await socialSignIn('apple', credential.identityToken);
      if (result.ok) {
        router.replace('/dashboard');
      }
      return result;
    } catch (error: any) {
      if (error?.code === 'ERR_REQUEST_CANCELED') {
        return {ok: false, error: 'cancelled'};
      }
      return {ok: false, error: 'Apple Sign-In failed'};
    }
  }, [router, socialSignIn]);

  return {isAvailable, signInWithApple};
}
