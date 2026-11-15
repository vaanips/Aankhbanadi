export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  primary: string;
  primaryMuted: string;
  navy: string;
  white: string;
  success: string;
  warning: string;
  danger: string;
  secondary: string;
  border: string;
  overlay: string;
  inputBackground: string;
  tabBar: string;
  tabBarActive: string;
  tabBarInactive: string;
}

const shared = {
  navy: '#101B2D',
  primary: '#2563EB',
  white: '#FFFFFF',
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#DC2626',
  secondary: '#64748B',
} as const;

export const lightColors: ThemeColors = {
  ...shared,
  background: '#F5F7FA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: '#101B2D',
  textSecondary: '#64748B',
  primaryMuted: '#93C5FD',
  border: '#E2E8F0',
  overlay: 'rgba(16, 27, 45, 0.45)',
  inputBackground: '#F1F5F9',
  tabBar: '#FFFFFF',
  tabBarActive: '#2563EB',
  tabBarInactive: '#94A3B8',
};

export const darkColors: ThemeColors = {
  ...shared,
  background: '#0B1220',
  surface: '#101B2D',
  card: '#162033',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  primaryMuted: '#1D4ED8',
  border: '#1E293B',
  overlay: 'rgba(0, 0, 0, 0.6)',
  inputBackground: '#1E293B',
  tabBar: '#101B2D',
  tabBarActive: '#60A5FA',
  tabBarInactive: '#64748B',
};

export function getColorsForMode(mode: ThemeMode): ThemeColors {
  return mode === 'dark' ? darkColors : lightColors;
}