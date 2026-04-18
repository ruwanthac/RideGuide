import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { updateUserProfile } from '../backend/userProfileService';
import type { UserRole } from '../backend/types';

interface UserRoleContextValue {
  role: UserRole;
  setRole: (role: UserRole) => Promise<void>;
}

const UserRoleContext = createContext<UserRoleContextValue | undefined>(undefined);

export const UserRoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, refreshProfile } = useAuth();
  const role: UserRole = (user?.role as UserRole) ?? 'owner';

  const setRole = useCallback(async (next: UserRole) => {
    await updateUserProfile({ role: next });
    await refreshProfile();
  }, [refreshProfile]);

  const value = useMemo(() => ({ role, setRole }), [role, setRole]);
  return <UserRoleContext.Provider value={value}>{children}</UserRoleContext.Provider>;
};

export function useUserRole(): UserRoleContextValue {
  const ctx = useContext(UserRoleContext);
  if (!ctx) throw new Error('useUserRole must be used within UserRoleProvider');
  return ctx;
}
