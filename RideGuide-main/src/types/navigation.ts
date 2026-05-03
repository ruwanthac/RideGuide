import type { NavigatorScreenParams } from '@react-navigation/native';

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
  TowDriverActiveJob: { requestId: string };
  ChatAssistant: undefined;
  Assistance: undefined;
  VideoCall: undefined;
  RequestMap: { location: string; latitude: number; longitude: number };
  RequestChat: { requestId: string; userName: string; vehicle: string; issue: string };
};

export type HistoryStackParamList = {
  History: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
  Privacy: undefined;
  Activities: undefined;
  Admin: undefined;
  VehicleRecords: { vehicleId: string };
};
