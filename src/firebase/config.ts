import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import * as FirebaseAuth from 'firebase/auth';
import { getAuth, type Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

function createFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }
  return initializeApp(firebaseConfig);
}

/** False when `.env` is missing `EXPO_PUBLIC_FIREBASE_*` (Expo embeds these at bundle time). */
export const isFirebaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY &&
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
);

export const firebaseApp: FirebaseApp = createFirebaseApp();
export const db: Firestore = getFirestore(firebaseApp);

let authInstance: Auth | null = null;
let authInitError: string | null = null;
try {
  const initializeAuthFn = (FirebaseAuth as any).initializeAuth as
    | ((app: FirebaseApp, deps?: unknown) => Auth)
    | undefined;
  const getReactNativePersistenceFn = (FirebaseAuth as any)
    .getReactNativePersistence as ((storage: unknown) => unknown) | undefined;

  if (initializeAuthFn && getReactNativePersistenceFn) {
    authInstance = initializeAuthFn(firebaseApp, {
      persistence: getReactNativePersistenceFn(AsyncStorage),
    });
  } else {
    authInstance = getAuth(firebaseApp);
  }
} catch (e: unknown) {
  try {
    authInstance = getAuth(firebaseApp);
  } catch (fallbackError: unknown) {
    authInitError =
      fallbackError instanceof Error
        ? fallbackError.message
        : e instanceof Error
        ? e.message
        : 'Unknown Firebase auth init error';
  }
}

export const auth: Auth | null = authInstance;
export const firebaseAuthInitError: string | null = authInitError;
