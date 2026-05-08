import { api } from './apiClient';
import type { AuthUser } from './types';

export async function fetchAdminStats(): Promise<{ userCount: number; vehicleCount: number; requestCount: number; pendingCount: number }> {
  const { data } = await api.get('/admin/stats');
  return data;
}
export async function listAdminUsers(role?: string): Promise<AuthUser[]> {
  const { data } = await api.get<AuthUser[]>('/admin/users', { params: role ? { role } : undefined });
  return data;
}
export async function setAdminUserRole(id: string, role: AuthUser['role']): Promise<AuthUser> {
  const { data } = await api.patch<AuthUser>(`/admin/users/${id}`, { role });
  return data;
}

export async function fetchTowPricing(): Promise<{ towPerKmLkr: number }> {
  const { data } = await api.get<{ towPerKmLkr: number }>('/admin/pricing/tow');
  return data;
}

export async function updateTowPricing(towPerKmLkr: number): Promise<{ towPerKmLkr: number }> {
  const { data } = await api.patch<{ towPerKmLkr: number }>('/admin/pricing/tow', { towPerKmLkr });
  return data;
}
