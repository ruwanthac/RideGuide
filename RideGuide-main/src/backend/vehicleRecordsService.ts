import { api } from './apiClient';
import type { DiagnosisEntry, ServiceRequest, Vehicle } from './types';

export interface VehicleRecords {
  vehicle: Vehicle;
  diagnoses: DiagnosisEntry[];
  requests: ServiceRequest[];
}

export async function fetchVehicleRecords(vehicleId: string): Promise<VehicleRecords> {
  const { data } = await api.get<VehicleRecords>(`/vehicles/${vehicleId}/records`);
  return data;
}
