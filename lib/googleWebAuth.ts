const GOOGLE_AUTH_MESSAGE_TYPE = 'commutelive-google-auth-callback';
const GOOGLE_AUTH_TIMEOUT_MS = 60_000;

type GoogleWebAuthResult =
  | {ok: true; token: string}
  | {ok: false; error: string};

const randomToken = () => {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
};

const parseHashParams = (hash: string) => {
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash;
  return new URLSearchParams(normalizedHash);
};

export async function signInWithGooglePopup(webClientId: string): Promise<GoogleWebAuthResult> {
  if (typeof window === 'undefined') {
    return {ok: false, error: 'Google Sign-In is not available in this environment.'};
  }

  const state = randomToken();
  const nonce = randomToken();
  const redirectUri = `${window.location.origin}/google-auth-callback`;
  const search = new URLSearchParams({
    client_id: webClientId,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce,
    prompt: 'select_account',
    state,
  });

  const popup = window.open(
    `https://accounts.google.com/o/oauth2/v2/auth?${search.toString()}`,
    'commutelive-google-signin',
    'popup=yes,width=520,height=720',
  );

  if (!popup) {
    return {ok: false, error: 'Google Sign-In popup was blocked.'};
  }

  return new Promise(resolve => {
    let settled = false;

    const finish = (result: GoogleWebAuthResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', handleMessage);
      window.clearInterval(closePoll);
      window.clearTimeout(timeout);
      try {
        popup.close();
      } catch {
        // Ignore popup close errors.
      }
      resolve(result);
    };

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {type?: string; hash?: string} | null;
      if (!data || data.type !== GOOGLE_AUTH_MESSAGE_TYPE) return;

      const params = parseHashParams(data.hash ?? '');
      if (params.get('state') !== state) {
        finish({ok: false, error: 'Google Sign-In failed.'});
        return;
      }

      const error = params.get('error');
      if (error) {
        finish({ok: false, error: error === 'access_denied' ? 'cancelled' : 'Google Sign-In failed.'});
        return;
      }

      const token = params.get('id_token');
      if (!token) {
        finish({ok: false, error: 'Google Sign-In failed.'});
        return;
      }

      finish({ok: true, token});
    };

    const closePoll = window.setInterval(() => {
      if (popup.closed) {
        finish({ok: false, error: 'cancelled'});
      }
    }, 500);

    const timeout = window.setTimeout(() => {
      finish({ok: false, error: 'Google Sign-In timed out.'});
    }, GOOGLE_AUTH_TIMEOUT_MS);

    window.addEventListener('message', handleMessage);
  });
}

export {GOOGLE_AUTH_MESSAGE_TYPE};
