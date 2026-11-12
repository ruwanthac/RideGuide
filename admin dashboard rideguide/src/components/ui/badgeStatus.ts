export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const IN_PROGRESS = new Set(['accepted', 'attending_to_location', 'driver_picked_hire', 'driver_on_the_way', 'driver_arrived', 'vehicle_in_tow']);

export function statusToBadgeVariant(status: string): BadgeVariant {
  const s = status.toLowerCase();
  if (s === 'active' || s === 'completed' || s === 'approved') return 'success';
  if (s === 'pending' || s === 'requested') return 'warning';
  if (s === 'suspended' || s === 'cancelled' || s === 'rejected') return 'danger';
  if (IN_PROGRESS.has(s)) return 'info';
  return 'default';
}

const REQUEST_LABELS: Record<string, string> = {
  pending: 'Waiting',
  requested: 'Waiting',
  accepted: 'Accepted',
  driver_picked_hire: 'Accepted',
  attending_to_location: 'On the way',
  driver_on_the_way: 'On the way',
  driver_arrived: 'Arrived',
  vehicle_in_tow: 'Towing',
  completed: 'Done',
  cancelled: 'Cancelled',
};

/** Plain-words label for a roadside or tow request status. */
export function requestStatusLabel(status: string | undefined): string {
  if (!status) return '—';
  return REQUEST_LABELS[status] ?? status.replace(/_/g, ' ');
}
