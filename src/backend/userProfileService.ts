import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { UserProfileDoc, UserRole } from './types';

export const userDocRef = (uid: string) => doc(db, 'users', uid);

export async function getUserProfile(uid: string): Promise<UserProfileDoc | null> {
  const snap = await getDoc(userDocRef(uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfileDoc;
}

export async function createUserProfile(
  uid: string,
  input: {
    displayName: string;
    email: string;
    role?: UserRole;
    selectedVehicleId?: string | null;
  }
): Promise<void> {
  const payload: Omit<UserProfileDoc, 'createdAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    displayName: input.displayName.trim(),
    email: input.email.trim(),
    role: input.role ?? 'owner',
    selectedVehicleId: input.selectedVehicleId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(userDocRef(uid), payload);
}

export async function updateUserProfile(
  uid: string,
  patch: Partial<Pick<UserProfileDoc, 'displayName' | 'role' | 'selectedVehicleId'>>
): Promise<void> {
  await updateDoc(userDocRef(uid), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}
