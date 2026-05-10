import type { AdminUser, UserStatus, Vehicle, ServiceRequestRow, Activity, ChartDataPoint } from '../types';

const active: UserStatus = 'active';
const suspended: UserStatus = 'suspended';

export const mockUsers: AdminUser[] = [
  {
    _id: '1',
    id: '1',
    displayName: 'Kamal Perera',
    email: 'kamal@example.com',
    role: 'owner',
    status: active,
    phoneNumber: '+94771234567',
    joinedAt: '2024-01-15',
  },
  {
    _id: '2',
    id: '2',
    displayName: 'Nimal Silva',
    email: 'nimal@example.com',
    role: 'mechanic',
    status: active,
    phoneNumber: '+94772345678',
    mechanicAvailable: true,
    joinedAt: '2024-02-20',
  },
  {
    _id: '3',
    id: '3',
    displayName: 'Sunil Fernando',
    email: 'sunil@example.com',
    role: 'tow',
    status: active,
    phoneNumber: '+94773456789',
    businessName: 'Tow Co',
    joinedAt: '2024-03-01',
  },
  {
    _id: '4',
    id: '4',
    displayName: 'Anura Wijesinghe',
    email: 'anura@example.com',
    role: 'owner',
    status: suspended,
    phoneNumber: '',
    joinedAt: '2024-01-10',
  },
  {
    _id: '5',
    id: '5',
    displayName: 'Chaminda Bandara',
    email: 'chaminda@example.com',
    role: 'mechanic',
    status: active,
    phoneNumber: '',
    joinedAt: '2024-02-28',
  },
  {
    _id: '6',
    id: '6',
    displayName: 'Dilshan Jayasinghe',
    email: 'dilshan@example.com',
    role: 'tow',
    status: active,
    phoneNumber: '',
    joinedAt: '2024-03-05',
  },
];

export const mockVehicles: Vehicle[] = [
  { id: 'v1', ownerId: '1', ownerName: 'Kamal Perera', make: 'Toyota', model: 'Corolla', year: 2020, vin: '1HGBH41JXMN109186', plate: 'CAB-1234' },
  { id: 'v2', ownerId: '1', ownerName: 'Kamal Perera', make: 'Honda', model: 'Civic', year: 2019, vin: '2HGFG3B54CH501234', plate: 'CAB-5678' },
  { id: 'v3', ownerId: '4', ownerName: 'Anura Wijesinghe', make: 'Nissan', model: 'Sunny', year: 2018, vin: '3N1CN7AP8KL567890', plate: 'WP-9012' },
  { id: 'v4', ownerId: '1', ownerName: 'Kamal Perera', make: 'Suzuki', model: 'Alto', year: 2022, vin: '4S3BMHB68B3123456', plate: 'CAB-9999' },
];

export const mockRequests: ServiceRequestRow[] = [
  {
    id: 'r1',
    type: 'roadside',
    status: 'completed',
    userId: '1',
    userName: 'Kamal Perera',
    vehicleId: 'v1',
    vehicle: 'Toyota Corolla',
    location: 'Colombo 7',
    description: 'Flat tire',
    issue: 'Flat tire',
    createdAt: '2025-03-05T08:00:00',
    updatedAt: '2025-03-05T09:30:00',
    assignedTo: 'Nimal Silva',
  },
  {
    id: 'r2',
    type: 'tow',
    status: 'accepted',
    userId: '4',
    userName: 'Anura Wijesinghe',
    vehicleId: 'v3',
    vehicle: 'Nissan Sunny',
    location: 'Kandy Road',
    description: 'Engine failure',
    issue: 'Engine failure',
    createdAt: '2025-03-05T10:15:00',
    updatedAt: '2025-03-05T10:45:00',
    assignedTo: 'Sunil Fernando',
  },
  {
    id: 'r4',
    type: 'roadside',
    status: 'pending',
    userId: '1',
    userName: 'Kamal Perera',
    location: 'Galle Face',
    description: 'Battery jump',
    issue: 'Battery jump',
    createdAt: '2025-03-05T12:00:00',
    updatedAt: '2025-03-05T12:00:00',
  },
  {
    id: 'r5',
    type: 'tow',
    status: 'cancelled',
    userId: '4',
    userName: 'Anura Wijesinghe',
    vehicleId: 'v3',
    vehicle: 'Nissan Sunny',
    createdAt: '2025-03-04T14:00:00',
    updatedAt: '2025-03-04T15:00:00',
  },
];

export const mockActivities: Activity[] = [
  { id: 'a1', type: 'request', description: 'New roadside request from Kamal Perera', user: 'Kamal Perera', timestamp: '2025-03-05T12:00:00' },
  { id: 'a2', type: 'request', description: 'Tow request created', user: 'Kamal Perera', timestamp: '2025-03-05T11:00:00' },
  { id: 'a3', type: 'request', description: 'Tow request accepted by Sunil Fernando', user: 'Anura Wijesinghe', timestamp: '2025-03-05T10:45:00' },
  { id: 'a4', type: 'request', description: 'Roadside request completed', user: 'Kamal Perera', timestamp: '2025-03-05T09:30:00' },
  { id: 'a5', type: 'user', description: 'New mechanic registered', user: 'Chaminda Bandara', timestamp: '2025-03-04T16:00:00' },
];

export const requestsLast7Days: ChartDataPoint[] = [
  { name: 'Mon', requests: 12 },
  { name: 'Tue', requests: 19 },
  { name: 'Wed', requests: 15 },
  { name: 'Thu', requests: 22 },
  { name: 'Fri', requests: 28 },
  { name: 'Sat', requests: 35 },
  { name: 'Sun', requests: 24 },
];

export const requestDistribution: ChartDataPoint[] = [
  { name: 'Diagnosis records', value: 35 },
  { name: 'Roadside', value: 45 },
  { name: 'Tow', value: 20 },
];

export const monthlyRevenue: ChartDataPoint[] = [
  { name: 'Sep', revenue: 125000 },
  { name: 'Oct', revenue: 142000 },
  { name: 'Nov', revenue: 138000 },
  { name: 'Dec', revenue: 165000 },
  { name: 'Jan', revenue: 178000 },
  { name: 'Feb', revenue: 192000 },
  { name: 'Mar', revenue: 205000 },
];

export const jobsCompletedMonthly: ChartDataPoint[] = [
  { name: 'Sep', jobs: 89 },
  { name: 'Oct', jobs: 102 },
  { name: 'Nov', jobs: 95 },
  { name: 'Dec', jobs: 118 },
  { name: 'Jan', jobs: 124 },
  { name: 'Feb', jobs: 131 },
  { name: 'Mar', jobs: 142 },
];

export const avgResponseTimeData: ChartDataPoint[] = [
  { name: 'Sep', minutes: 28 },
  { name: 'Oct', minutes: 25 },
  { name: 'Nov', minutes: 24 },
  { name: 'Dec', minutes: 22 },
  { name: 'Jan', minutes: 21 },
  { name: 'Feb', minutes: 19 },
  { name: 'Mar', minutes: 18 },
];

export const totalUsers = 1247;
export const activeMechanics = 48;
export const activeTowDrivers = 32;
export const totalRequestsToday = 24;
