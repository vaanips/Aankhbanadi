import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from './types';
import { HomeScreen } from '../../features/home/screens/HomeScreen';
import { CameraAssistanceScreen } from '../../features/camera/screens/CameraAssistanceScreen';
import { AskDrishtiScreen } from '../../features/ask-drishti/screens/AskDrishtiScreen';
import { ActivityScreen } from '../../features/activity/screens/ActivityScreen';
import { SettingsScreen } from '../../features/settings/screens/SettingsScreen';
import { useTheme } from '../../theme/ThemeProvider';

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ symbol, color }: { symbol: string; color: string }): React.JSX.Element {
  return (
    <Text style={{ fontSize: 22, color }} accessibilityElementsHidden importantForAccessibility="no">
      {symbol}
    </Text>
  );
}

export function BottomTabNavigator(): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.tabBarActive,
        tabBarInactiveTintColor: theme.colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: {
          fontSize: theme.largeText ? 13 : 12,
          fontWeight: '600',
        },
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
          tabBarIcon: ({ color }) => <TabIcon symbol="⌂" color={color} />,
        }}
      />
      <Tab.Screen
        name="Camera"
        component={CameraAssistanceScreen}
        options={{
          tabBarLabel: 'Camera',
          tabBarAccessibilityLabel: 'Camera tab',
          tabBarIcon: ({ color }) => <TabIcon symbol="📷" color={color} />,
        }}
      />
      <Tab.Screen
        name="Ask"
        component={AskDrishtiScreen}
        options={{
          tabBarLabel: 'Ask',
          tabBarAccessibilityLabel: 'Ask tab, voice questions',
          tabBarIcon: ({ color }) => <TabIcon symbol="🎤" color={color} />,
        }}
      />
      <Tab.Screen
        name="Activity"
        component={ActivityScreen}
        options={{
          tabBarLabel: 'Activity',
          tabBarAccessibilityLabel: 'Activity tab',
          tabBarIcon: ({ color }) => <TabIcon symbol="☰" color={color} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarAccessibilityLabel: 'Settings tab',
          tabBarIcon: ({ color }) => <TabIcon symbol="⚙" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}