import { api } from './apiClient';
import { getSocket } from './socketClient';
import { joinRequestRoom, leaveRequestRoom } from './socketClient';
import type { ServiceRequest, TowEstimate } from './types';

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
  pickupAddress?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  dropoffAddress?: string;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  bookingType?: 'on_demand' | 'scheduled';
  scheduledAt?: string;
  estimatedAmount?: number;
  finalAmount?: number;
  currency?: string;
  pricingVersion?: string;
}): Promise<ServiceRequest> {
  const { data } = await api.post<ServiceRequest>('/requests', input);
  return data;
}

export async function getTowEstimate(input: {
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  bookingType?: 'on_demand' | 'scheduled';
}): Promise<TowEstimate> {
  const { data } = await api.post<TowEstimate>('/requests/tow-estimate', input);
  return data;
}

export async function updateServiceRequest(
  id: string,
  status:
    | 'accepted'
    | 'completed'
    | 'cancelled'
    | 'driver_picked_hire'
    | 'driver_on_the_way'
    | 'driver_arrived'
    | 'vehicle_in_tow',
): Promise<ServiceRequest> {
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
    if (items.some((i) => i._id === doc._id)) {
      items = items.map((i) => (i._id === doc._id ? doc : i));
    } else {
      items = [doc, ...items];
    }
    onChange(items);
  };

  socket.on('request:new', onNew);
  socket.on('request:updated', onUpdated);

  return () => {
    socket.off('request:new', onNew);
    socket.off('request:updated', onUpdated);
  };
}

export async function subscribeRequestById(
  requestId: string,
  onChange: (item: ServiceRequest) => void,
): Promise<() => void> {
  await joinRequestRoom(requestId);
  const socket = await getSocket();
  const onUpdated = (doc: ServiceRequest) => {
    if (doc._id === requestId) onChange(doc);
  };
  socket.on('request:updated', onUpdated);
  return () => {
    socket.off('request:updated', onUpdated);
    void leaveRequestRoom(requestId);
  };
}
