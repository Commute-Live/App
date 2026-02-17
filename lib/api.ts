const DEFAULT_API_BASE = 'https://api.commutelive.com';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const API_BASE = trimTrailingSlash(
  process.env.EXPO_PUBLIC_SERVER_URL ?? process.env.SERVER_URL ?? DEFAULT_API_BASE,
);

const resolveUrl = (input: string) => {
  if (/^https?:\/\//i.test(input)) return input;
  const path = input.startsWith('/') ? input : `/${input}`;
  return `${API_BASE}${path}`;
};

const getErrorCode = async (response: Response): Promise<string | null> => {
  try {
    const data = await response.clone().json();
    return typeof data?.error === 'string' ? data.error : null;
  } catch {
    return null;
  }
};

let sessionInvalidHandler: ((code: 'REFRESH_INVALID' | 'REFRESH_REUSED') => void) | null = null;

export const setSessionInvalidHandler = (
  handler: ((code: 'REFRESH_INVALID' | 'REFRESH_REUSED') => void) | null,
) => {
  sessionInvalidHandler = handler;
};

const shouldHandleWithRefresh = (url: string) => {
  if (!url.startsWith(API_BASE)) return false;
  return !url.endsWith('/auth/login') && !url.endsWith('/auth/refresh') && !url.endsWith('/auth/logout');
};

const refreshSession = async () => {
  const response = await fetch(resolveUrl('/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
  });
  return response;
};

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const url = resolveUrl(input);
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
  });

  if (!shouldHandleWithRefresh(url) || response.status !== 401) {
    return response;
  }

  const errorCode = await getErrorCode(response);
  if (errorCode !== 'ACCESS_EXPIRED') {
    return response;
  }

  try {
    const refreshResponse = await refreshSession();
    if (!refreshResponse.ok) {
      const refreshError = await getErrorCode(refreshResponse);
      if (
        (refreshError === 'REFRESH_INVALID' || refreshError === 'REFRESH_REUSED') &&
        sessionInvalidHandler
      ) {
        sessionInvalidHandler(refreshError);
      }
      return refreshResponse;
    }
  } catch {
    return response;
  }

  return fetch(url, {
    ...init,
    credentials: 'include',
  });
}
