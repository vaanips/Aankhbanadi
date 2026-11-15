import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance } from 'react-native';
import { createTheme, Theme, ThemeContextValue, ThemeMode } from './index';
import { useSettingsStore } from '../core/state/settingsStore';

const ThemeReactContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const themeModeSetting = useSettingsStore(state => state.themeMode);
  const highContrast = useSettingsStore(state => state.highContrast);
  const largeText = useSettingsStore(state => state.largeText);
  const updateSettings = useSettingsStore(state => state.update);

  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme());

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  const resolvedMode: ThemeMode = useMemo(() => {
    if (themeModeSetting === 'system') {
      return systemScheme === 'dark' ? 'dark' : 'light';
    }
    return themeModeSetting;
  }, [themeModeSetting, systemScheme]);

  const theme: Theme = useMemo(
    () => createTheme(resolvedMode, { highContrast, largeText }),
    [resolvedMode, highContrast, largeText],
  );

  const setMode = useCallback(
    (mode: ThemeMode) => {
      updateSettings({ themeMode: mode });
    },
    [updateSettings],
  );

  const value = useMemo<ThemeContextValue>(() => ({ theme, setMode }), [theme, setMode]);

  return <ThemeReactContext.Provider value={value}>{children}</ThemeReactContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeReactContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}