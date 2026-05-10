/** Matches backend `SERVICE_STATUSES` in admin.service / ServiceRequest model. */
export const SERVICE_REQUEST_STATUSES = [
  'pending',
  'accepted',
  'attending_to_location',
  'requested',
  'driver_picked_hire',
  'driver_on_the_way',
  'driver_arrived',
  'vehicle_in_tow',
  'completed',
  'cancelled',
] as const;

export type ServiceRequestStatusValue = (typeof SERVICE_REQUEST_STATUSES)[number];
