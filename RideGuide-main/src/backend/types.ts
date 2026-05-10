export type UserRole = 'owner' | 'mechanic' | 'tow' | 'admin';

export interface AuthUser {
  _id: string;
  /** Same value as `_id`; included for clients that expect `id` from the API. */
  id?: string;
  email: string;
  displayName: string;
  role: UserRole;
  selectedVehicleId: string | null;
  businessName?: string | null;
  businessAddress?: string | null;
  truckName?: string | null;
  plateNumber?: string | null;
  phoneNumber?: string | null;
  /** Mechanics only: when false, pending roadside pool is hidden and accept is blocked server-side. */
  mechanicAvailable?: boolean;
  location?: { type: 'Point'; coordinates: [number, number] } | null;
  status?: 'active' | 'suspended';
  /** Mechanic/tow pipeline; omitted or `none` for owners and legacy accounts. */
  providerVerificationStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  providerVerificationSubmittedAt?: string;
  providerVerificationReviewedAt?: string;
  /** True when account signed in with a one-time password and must set a new password. */
  mustChangePassword?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  _id: string;
  ownerId: string;
  ownerName?: string;
  label: string;
  makeModel: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  /** Registration plate / number */
  plate?: string | null;
  trim?: string | null;
  engine?: string | null;
  canonicalVehicleKey?: string | null;
  vin: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiagnosisEntry {
  _id: string;
  userId: string;
  userName?: string;
  /** Present when diagnosis was tied to a saved garage vehicle. */
  vehicleId?: string | null;
  vehicleLabel: string;
  symptoms: string;
  obdCode: string;
  diagnosis: string;
  severity: 'minor' | 'moderate' | 'critical';
  likelyCauses: string[];
  steps: string[];
  createdAt: string;
}

export interface ServiceRequest {
  _id: string;
  requesterId: string;
  type: 'roadside' | 'tow';
  status:
    | 'pending'
    | 'accepted'
    | 'attending_to_location'
    | 'requested'
    | 'driver_picked_hire'
    | 'driver_on_the_way'
    | 'driver_arrived'
    | 'vehicle_in_tow'
    | 'completed'
    | 'cancelled';
  acceptedBy: string | null;
  /** Set when a provider accepts (mechanic for roadside). */
  acceptedProviderDisplayName?: string | null;
  acceptedProviderPhone?: string | null;
  acceptedProviderLocation?: { latitude: number; longitude: number } | null;
  requesterLiveLocation?: { latitude: number; longitude: number } | null;
  vehicleId: string | null;
  userName: string;
  vehicle: string;
  issue: string;
  location: string;
  latitude: number;
  longitude: number;
  pickupAddress?: string;
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  dropoffAddress?: string;
  dropoffLatitude?: number | null;
  dropoffLongitude?: number | null;
  bookingType?: 'on_demand' | 'scheduled';
  scheduledAt?: string | null;
  estimatedAmount?: number | null;
  finalAmount?: number | null;
  currency?: string;
  pricingVersion?: string;
  paymentMethod?: 'cash_manual';
  paymentState?: 'unpaid' | 'paid_offline';
  phoneNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface TowEstimate {
  distanceKm: number;
  estimatedAmount: number;
  currency: string;
  pricingVersion: string;
  breakdown: {
    baseFee: number;
    perKm: number;
    scheduleSurcharge: number;
  };
}

export interface ChatMessage {
  _id: string;
  requestId: string;
  senderId: string;
  senderRole: UserRole;
  text: string;
  createdAt: string;
}
