import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { DiagnosisHistoryDoc } from './types';

export type DiagnosisHistoryRow = DiagnosisHistoryDoc & { id: string };

export function subscribeDiagnosisHistory(
  uid: string,
  onData: (items: DiagnosisHistoryRow[]) => void,
  onError?: (e: Error) => void
): () => void {
  const q = query(
    collection(db, 'users', uid, 'diagnosisHistory'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: DiagnosisHistoryRow[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<DiagnosisHistoryRow, 'id'>),
      }));
      onData(items);
    },
    (err) => onError?.(err as Error)
  );
}

export async function addDiagnosisHistoryEntry(
  uid: string,
  input: {
    vehicleId: string;
    vehicleLabel: string;
    symptoms: string;
    obdCode: string;
    diagnosis: string;
  }
): Promise<void> {
  await addDoc(collection(db, 'users', uid, 'diagnosisHistory'), {
    vehicleId: input.vehicleId,
    vehicleLabel: input.vehicleLabel,
    symptoms: input.symptoms.trim(),
    obdCode: input.obdCode.trim(),
    diagnosis: input.diagnosis.trim(),
    createdAt: serverTimestamp(),
  });
}
