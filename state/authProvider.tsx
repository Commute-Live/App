import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {GoogleSignin} from '../lib/googleSignIn';
import {apiFetch} from '../lib/api';
import {queryKeys} from '../lib/queryKeys';
import {useAppState} from './appState';
import {setDatadogUser, clearDatadogUser} from '../lib/datadog';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthUser = {
  id: string;
  email: string;
};

type SocialProvider = 'apple' | 'google';

type AuthContextValue = {
  status: AuthStatus;
  isAuthenticated: boolean;
  user: AuthUser | null;
  deviceIds: string[];
  displayCount: number;
  deviceId: string | null;
  currentProvider: SocialProvider | null;
  hydrate: () => Promise<void>;
  socialSignIn: (
    provider: SocialProvider,
    token: string,
  ) => Promise<{ok: true; user: AuthUser; deviceIds: string[]} | {ok: false; error: string}>;
  disconnectDevice: (
    deviceId: string,
  ) => Promise<{ok: true; user: AuthUser; deviceIds: string[]} | {ok: false; error: string}>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
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

const fetchAuthProfile = async (): Promise<UserProfilePayload> => {
  const response = await apiFetch('/auth/me');
  const data = await response.json().catch(() => null);
  const profile = toUserProfile(data?.user);
  if (!response.ok || !profile) {
    throw new Error('UNAUTHENTICATED');
  }
  return profile;
};

export function AuthProvider({children}: {children: React.ReactNode}) {
  const queryClient = useQueryClient();
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
  const [currentProvider, setCurrentProvider] = useState<SocialProvider | null>(null);

  const applyAuthenticatedProfile = useCallback(
    (profile: UserProfilePayload) => {
      setUser({id: profile.id, email: profile.email});
      setDeviceIds(profile.deviceIds);
      setStatus('authenticated');
      setUserId(profile.id);
      setDatadogUser({id: profile.id, email: profile.email});

      const nextDeviceId =
        appDeviceId && profile.deviceIds.includes(appDeviceId)
          ? appDeviceId
          : profile.deviceIds[0] ?? null;
      setAppDeviceId(nextDeviceId);
      if (profile.deviceIds.length === 0) {
        setDeviceStatus('notPaired');
      } else {
        // Start as pairedOffline; async check upgrades to pairedOnline if confirmed.
        setDeviceStatus('pairedOffline');
        if (nextDeviceId) {
          apiFetch(`/device/${encodeURIComponent(nextDeviceId)}/online`)
            .then(r => (r.ok ? r.json() : null))
            .catch(() => null)
            .then((data: {online?: boolean} | null) => {
              setDeviceStatus(data?.online === true ? 'pairedOnline' : 'pairedOffline');
            });
        }
      }
    },
    [appDeviceId, setAppDeviceId, setDeviceStatus, setUserId],
  );

  const clearAuth = useCallback(() => {
    setUser(null);
    setDeviceIds([]);
    setStatus('unauthenticated');
    setCurrentProvider(null);
    clearAppAuth();
    clearDatadogUser();
  }, [clearAppAuth]);

  const authMeQuery = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: fetchAuthProfile,
    retry: false,
    staleTime: 0,
  });

  const hydrate = useCallback(async () => {
    setStatus('loading');
    const result = await authMeQuery.refetch();
    if (result.data) {
      applyAuthenticatedProfile(result.data);
      return;
    }
    clearAuth();
  }, [applyAuthenticatedProfile, authMeQuery, clearAuth]);

  const signOutMutation = useMutation({
    mutationFn: async () => {
      await apiFetch('/auth/logout', {method: 'POST'});
    },
  });

  const disconnectDeviceMutation = useMutation({
    mutationFn: async (disconnectDeviceId: string) => {
      try {
        const response = await apiFetch(`/user/device/${encodeURIComponent(disconnectDeviceId)}`, {
          method: 'DELETE',
        });
        const data = await response.json().catch(() => null);
        const profile = toUserProfile(data?.user);
        if (!response.ok || !profile) {
          if (data?.error === 'DEVICE_NOT_LINKED') {
            return {
              ok: false as const,
              error: 'This device is not linked to your account.',
            };
          }
          if (data?.error === 'DEVICE_UNPAIR_DISPATCH_FAILED') {
            return {
              ok: false as const,
              error: 'Could not reset the display right now. Try again when the device is online.',
            };
          }
          return {
            ok: false as const,
            error: 'Failed to disconnect device.',
          };
        }
        return {ok: true as const, profile};
      } catch {
        return {ok: false as const, error: 'Network error'};
      }
    },
  });

  const socialSignIn = useCallback(
    async (provider: SocialProvider, token: string) => {
      try {
        const response = await apiFetch(`/auth/${provider}`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({token}),
        });
        const data = await response.json().catch(() => null);
        const profile = toUserProfile(data?.user);
        if (!response.ok || !profile) {
          return {ok: false as const, error: data?.message ?? data?.error ?? 'Sign-in failed'};
        }
        queryClient.setQueryData(queryKeys.auth.me, profile);
        applyAuthenticatedProfile(profile);
        setCurrentProvider(provider);
        return {
          ok: true as const,
          user: {id: profile.id, email: profile.email},
          deviceIds: profile.deviceIds,
        };
      } catch {
        return {ok: false as const, error: 'Network error'};
      }
    },
    [applyAuthenticatedProfile, queryClient],
  );

  const signOut = useCallback(async () => {
    try {
      await signOutMutation.mutateAsync();
    } finally {
      if (currentProvider === 'google') {
        await GoogleSignin.signOut().catch(() => {});
      }
      queryClient.removeQueries({queryKey: queryKeys.auth.me});
      clearAuth();
    }
  }, [clearAuth, currentProvider, queryClient, signOutMutation]);

  const deleteAccount = useCallback(async () => {
    try {
      await apiFetch('/user/account', {method: 'DELETE'});
    } finally {
      if (currentProvider === 'google') {
        await GoogleSignin.signOut().catch(() => {});
      }
      queryClient.removeQueries({queryKey: queryKeys.auth.me});
      clearAuth();
    }
  }, [clearAuth, currentProvider, queryClient]);

  const disconnectDevice = useCallback(
    async (disconnectDeviceId: string) => {
      const result = await disconnectDeviceMutation.mutateAsync(disconnectDeviceId);
      if (!result.ok) {
        return result;
      }

      await Promise.all([
        queryClient.cancelQueries({queryKey: queryKeys.displays(disconnectDeviceId)}),
        queryClient.cancelQueries({queryKey: queryKeys.deviceConfig(disconnectDeviceId)}),
        queryClient.cancelQueries({queryKey: queryKeys.deviceSettings(disconnectDeviceId)}),
        queryClient.cancelQueries({queryKey: queryKeys.lastCommand(disconnectDeviceId)}),
      ]);

      queryClient.removeQueries({queryKey: queryKeys.displays(disconnectDeviceId)});
      queryClient.removeQueries({queryKey: queryKeys.deviceConfig(disconnectDeviceId)});
      queryClient.removeQueries({queryKey: queryKeys.deviceSettings(disconnectDeviceId)});
      queryClient.removeQueries({queryKey: queryKeys.lastCommand(disconnectDeviceId)});
      queryClient.setQueryData(queryKeys.auth.me, result.profile);
      applyAuthenticatedProfile(result.profile);

      return {
        ok: true as const,
        user: {id: result.profile.id, email: result.profile.email},
        deviceIds: result.profile.deviceIds,
      };
    },
    [applyAuthenticatedProfile, disconnectDeviceMutation, queryClient],
  );

  const setDeviceId = useCallback(
    (nextDeviceId: string | null) => {
      setAppDeviceId(nextDeviceId);
    },
    [setAppDeviceId],
  );

  useEffect(() => {
    if (authMeQuery.isPending) {
      if (!user && status !== 'unauthenticated') {
        setStatus('loading');
      }
      return;
    }
    if (authMeQuery.isSuccess) {
      applyAuthenticatedProfile(authMeQuery.data);
      return;
    }
    if (authMeQuery.isError && status !== 'unauthenticated') {
      // Don't clear if socialSignIn just populated the cache
      const cached = queryClient.getQueryData(queryKeys.auth.me);
      if (!cached) {
        clearAuth();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    applyAuthenticatedProfile,
    authMeQuery.data,
    authMeQuery.isError,
    authMeQuery.isPending,
    authMeQuery.isSuccess,
    clearAuth,
    status,
  ]);

  const value = useMemo(
    () => ({
      status,
      isAuthenticated: status === 'authenticated',
      user,
      deviceIds,
      displayCount: deviceIds.length,
      deviceId: appDeviceId,
      currentProvider,
      hydrate,
      socialSignIn,
      disconnectDevice,
      signOut,
      deleteAccount,
      clearAuth,
      setDeviceId,
    }),
    [
      appDeviceId,
      clearAuth,
      currentProvider,
      deleteAccount,
      deviceIds,
      disconnectDevice,
      hydrate,
      setDeviceId,
      socialSignIn,
      signOut,
      status,
      user,
    ],
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
