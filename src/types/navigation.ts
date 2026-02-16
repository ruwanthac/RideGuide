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
  ChatAssistant: undefined;
  Assistance: undefined;
  VideoCall: undefined;
};

export type HistoryStackParamList = {
  History: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
};
