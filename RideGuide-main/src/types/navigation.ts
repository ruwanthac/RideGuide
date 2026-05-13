import type { NavigatorScreenParams } from '@react-navigation/native';
import type { DiagnosisEntry } from '../backend/types';

export type RootStackParamList = {
  Splash: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  HistoryTab: NavigatorScreenParams<HistoryStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

export type HomeStackParamList = {
  Home: undefined;
  Diagnose: undefined;
  TowTruckAssistant: undefined;
  TowOwnerTracking: { requestId: string };
  RoadsideOwnerTracking: { requestId: string };
  TowDriverActiveJob: { requestId: string };
  MechanicActiveJob: { requestId: string };
  ChatAssistant: { sessionId?: string } | undefined;
  Assistance: undefined;
  VideoCall: { priorConversationSummary?: string; vehicleId?: string } | undefined;
  RequestMap: {
    location: string;
    latitude: number;
    longitude: number;
    /** Mechanic/tow: show route from your position to the owner pin. */
    previewRouteToOwner?: boolean;
    /** Owner / pickup pin (prefer `requesterLiveLocation` when the app sends it). */
    ownerLatitude?: number;
    ownerLongitude?: number;
    customerName?: string;
  };
  RequestChat: { requestId: string; userName: string; vehicle: string; issue: string };
};

export type HistoryStackParamList = {
  History: undefined;
  TowJobHistory: undefined;
  RoadsideHelpHistory: undefined;
  VehicleRecordsHistory: undefined;
  ObdDiagnoseHistory: undefined;
  AiChatHistory: undefined;
  DiagnosisHistoryDetail: { entry: DiagnosisEntry };
  AiVideoHistoryDetail: { id: string };
  AssistantHistoryDetail: { id: string };
};

export type ProfileStackParamList = {
  Profile: undefined;
  Privacy: undefined;
  Activities: undefined;
  Admin: undefined;
  VehicleRecords: { vehicleId: string };
};
