import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {apiFetch} from '../lib/api';
import {useAppState} from './appState';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthUser = {
  id: string;
  email: string;
};

type AuthContextValue = {
  status: AuthStatus;
  isAuthenticated: boolean;
  user: AuthUser | null;
  deviceIds: string[];
  deviceId: string | null;
  hydrate: () => Promise<void>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ok: true; user: AuthUser; deviceIds: string[]} | {ok: false; error: string}>;
  signOut: () => Promise<void>;
  clearAuth: () => void;
  setDeviceId: (deviceId: string | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type UserProfilePayload = {
  id: string;
  email: string;
  deviceIds: string[];
};

const toUserProfile = (input: any): UserProfilePayload | null => {
  if (typeof input?.id !== 'string' || typeof input?.email !== 'string') return null;
  const deviceIds = Array.isArray(input?.deviceIds)
    ? input.deviceIds.filter((id: unknown) => typeof id === 'string')
    : [];
  return {id: input.id, email: input.email, deviceIds};
};

export function AuthProvider({children}: {children: React.ReactNode}) {
  const {
    state: {deviceId: appDeviceId},
    setUserId,
    setDeviceId: setAppDeviceId,
    setDeviceStatus,
    clearAuth: clearAppAuth,
  } = useAppState();

  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [deviceIds, setDeviceIds] = useState<string[]>([]);

  const applyAuthenticatedProfile = useCallback(
    (profile: UserProfilePayload) => {
      setUser({id: profile.id, email: profile.email});
      setDeviceIds(profile.deviceIds);
      setStatus('authenticated');
      setUserId(profile.id);

      const nextDeviceId =
        appDeviceId && profile.deviceIds.includes(appDeviceId)
          ? appDeviceId
          : profile.deviceIds[0] ?? null;
      setAppDeviceId(nextDeviceId);
      setDeviceStatus(profile.deviceIds.length > 0 ? 'pairedOnline' : 'notPaired');
    },
    [appDeviceId, setAppDeviceId, setDeviceStatus, setUserId],
  );

  const clearAuth = useCallback(() => {
    setUser(null);
    setDeviceIds([]);
    setStatus('unauthenticated');
    clearAppAuth();
  }, [clearAppAuth]);

  const hydrate = useCallback(async () => {
    setStatus('loading');
    try {
      const response = await apiFetch('/auth/me');
      const data = await response.json().catch(() => null);
      const profile = toUserProfile(data?.user);
      if (!response.ok || !profile) {
        clearAuth();
        return;
      }
      applyAuthenticatedProfile(profile);
    } catch {
      clearAuth();
    }
  }, [applyAuthenticatedProfile, clearAuth]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const response = await apiFetch('/auth/login', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({email: email.trim(), password}),
        });
        const data = await response.json().catch(() => null);
        const profile = toUserProfile(data?.user);
        if (!response.ok || !profile) {
          return {
            ok: false as const,
            error: data?.error === 'INVALID_CREDENTIALS' ? 'Invalid email or password' : 'Login failed',
          };
        }
        applyAuthenticatedProfile(profile);
        return {ok: true as const, user: {id: profile.id, email: profile.email}, deviceIds: profile.deviceIds};
      } catch {
        return {ok: false as const, error: 'Network error'};
      }
    },
    [applyAuthenticatedProfile],
  );

  const signOut = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', {method: 'POST'});
    } finally {
      clearAuth();
    }
  }, [clearAuth]);

  const setDeviceId = useCallback(
    (nextDeviceId: string | null) => {
      setAppDeviceId(nextDeviceId);
    },
    [setAppDeviceId],
  );

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const value = useMemo(
    () => ({
      status,
      isAuthenticated: status === 'authenticated',
      user,
      deviceIds,
      deviceId: appDeviceId,
      hydrate,
      signIn,
      signOut,
      clearAuth,
      setDeviceId,
    }),
    [appDeviceId, clearAuth, deviceIds, hydrate, setDeviceId, signIn, signOut, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
