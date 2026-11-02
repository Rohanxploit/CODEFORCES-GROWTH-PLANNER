import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ThemePreference } from '@cgp/shared';

interface ThemeContextValue {
  /** The user's choice, including "system". */
  preference: ThemePreference;
  /** What is actually shown. */
  theme: 'light' | 'dark';
  setTheme: (preference: ThemePreference) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'cgp-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // Storage can be unavailable (private mode).
  }
  return 'system';
}

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);
  const [osDark, setOsDark] = useState(systemDark);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setOsDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const theme: 'light' | 'dark' = preference === 'system' ? (osDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // The theme still applies for this session.
    }
  }, [theme, preference]);

  const setTheme = useCallback((p: ThemePreference) => setPreference(p), []);
  const toggleTheme = useCallback(() => setPreference(theme === 'dark' ? 'light' : 'dark'), [theme]);

  return <ThemeContext.Provider value={{ preference, theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
