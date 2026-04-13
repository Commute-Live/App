const DEFAULT_API_BASE = 'https://staging.commutelive.com';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const API_BASE = trimTrailingSlash(
  process.env.EXPO_PUBLIC_SERVER_URL ?? process.env.SERVER_URL ?? DEFAULT_API_BASE,
);

const resolveUrl = (input: string) => {
  if (/^https?:\/\//i.test(input)) return input;
  const path = input.startsWith('/') ? input : `/${input}`;
  return `${API_BASE}${path}`;
};

const formatRequestBodyForLog = (body: RequestInit['body']) => {
  if (body == null) return null;
  if (typeof body === 'string') {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }
  if (body instanceof FormData) {
    const entries = Array.from(body.entries()).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : `[file:${value.name}]`,
    ]);
    return JSON.stringify(Object.fromEntries(entries), null, 2);
  }
  if (body instanceof URLSearchParams) return body.toString();
  return '[non-text request body]';
};

const shouldLogRequest = (url: string, method: string) => {
  if (!__DEV__) return false;
  if (method === 'GET') return false;
  return (
    url.startsWith(`${API_BASE}/device/`) ||
    url.startsWith(`${API_BASE}/refresh/device/`)
  );
};

const getErrorCode = async (response: Response): Promise<string | null> => {
  try {
    const data = await response.clone().json();
    return typeof data?.error === 'string' ? data.error : null;
  } catch {
    return null;
  }
};

let sessionInvalidHandler:
  | ((code: 'REFRESH_INVALID' | 'REFRESH_REUSED' | 'SESSION_REVOKED') => void)
  | null = null;

export const setSessionInvalidHandler = (
  handler: ((code: 'REFRESH_INVALID' | 'REFRESH_REUSED' | 'SESSION_REVOKED') => void) | null,
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
  const method = (init.method ?? 'GET').toUpperCase();
  if (shouldLogRequest(url, method)) {
    const formattedBody = formatRequestBodyForLog(init.body);
    console.warn(`[apiFetch] ${method} ${url}\nbody:\n${formattedBody ?? 'null'}`);
  }
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
  });

  if (!shouldHandleWithRefresh(url) || response.status !== 401) {
    return response;
  }

  const errorCode = await getErrorCode(response);
  if (errorCode === 'SESSION_REVOKED' && sessionInvalidHandler) {
    sessionInvalidHandler(errorCode);
    return response;
  }
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
