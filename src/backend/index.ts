export type {
  UserProfileDoc,
  VehicleDoc,
  UserRole,
  ServiceRequestDoc,
  DiagnosisHistoryDoc,
} from './types';
export {
  getUserProfile,
  createUserProfile,
  updateUserProfile,
  userDocRef,
} from './userProfileService';
export {
  subscribeUserVehicles,
  addUserVehicle,
  updateUserVehicle,
  deleteUserVehicle,
} from './vehicleService';
export { formatAuthError } from './authErrors';
export {
  subscribeServiceRequests,
  deleteServiceRequest,
  type ServiceRequestRow,
} from './serviceRequestsService';
export {
  subscribeDiagnosisHistory,
  addDiagnosisHistoryEntry,
  type DiagnosisHistoryRow,
} from './diagnosisHistoryService';
