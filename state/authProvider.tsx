import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {apiFetch} from '../lib/api';
import {queryKeys} from '../lib/queryKeys';
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
  disconnectDevice: (
    deviceId: string,
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

  const signInMutation = useMutation({
    mutationFn: async ({email, password}: {email: string; password: string}) => {
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
        return {ok: true as const, profile};
      } catch {
        return {ok: false as const, error: 'Network error'};
      }
    },
  });

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

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await signInMutation.mutateAsync({email, password});
      if (!result.ok) {
        return result;
      }
      applyAuthenticatedProfile(result.profile);
      queryClient.setQueryData(queryKeys.auth.me, result.profile);
      return {
        ok: true as const,
        user: {id: result.profile.id, email: result.profile.email},
        deviceIds: result.profile.deviceIds,
      };
    },
    [applyAuthenticatedProfile, queryClient, signInMutation],
  );

  const signOut = useCallback(async () => {
    try {
      await signOutMutation.mutateAsync();
    } finally {
      queryClient.removeQueries({queryKey: queryKeys.auth.me});
      clearAuth();
    }
  }, [clearAuth, queryClient, signOutMutation]);

  const disconnectDevice = useCallback(
    async (disconnectDeviceId: string) => {
      const result = await disconnectDeviceMutation.mutateAsync(disconnectDeviceId);
      if (!result.ok) {
        return result;
      }

      await Promise.all([
        queryClient.cancelQueries({queryKey: queryKeys.displays(disconnectDeviceId)}),
        queryClient.cancelQueries({queryKey: queryKeys.deviceConfig(disconnectDeviceId)}),
        queryClient.cancelQueries({queryKey: queryKeys.lastCommand(disconnectDeviceId)}),
      ]);

      queryClient.removeQueries({queryKey: queryKeys.displays(disconnectDeviceId)});
      queryClient.removeQueries({queryKey: queryKeys.deviceConfig(disconnectDeviceId)});
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
      setStatus('loading');
      return;
    }
    if (authMeQuery.isSuccess) {
      applyAuthenticatedProfile(authMeQuery.data);
      return;
    }
    if (authMeQuery.isError && status !== 'unauthenticated') {
      clearAuth();
    }
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
      deviceId: appDeviceId,
      hydrate,
      signIn,
      disconnectDevice,
      signOut,
      clearAuth,
      setDeviceId,
    }),
    [
      appDeviceId,
      clearAuth,
      deviceIds,
      disconnectDevice,
      hydrate,
      setDeviceId,
      signIn,
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
