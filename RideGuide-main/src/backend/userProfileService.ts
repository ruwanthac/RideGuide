import { api } from './apiClient';
import type { AuthUser } from './types';

export async function updateUserProfile(patch: Partial<Pick<AuthUser,
  'displayName' | 'selectedVehicleId' | 'businessName' | 'businessAddress' |
  'truckName' | 'plateNumber' | 'phoneNumber'
>> & { location?: { lat: number; lng: number } | null }): Promise<AuthUser> {
  const { data } = await api.patch<AuthUser>('/users/me', patch);
  return data;
}
