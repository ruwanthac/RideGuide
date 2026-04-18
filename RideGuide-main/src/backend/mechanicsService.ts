import { api } from './apiClient';
import type { AuthUser } from './types';

export async function findNearbyMechanics(params: {
  lat: number;
  lng: number;
  radiusKm?: number;
  role?: 'mechanic' | 'tow';
}): Promise<AuthUser[]> {
  const { data } = await api.get<AuthUser[]>('/mechanics/nearby', { params });
  return data;
}
