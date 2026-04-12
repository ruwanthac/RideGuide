import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './src/firebase/config';
import { AuthProvider } from './src/context/AuthContext';
import { UserRoleProvider } from './src/context/UserRoleContext';
import { VehiclesProvider } from './src/context/VehiclesContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <UserRoleProvider>
          <VehiclesProvider>
            <StatusBar style="auto" />
            <AppNavigator />
          </VehiclesProvider>
        </UserRoleProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
