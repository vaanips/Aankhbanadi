import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { BottomTabNavigator } from './BottomTabNavigator';
import { SplashScreen } from '../../features/onboarding/screens/SplashScreen';
import { OnboardingScreen } from '../../features/onboarding/screens/OnboardingScreen';
import { HelpScreen } from '../../features/onboarding/screens/HelpScreen';
import { UdidAuthScreen } from '../../features/auth/screens/UdidAuthScreen';
import { useTheme } from '../../theme/ThemeProvider';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Main" component={BottomTabNavigator} />
      <Stack.Screen
        name="UdidAuth"
        children={({ navigation }) => (
          <UdidAuthScreen onAuthenticated={() => navigation.goBack()} />
        )}
      />
      <Stack.Screen
        name="Help"
        component={HelpScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
    </Stack.Navigator>
  );
}
