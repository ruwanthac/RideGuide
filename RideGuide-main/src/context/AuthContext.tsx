import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { setAuthToken, getAuthToken } from '../backend/apiClient';
import { loginWithApi, registerWithApi, fetchMe, logoutWithApi, type RegisterProviderPayload } from '../backend/authService';
import { formatAuthError } from '../backend/authErrors';
import type { AuthUser } from '../backend/types';

export type PasswordChangePrompt = null | 'optional';

interface AuthContextValue {
  user: AuthUser | null;
  profile: AuthUser | null;
  authReady: boolean;
  /** Mechanic/tow: after login, offer optional password change (`PasswordChangePromptGate`). */
  passwordChangePrompt: PasswordChangePrompt;
  clearPasswordChangePrompt: () => void;
  signInWithEmail: (email: string, password: string) => Promise<AuthUser>;
  registerWithEmail: (
    displayName: string,
    email: string,
    password: string | undefined,
    role?: 'owner' | 'mechanic' | 'tow',
    phoneNumber?: string,
    provider?: RegisterProviderPayload
  ) => Promise<{ pendingVerification: boolean }>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [passwordChangePrompt, setPasswordChangePrompt] = useState<PasswordChangePrompt>(null);
  const [authReady, setAuthReady] = useState(false);
  const mounted = useRef(true);

  const clearPasswordChangePrompt = useCallback(() => {
    setPasswordChangePrompt(null);
  }, []);

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
      if (!u.mustChangePassword && (u.role === 'mechanic' || u.role === 'tow')) {
        setPasswordChangePrompt('optional');
      } else {
        setPasswordChangePrompt(null);
      }
      setUser(u);
      return u;
    } catch (e) { throw new Error(formatAuthError(e)); }
  }, []);

  const registerWithEmail = useCallback(
    async (
      displayName: string,
      email: string,
      password: string | undefined,
      role?: 'owner' | 'mechanic' | 'tow',
      phoneNumber?: string,
      provider?: RegisterProviderPayload
    ) => {
      try {
        const { user, pendingVerification } = await registerWithApi({
          email,
          password,
          displayName,
          role,
          ...(phoneNumber?.trim() ? { phoneNumber: phoneNumber.trim() } : {}),
          ...(provider ? { provider } : {}),
        });
        if (!pendingVerification) {
          setUser(user);
        }
        return { pendingVerification };
      } catch (e) {
        throw new Error(formatAuthError(e));
      }
    },
    []
  );

  const signOutUser = useCallback(async () => {
    await logoutWithApi();
    setPasswordChangePrompt(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    profile: user,
    authReady,
    passwordChangePrompt,
    clearPasswordChangePrompt,
    signInWithEmail,
    registerWithEmail,
    signOutUser,
    refreshProfile,
  }), [
    user,
    authReady,
    passwordChangePrompt,
    clearPasswordChangePrompt,
    signInWithEmail,
    registerWithEmail,
    signOutUser,
    refreshProfile,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
