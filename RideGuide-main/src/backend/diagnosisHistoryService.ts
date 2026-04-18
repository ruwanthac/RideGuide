import { api } from './apiClient';
import type { DiagnosisEntry } from './types';

export async function listDiagnosisHistory(vehicleId?: string): Promise<DiagnosisEntry[]> {
  const { data } = await api.get<DiagnosisEntry[]>('/diagnosis-history', {
    params: vehicleId ? { vehicleId } : undefined,
  });
  return data;
}
