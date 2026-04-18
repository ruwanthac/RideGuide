export type UserRole = 'owner' | 'mechanic' | 'tow' | 'admin';

export interface AuthUser {
  _id: string;
  email: string;
  displayName: string;
  role: UserRole;
  selectedVehicleId: string | null;
  businessName?: string | null;
  businessAddress?: string | null;
  truckName?: string | null;
  plateNumber?: string | null;
  phoneNumber?: string | null;
  location?: { type: 'Point'; coordinates: [number, number] } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  _id: string;
  ownerId: string;
  label: string;
  makeModel: string;
  vin: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiagnosisEntry {
  _id: string;
  userId: string;
  vehicleId: string;
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
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  acceptedBy: string | null;
  vehicleId: string | null;
  userName: string;
  vehicle: string;
  issue: string;
  location: string;
  latitude: number;
  longitude: number;
  phoneNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  _id: string;
  requestId: string;
  senderId: string;
  senderRole: UserRole;
  text: string;
  createdAt: string;
}
