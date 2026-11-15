import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomTabNavigator } from './BottomTabNavigator';
import { HelpScreen } from '../../features/help/screens/HelpScreen';
import { OnboardingScreen } from '../../features/onboarding/screens/OnboardingScreen';
import type { RootStackParamList } from './types';
import { useAppStore } from '../../core/state/appStore';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const onboardingComplete = useAppStore(state => state.onboardingComplete);
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={onboardingComplete ? 'Tabs' : 'Onboarding'}
        screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={BottomTabNavigator} />
        <Stack.Screen name="Help" component={HelpScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
