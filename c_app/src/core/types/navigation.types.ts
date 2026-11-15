export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Main: undefined;
  Help: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Camera: undefined;
  Ask: undefined;
  Activity: undefined;
  Settings: undefined;
};

export type AppNavigationTarget = keyof RootStackParamList | keyof MainTabParamList;