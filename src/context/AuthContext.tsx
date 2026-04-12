import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, isFirebaseConfigured, firebaseAuthInitError } from '../firebase';
import {
  createUserProfile,
  getUserProfile,
  addUserVehicle,
  updateUserProfile,
  type UserProfileDoc,
} from '../backend';

interface AuthContextValue {
  user: User | null;
  profile: UserProfileDoc | null;
  authReady: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (
    displayName: string,
    email: string,
    password: string
  ) => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEFAULT_MAKE_MODEL = 'Toyota Camry 2020';
const DEFAULT_VIN = '1HGBH41JXMN109186';

async function ensureBootstrapForUser(
  uid: string,
  email: string,
  displayName: string
): Promise<UserProfileDoc | null> {
  let profile = await getUserProfile(uid);
  if (!profile) {
    await createUserProfile(uid, {
      displayName: displayName.trim() || 'Driver',
      email: email.trim(),
      role: 'owner',
      selectedVehicleId: null,
    });
    const vehicleId = await addUserVehicle(uid, {
      label: 'Car 1',
      makeModel: DEFAULT_MAKE_MODEL,
      vin: DEFAULT_VIN,
    });
    await updateUserProfile(uid, { selectedVehicleId: vehicleId });
    profile = await getUserProfile(uid);
  }
  return profile;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileDoc | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const refreshProfile = useCallback(async () => {
    if (!auth) return;
    const u = auth.currentUser;
    if (!u) {
      setProfile(null);
      return;
    }
    const p = await getUserProfile(u.uid);
    setProfile(p);
  }, []);

  useEffect(() => {
    if (__DEV__ && !isFirebaseConfigured) {
      console.warn(
        '[Firebase] Add EXPO_PUBLIC_FIREBASE_* keys to a root .env file (see .env.example). Auth and Firestore need a valid web app config.'
      );
    }
    if (__DEV__ && firebaseAuthInitError) {
      console.warn(`[Firebase] Auth init failed: ${firebaseAuthInitError}`);
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return;
    }
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
      }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const uid = user?.uid;
    const email = user?.email ?? '';
    const displayName = user?.displayName ?? 'Driver';
    if (!uid) {
      return;
    }
    let cancelled = false;
    (async () => {
      let p: UserProfileDoc | null = null;
      try {
        p = await ensureBootstrapForUser(uid, email, displayName);
      } catch {
        // Do not block signed-in users if Firestore bootstrap fails.
        p = await getUserProfile(uid);
      }
      if (!cancelled) {
        setProfile(p);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.email, user?.displayName]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!auth) {
      throw new Error(
        'Firebase is not configured. Add EXPO_PUBLIC_FIREBASE_* to .env and restart Expo.'
      );
    }
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const registerWithEmail = useCallback(
    async (displayName: string, email: string, password: string) => {
      if (!auth) {
        throw new Error(
          'Firebase is not configured. Add EXPO_PUBLIC_FIREBASE_* to .env and restart Expo.'
        );
      }
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const uid = cred.user.uid;
      try {
        const p = await ensureBootstrapForUser(uid, email, displayName);
        if (p) {
          setProfile(p);
        }
      } catch {
        // Account is created in Firebase Auth; profile bootstrap can retry on next app load.
      }
    },
    []
  );

  const signOutUser = useCallback(async () => {
    if (!auth) return;
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      authReady,
      signInWithEmail,
      registerWithEmail,
      signOutUser,
      refreshProfile,
    }),
    [
      user,
      profile,
      authReady,
      signInWithEmail,
      registerWithEmail,
      signOutUser,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
