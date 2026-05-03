import { api } from './apiClient';
import type { DiagnosisEntry } from './types';

export async function runDiagnosis(input: {
  symptoms: string;
  obdCode: string;
  vehicleId?: string;
  vehicleMakeModel?: string;
  vehicleVin?: string;
}): Promise<DiagnosisEntry> {
  const { data } = await api.post<DiagnosisEntry>('/diagnosis', input, { timeout: 90_000 });
  return data;
}
