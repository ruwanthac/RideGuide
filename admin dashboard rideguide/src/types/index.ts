export type UserRole = 'owner' | 'mechanic' | 'tow' | 'admin';
export type UserStatus = 'active' | 'suspended';

export type ProviderVerificationFileField =
  | 'mechanicBrCopy'
  | 'mechanicNicCopy'
  | 'towCompanyBrCopy'
  | 'towCompanyNicCopy'
  | 'towTruckRegCopy'
  | 'towTruckNicCopy';

export type ServiceRequestType = 'roadside' | 'tow';
/** ServiceRequest statuses include roadside + full tow pipeline (see API model). */
export type RequestStatus = string;

/** Admin users list item (`GET /admin/users`). */
export interface AdminUser {
  _id: string;
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status?: UserStatus;
  phoneNumber?: string | null;
  mechanicAvailable?: boolean;
  businessName?: string;
  businessAddress?: string;
  truckName?: string;
  plateNumber?: string;
  joinedAt: string;
  providerVerificationStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  providerVerificationSubmittedAt?: string;
  providerVerificationReviewedAt?: string;
}

/** `GET /admin/users/:id` — includes verification file keys for admins. */
export interface AdminUserDetail extends AdminUser {
  providerVerification?: Partial<Record<ProviderVerificationFileField, string>>;
}

export interface VehicleOwner {
  _id: string;
  id: string;
  email?: string;
  displayName?: string;
  phoneNumber?: string;
  role?: string;
}

export interface Vehicle {
  id?: string;
  _id?: string;
  ownerId: string | VehicleOwner;
  ownerName: string;
  makeModel?: string;
  label?: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  plate?: string;
}

export interface ServiceRequestRow {
  id?: string;
  _id?: string;
  type: ServiceRequestType;
  status: RequestStatus;
  requesterId?: string;
  userId?: string;
  userName: string;
  vehicleId?: string;
  vehicle?: string;
  location?: string;
  description?: string;
  issue?: string;
  createdAt: string;
  updatedAt?: string;
  /** Mechanic/tow display name when accepted */
  acceptedProviderDisplayName?: string | null;
  assignedTo?: string;
}

export interface Activity {
  id: string;
  type: string;
  description: string;
  user?: string;
  timestamp: string;
}

export interface ChartDataPoint {
  name: string;
  value?: number;
  [key: string]: string | number | undefined;
}
