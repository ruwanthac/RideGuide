import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { VehicleDoc } from './types';

export const vehiclesCollectionRef = (uid: string) =>
  collection(db, 'users', uid, 'vehicles');

export function subscribeUserVehicles(
  uid: string,
  onData: (vehicles: { id: string; data: VehicleDoc }[]) => void,
  onError?: (e: Error) => void
): () => void {
  const q = query(vehiclesCollectionRef(uid), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        data: d.data() as VehicleDoc,
      }));
      onData(list);
    },
    (err) => onError?.(err)
  );
}

export async function addUserVehicle(
  uid: string,
  input: Pick<VehicleDoc, 'label' | 'makeModel' | 'vin'>
): Promise<string> {
  const ref = await addDoc(vehiclesCollectionRef(uid), {
    label: input.label,
    makeModel: input.makeModel,
    vin: input.vin,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateUserVehicle(
  uid: string,
  vehicleId: string,
  patch: Partial<Pick<VehicleDoc, 'label' | 'makeModel' | 'vin'>>
): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'vehicles', vehicleId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteUserVehicle(uid: string, vehicleId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'vehicles', vehicleId));
}
