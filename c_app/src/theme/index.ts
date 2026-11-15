import {
  ThemeColors,
  ThemeMode,
  getColorsForMode,
  lightColors,
  darkColors,
} from './colors';
import { typography, scaledFontSize, LARGE_TEXT_SCALE } from './typography';
import { spacing, space } from './spacing';
import { MIN_TOUCH_TARGET, meetsMinTouchSize, contrastRatio } from './accessibility';

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  typography: typeof typography;
  spacing: typeof spacing;
  minTouchTarget: number;
  highContrast: boolean;
  largeText: boolean;
}

export interface ThemeContextValue {
  theme: Theme;
  setMode: (mode: ThemeMode) => void;
}

export function createTheme(
  mode: ThemeMode,
  options?: { highContrast?: boolean; largeText?: boolean },
): Theme {
  const highContrast = options?.highContrast ?? false;
  const largeText = options?.largeText ?? false;
  let colors = getColorsForMode(mode);

  if (highContrast) {
    colors = {
      ...colors,
      text: mode === 'dark' ? '#FFFFFF' : '#000000',
      border: mode === 'dark' ? '#F8FAFC' : '#0F172A',
      primary: mode === 'dark' ? '#93C5FD' : '#1D4ED8',
    };
  }

  return {
    mode,
    colors,
    typography,
    spacing,
    minTouchTarget: MIN_TOUCH_TARGET,
    highContrast,
    largeText,
  };
}

export type { ThemeColors, ThemeMode };

export {
  lightColors,
  darkColors,
  getColorsForMode,
  typography,
  scaledFontSize,
  LARGE_TEXT_SCALE,
  spacing,
  space,
  MIN_TOUCH_TARGET,
  meetsMinTouchSize,
  contrastRatio,
};