import { api } from './apiClient';
import { getSocket } from './socketClient';
import type { ServiceRequest } from './types';

export async function listServiceRequests(params?: { vehicleId?: string }): Promise<ServiceRequest[]> {
  const { data } = await api.get<ServiceRequest[]>('/requests', { params });
  return data;
}

export async function createServiceRequest(input: {
  type: 'roadside' | 'tow';
  vehicle: string;
  issue: string;
  location: string;
  latitude: number;
  longitude: number;
  phoneNumber: string;
  vehicleId?: string;
}): Promise<ServiceRequest> {
  const { data } = await api.post<ServiceRequest>('/requests', input);
  return data;
}

export async function updateServiceRequest(id: string, status: 'accepted' | 'completed' | 'cancelled'): Promise<ServiceRequest> {
  const { data } = await api.patch<ServiceRequest>(`/requests/${id}`, { status });
  return data;
}

export async function deleteServiceRequest(id: string): Promise<void> {
  await api.delete(`/requests/${id}`);
}

export async function subscribeServiceRequests(
  onChange: (items: ServiceRequest[]) => void,
  filter?: { vehicleId?: string },
): Promise<() => void> {
  let items = await listServiceRequests(filter);
  onChange(items);
  const socket = await getSocket();

  const matches = (doc: ServiceRequest) =>
    !filter?.vehicleId || doc.vehicleId === filter.vehicleId;

  const onNew = (doc: ServiceRequest) => {
    if (!matches(doc)) return;
    items = [doc, ...items];
    onChange(items);
  };
  const onUpdated = (doc: ServiceRequest) => {
    if (!matches(doc)) {
      // item might have been for our vehicle before — drop if present
      if (items.some(i => i._id === doc._id)) {
        items = items.filter(i => i._id !== doc._id);
        onChange(items);
      }
      return;
    }
    items = items.map((i) => (i._id === doc._id ? doc : i));
    onChange(items);
  };

  socket.on('request:new', onNew);
  socket.on('request:updated', onUpdated);

  return () => {
    socket.off('request:new', onNew);
    socket.off('request:updated', onUpdated);
  };
}
