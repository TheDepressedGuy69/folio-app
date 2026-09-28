import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Settings } from '../lib/types';
import { DEFAULT_SETTINGS } from '../lib/types';
import { getSettings, setSettings as persistSettings } from '../lib/db';

interface SettingsContextValue {
  settings: Settings;
  loaded: boolean;
  update: (patch: Partial<Settings>) => void;
  resolvedAppTheme: 'light' | 'dark';
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function useSystemPrefersDark() {
  const [prefersDark, setPrefersDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return prefersDark;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const prefersDark = useSystemPrefersDark();

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setLoaded(true);
    });
  }, []);

  const resolvedAppTheme: 'light' | 'dark' =
    settings.appTheme === 'system' ? (prefersDark ? 'dark' : 'light') : settings.appTheme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedAppTheme);
  }, [resolvedAppTheme]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persistSettings(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ settings, loaded, update, resolvedAppTheme }),
    [settings, loaded, resolvedAppTheme, update],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
