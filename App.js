import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ReportsProvider } from './src/context/ReportsContext';
import { initDatabase } from './src/db/database';
import { startNetworkSync, stopNetworkSync } from './src/db/sync';

import LoginScreen from './src/screens/LoginScreen';
import InspectionScreen from './src/screens/InspectionScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import SupervisorScreen from './src/screens/SupervisorScreen';

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { role } = useAuth();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      {role === null ? (
        // Authentication Flow
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{
            animationTypeForReplace: 'pop',
          }}
        />
      ) : role === 'officer' ? (
        // Field Inspection Officer Flow
        <>
          <Stack.Screen
            name="Inspection"
            component={InspectionScreen}
          />
          <Stack.Screen
            name="Results"
            component={ResultsScreen}
          />
        </>
      ) : (
        // Supervisor Review & Audit Flow
        <Stack.Screen
          name="Supervisor"
          component={SupervisorScreen}
        />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    initDatabase();
  }, []);

  useEffect(() => {
    startNetworkSync();
    return () => stopNetworkSync();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ReportsProvider>
          <NavigationContainer>
            <StatusBar style="auto" />
            <RootNavigator />
          </NavigationContainer>
        </ReportsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
