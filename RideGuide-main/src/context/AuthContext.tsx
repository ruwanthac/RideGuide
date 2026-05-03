import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { setAuthToken, getAuthToken } from '../backend/apiClient';
import { loginWithApi, registerWithApi, fetchMe, logoutWithApi } from '../backend/authService';
import { formatAuthError } from '../backend/authErrors';
import type { AuthUser } from '../backend/types';

interface AuthContextValue {
  user: AuthUser | null;
  profile: AuthUser | null;
  authReady: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (
    displayName: string,
    email: string,
    password: string,
    role?: 'owner' | 'mechanic' | 'tow'
  ) => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      const token = await getAuthToken();
      if (token) {
        const me = await fetchMe();
        if (me && mounted.current) setUser(me);
        else await setAuthToken(null);
      }
      if (mounted.current) setAuthReady(true);
    })();
    return () => { mounted.current = false; };
  }, []);

  const refreshProfile = useCallback(async () => {
    const me = await fetchMe();
    if (me) setUser(me);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    try {
      const u = await loginWithApi({ email, password });
      setUser(u);
    } catch (e) { throw new Error(formatAuthError(e)); }
  }, []);

  const registerWithEmail = useCallback(
    async (
      displayName: string,
      email: string,
      password: string,
      role?: 'owner' | 'mechanic' | 'tow'
    ) => {
      try {
        const u = await registerWithApi({ email, password, displayName, role });
        setUser(u);
      } catch (e) {
        throw new Error(formatAuthError(e));
      }
    },
    []
  );

  const signOutUser = useCallback(async () => {
    await logoutWithApi();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    profile: user,
    authReady,
    signInWithEmail,
    registerWithEmail,
    signOutUser,
    refreshProfile,
  }), [user, authReady, signInWithEmail, registerWithEmail, signOutUser, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
