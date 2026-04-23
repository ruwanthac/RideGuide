import React, { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Icon } from '../components';
import type { IconName } from '../components';
import { useResponsive } from '../hooks';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';

import {
  SplashScreen,
  LoginScreen,
  RegisterScreen,
  HomeScreen,
  DiagnoseScreen,
  ChatAssistantScreen,
  TowTruckAssistantScreen,
  HistoryScreen,
  AssistanceScreen,
  ProfileScreen,
  VideoCallScreen,
  ActivitiesScreen,
  RequestMapScreen,
  RequestChatScreen,
  AdminScreen,
  VehicleRecordsScreen,
} from '../screens';

import type { RootStackParamList, AuthStackParamList, MainTabParamList, HomeStackParamList } from '../types/navigation';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();

const HomeStackNavigator = () => (
  <HomeStack.Navigator screenOptions={{ headerShown: false }}>
    <HomeStack.Screen name="Home" component={HomeScreenWrapper} />
    <HomeStack.Screen name="Diagnose" component={DiagnoseScreenWrapper} />
    <HomeStack.Screen name="TowTruckAssistant" component={TowTruckAssistantScreenWrapper} />
    <HomeStack.Screen name="ChatAssistant" component={ChatAssistantScreenWrapper} />
    <HomeStack.Screen name="Assistance" component={AssistanceScreenWrapper} />
    <HomeStack.Screen name="VideoCall" component={VideoCallScreenWrapper} />
    <HomeStack.Screen name="RequestMap" component={RequestMapScreenWrapper} />
    <HomeStack.Screen name="RequestChat" component={RequestChatScreenWrapper} />
  </HomeStack.Navigator>
);

const HomeScreenWrapper = ({ navigation }: { navigation: any }) => (
  <HomeScreen
    onDiagnose={() => navigation.navigate('Diagnose')}
    onTowTruckAssistant={() => navigation.navigate('TowTruckAssistant')}
    onChatAssistant={() => navigation.navigate('ChatAssistant')}
    onVideoCallPress={() => navigation.navigate('VideoCall')}
  />
);

const DiagnoseScreenWrapper = ({ navigation }: { navigation: any }) => (
  <DiagnoseScreen onBack={() => navigation.goBack()} />
);

const TowTruckAssistantScreenWrapper = ({ navigation }: { navigation: any }) => (
  <TowTruckAssistantScreen onBack={() => navigation.goBack()} />
);

const ChatAssistantScreenWrapper = ({ navigation }: { navigation: any }) => (
  <ChatAssistantScreen
    onBack={() => navigation.goBack()}
    onVideoCallPress={() => navigation.navigate('VideoCall')}
  />
);

const AssistanceScreenWrapper = ({ navigation }: { navigation: any }) => (
  <AssistanceScreen onBack={() => navigation.goBack()} />
);

const VideoCallScreenWrapper = ({ navigation }: { navigation: any }) => (
  <VideoCallScreen onEndCall={() => navigation.goBack()} />
);

const RequestMapScreenWrapper = ({ navigation }: { navigation: any }) => (
  <RequestMapScreen onBack={() => navigation.goBack()} />
);

const RequestChatScreenWrapper = ({ navigation, route }: { navigation: any; route: any }) => (
  <RequestChatScreen
    onBack={() => navigation.goBack()}
    requestId={route.params?.requestId ?? ''}
    userName={route.params?.userName ?? 'Customer'}
    vehicle={route.params?.vehicle ?? ''}
    issue={route.params?.issue ?? ''}
  />
);

const AuthStackNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login">
      {(props) => (
        <LoginScreen
          {...props}
          onNavigateToRegister={() => props.navigation.navigate('Register')}
        />
      )}
    </AuthStack.Screen>
    <AuthStack.Screen name="Register">
      {(props) => (
        <RegisterScreen
          {...props}
          onNavigateToLogin={() => props.navigation.navigate('Login')}
        />
      )}
    </AuthStack.Screen>
  </AuthStack.Navigator>
);

const MainTabNavigator = () => (
  <MainTab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#2563EB',
      tabBarInactiveTintColor: '#6B7280',
      tabBarStyle: {
        backgroundColor: '#FFFFFF',
        borderTopColor: '#E5E7EB',
      },
      tabBarLabelStyle: {
        fontSize: 12,
        fontWeight: '500',
      },
    }}
  >
    <MainTab.Screen
      name="HomeTab"
      component={HomeStackNavigator}
      options={({ route }) => {
        const routeName = getFocusedRouteNameFromRoute(route) ?? 'Home';
        return {
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
          tabBarStyle: routeName === 'VideoCall' ? { display: 'none' } : undefined,
        };
      }}
    />
    <MainTab.Screen
      name="HistoryTab"
      component={HistoryStackScreen}
      options={{ tabBarLabel: 'History', tabBarIcon: ({ color }) => <TabBarIcon name="document-text" color={color} /> }}
    />
    <MainTab.Screen
      name="ProfileTab"
      options={{ tabBarLabel: 'Profile', tabBarIcon: ({ color }) => <TabBarIcon name="person" color={color} /> }}
    >
      {() => (
        <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
          <ProfileStack.Screen name="Profile" component={ProfileScreen} />
          <ProfileStack.Screen name="Activities">
            {({ navigation }) => (
              <ActivitiesScreen onBack={() => navigation.goBack()} />
            )}
          </ProfileStack.Screen>
          <ProfileStack.Screen name="Admin">
            {({ navigation }) => <AdminScreen onBack={() => navigation.goBack()} />}
          </ProfileStack.Screen>
          <ProfileStack.Screen name="VehicleRecords">
            {({ navigation, route }: { navigation: any; route: any }) => (
              <VehicleRecordsScreen
                vehicleId={route.params?.vehicleId}
                onBack={() => navigation.goBack()}
              />
            )}
          </ProfileStack.Screen>
        </ProfileStack.Navigator>
      )}
    </MainTab.Screen>
  </MainTab.Navigator>
);

const HistoryStack = createNativeStackNavigator();
const HistoryStackScreen = () => (
  <HistoryStack.Navigator screenOptions={{ headerShown: false }}>
    <HistoryStack.Screen name="History" component={HistoryScreen} />
  </HistoryStack.Navigator>
);

const ProfileStack = createNativeStackNavigator();

const TabBarIcon = ({ name, color }: { name: IconName; color: string }) => {
  const { iconSizes } = useResponsive();
  return <Icon name={name} size={iconSizes.md} color={color} />;
};

export const AppNavigator = () => {
  const [splashDone, setSplashDone] = useState(false);
  const { user, authReady } = useAuth();

  if (!splashDone) {
    return <SplashScreen onFinish={() => setSplashDone(true)} />;
  }

  if (!authReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <RootStack.Screen name="Auth">
            {() => <AuthStackNavigator />}
          </RootStack.Screen>
        ) : (
          <RootStack.Screen name="Main">
            {() => <MainTabNavigator />}
          </RootStack.Screen>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};
