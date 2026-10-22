import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, LIGHT, THEMES } from './colors';
import { makeSharedStyles } from './styles';

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';

const STORAGE_KEY = 'sarvayuh.theme';

type ThemeValue = {
  /** The mode that is actually rendered. */
  mode: ThemeMode;
  /** What the user picked: an explicit mode or `system`. */
  preference: ThemePreference;
  setMode: (mode: ThemeMode) => void;
  setPreference: (preference: ThemePreference) => void;
  toggle: () => void;
  colors: Colors;
  styles: ReturnType<typeof makeSharedStyles>;
  isDark: boolean;
  ready: boolean;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [stored, setStored] = useState<ThemeMode | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const value = await AsyncStorage.getItem(STORAGE_KEY);
        if (!active) return;
        if (value === 'light' || value === 'dark') setStored(value);
        else if (value === 'system') setPreferenceState('system');
      } catch {
        // storage unavailable – fall back to the device appearance
      }
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    if (next === 'system') setStored(null);
    else setStored(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setPreference(next);
    },
    [setPreference],
  );

  const toggle = useCallback(() => {
    setPreferenceState((p) => {
      const current = p === 'system' ? (system === 'dark' ? 'dark' : 'light') : p;
      const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
      setStored(next);
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, [system]);

  const mode: ThemeMode =
    preference === 'system' ? (stored ?? (system === 'dark' ? 'dark' : 'light')) : preference;

  const colors = THEMES[mode] ?? LIGHT;
  const styles = useMemo(() => makeSharedStyles(colors), [colors]);

  const value = useMemo<ThemeValue>(
    () => ({ mode, preference, setMode, setPreference, toggle, colors, styles, isDark: mode === 'dark', ready }),
    [mode, preference, setMode, setPreference, toggle, colors, styles, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Access the active theme. Falls back to the light palette outside the provider. */
export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  const fallback = useMemo<ThemeValue>(
    () => ({
      mode: 'light',
      preference: 'light',
      setMode: () => {},
      setPreference: () => {},
      toggle: () => {},
      colors: LIGHT,
      styles: makeSharedStyles(LIGHT),
      isDark: false,
      ready: true,
    }),
    [],
  );
  return ctx ?? fallback;
}

/** Build a style sheet from the active palette. */
export function useThemedStyles<T>(factory: (colors: Colors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}

export { LIGHT, THEMES };
export type { Colors };
export default ThemeProvider;
