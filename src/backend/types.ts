import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'owner' | 'mechanic' | 'tow';

/** Stored at `users/{uid}` */
export type UserProfileDoc = {
  displayName: string;
  email: string;
  role: UserRole;
  selectedVehicleId: string | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

/** Stored at `users/{uid}/vehicles/{vehicleId}` */
export type VehicleDoc = {
  label: string;
  makeModel: string;
  vin: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

/** Root collection `serviceRequests` — roadside & tow queue */
export type ServiceRequestDoc = {
  type: 'roadside' | 'tow';
  userName: string;
  location: string;
  issue: string;
  vehicle: string;
  phoneNumber: string;
  latitude: number;
  longitude: number;
  createdAt: Timestamp | null;
};

/** `users/{uid}/diagnosisHistory` */
export type DiagnosisHistoryDoc = {
  vehicleId: string;
  vehicleLabel: string;
  symptoms: string;
  obdCode: string;
  diagnosis: string;
  createdAt: Timestamp | null;
};
