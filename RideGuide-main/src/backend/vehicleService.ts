import { api } from './apiClient';
import type { Vehicle } from './types';

export async function listVehicles(): Promise<Vehicle[]> {
  const { data } = await api.get<Vehicle[]>('/vehicles');
  return data;
}

export async function addUserVehicle(input: {
  label: string;
  makeModel: string;
  vin: string;
  make?: string;
  model?: string;
  year?: number;
  trim?: string;
  engine?: string;
}): Promise<Vehicle> {
  const { data } = await api.post<Vehicle>('/vehicles', input);
  return data;
}

export async function updateUserVehicle(
  id: string,
  patch: Partial<{
    label: string;
    makeModel: string;
    vin: string;
    make: string;
    model: string;
    year: number;
    trim: string;
    engine: string;
  }>
): Promise<Vehicle> {
  const { data } = await api.patch<Vehicle>(`/vehicles/${id}`, patch);
  return data;
}

export async function deleteUserVehicle(id: string): Promise<void> {
  await api.delete(`/vehicles/${id}`);
}
