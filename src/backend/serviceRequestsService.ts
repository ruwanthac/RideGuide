import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { ServiceRequestDoc } from './types';

const COLLECTION = 'serviceRequests';

export type ServiceRequestRow = ServiceRequestDoc & { id: string };

export function subscribeServiceRequests(
  onData: (items: ServiceRequestRow[]) => void,
  onError?: (e: Error) => void
): () => void {
  const q = query(
    collection(db, COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(40)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: ServiceRequestRow[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ServiceRequestRow, 'id'>),
      }));
      onData(items);
    },
    (err) => onError?.(err as Error)
  );
}

export async function deleteServiceRequest(requestId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, requestId));
}
