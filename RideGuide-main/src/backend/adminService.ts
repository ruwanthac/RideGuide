import { api } from './apiClient';
import type { AuthUser } from './types';

export async function fetchAdminStats(): Promise<{ userCount: number; vehicleCount: number; requestCount: number; pendingCount: number }> {
  const { data } = await api.get('/admin/stats');
  return data;
}
export type Paginated<T> = { items: T[]; total: number; page: number; limit: number };

export async function listAdminUsers(role?: string): Promise<Paginated<AuthUser>> {
  const { data } = await api.get<Paginated<AuthUser>>('/admin/users', { params: role ? { role } : undefined });
  return data;
}
export async function setAdminUserRole(id: string, role: AuthUser['role']): Promise<AuthUser> {
  const { data } = await api.patch<AuthUser>(`/admin/users/${id}`, { role });
  return data;
}

export async function fetchTowPricing(): Promise<{
  towPerKmLkr: number;
  providerMatchRadiusKm: number;
  openRequestExpiryMinutes: number;
}> {
  const { data } = await api.get<{
    towPerKmLkr: number;
    providerMatchRadiusKm?: number;
    openRequestExpiryMinutes?: number;
  }>('/admin/pricing/tow');
  return {
    towPerKmLkr: data.towPerKmLkr,
    providerMatchRadiusKm:
      typeof data.providerMatchRadiusKm === 'number' && data.providerMatchRadiusKm >= 1
        ? data.providerMatchRadiusKm
        : 15,
    openRequestExpiryMinutes:
      typeof data.openRequestExpiryMinutes === 'number' && data.openRequestExpiryMinutes >= 1
        ? data.openRequestExpiryMinutes
        : 30,
  };
}

export async function updateTowPricing(input: {
  towPerKmLkr: number;
  providerMatchRadiusKm: number;
  openRequestExpiryMinutes: number;
}): Promise<{ towPerKmLkr: number; providerMatchRadiusKm: number; openRequestExpiryMinutes: number }> {
  const { data } = await api.patch<{
    towPerKmLkr: number;
    providerMatchRadiusKm: number;
    openRequestExpiryMinutes: number;
  }>('/admin/pricing/tow', input);
  return data;
}
