import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { updateUserProfile, type UserRole as BackendUserRole } from '../backend';

export type UserRole = BackendUserRole;

interface UserRoleContextValue {
  role: UserRole;
  setRole: (role: UserRole) => void;
  name: string;
}

const UserRoleContext = createContext<UserRoleContextValue | undefined>(undefined);

export const UserRoleProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, profile, refreshProfile } = useAuth();
  const [role, setRoleState] = useState<UserRole>('owner');

  useEffect(() => {
    if (profile?.role) {
      setRoleState(profile.role);
    }
  }, [profile?.role, user?.uid]);

  const setRole = useCallback(
    (next: UserRole) => {
      setRoleState(next);
      if (user?.uid) {
        void updateUserProfile(user.uid, { role: next })
          .then(() => refreshProfile())
          .catch(() => {
            /* offline / rules; local role still applied */
          });
      }
    },
    [user?.uid, refreshProfile]
  );

  const name = profile?.displayName?.trim() || 'Alex';

  const value = useMemo(
    () => ({
      role,
      setRole,
      name,
    }),
    [role, name, setRole]
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
