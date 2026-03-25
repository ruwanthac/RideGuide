import React, { createContext, useContext, useMemo, useState } from 'react';

export type UserRole = 'owner' | 'mechanic' | 'tow';

interface UserRoleContextValue {
  role: UserRole;
  setRole: (role: UserRole) => void;
  name: string;
}

const UserRoleContext = createContext<UserRoleContextValue | undefined>(undefined);

export const UserRoleProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [role, setRole] = useState<UserRole>('owner');
  const name = 'Alex';

  const value = useMemo(
    () => ({
      role,
      setRole,
      name,
    }),
    [role]
  );

  return (
    <UserRoleContext.Provider value={value}>{children}</UserRoleContext.Provider>
  );
};

export const useUserRole = (): UserRoleContextValue => {
  const ctx = useContext(UserRoleContext);
  if (!ctx) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return ctx;
};

