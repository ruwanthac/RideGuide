import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import type { UserRole } from '../backend/types';

/** Role comes from the signed-in user only; each account is owner, mechanic, or tow — no in-app switching. */
interface UserRoleContextValue {
  role: UserRole;
}

const UserRoleContext = createContext<UserRoleContextValue | undefined>(undefined);

export const UserRoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const role: UserRole = (user?.role as UserRole) ?? 'owner';

  const value = useMemo(() => ({ role }), [role]);
  return <UserRoleContext.Provider value={value}>{children}</UserRoleContext.Provider>;
};

export function useUserRole(): UserRoleContextValue {
  const ctx = useContext(UserRoleContext);
  if (!ctx) throw new Error('useUserRole must be used within UserRoleProvider');
  return ctx;
}
