import {useCallback} from 'react';
import {GoogleSignin, statusCodes} from '../../../lib/googleSignIn';
import {useRouter} from 'expo-router';
import {useAuth} from '../../../state/authProvider';

export function useGoogleAuth() {
  const {socialSignIn} = useAuth();
  const router = useRouter();

  const signInWithGoogle = useCallback(async (): Promise<{ok: boolean; error?: string}> => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        return {ok: false, error: 'Google Sign-In failed'};
      }

      const result = await socialSignIn('google', idToken);
      if (result.ok) {
        router.replace(result.deviceIds.length === 0 ? '/ble-provision' : '/dashboard');
      }
      return result;
    } catch (error: any) {
      if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
        return {ok: false, error: 'cancelled'};
      }
      return {ok: false, error: 'Google Sign-In failed'};
    }
  }, [router, socialSignIn]);

  return {signInWithGoogle};
}
