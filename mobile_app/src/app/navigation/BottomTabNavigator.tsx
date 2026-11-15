import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../../features/home/screens/HomeScreen';
import { CameraScreen } from '../../features/camera/screens/CameraScreen';
import { AskScreen } from '../../features/ask-drishti/screens/AskScreen';
import { ActivityScreen } from '../../features/activity/screens/ActivityScreen';
import { SettingsScreen } from '../../features/settings/screens/SettingsScreen';
import type { TabParamList } from './types';
import { colors } from '../../theme/colors';

const Tab = createBottomTabNavigator<TabParamList>();

export function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.secondaryText,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        tabBarStyle: {
          minHeight: 68,
          paddingTop: 8,
          paddingBottom: 8,
          borderTopColor: colors.border,
        },
        tabBarAccessibilityLabel: `${route.name} tab`,
      })}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Camera" component={CameraScreen} options={{ tabBarLabel: 'Camera' }} />
      <Tab.Screen name="Ask" component={AskScreen} options={{ tabBarLabel: 'Ask Drishti' }} />
      <Tab.Screen name="Activity" component={ActivityScreen} options={{ tabBarLabel: 'Activity' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Settings' }} />
    </Tab.Navigator>
  );
}
