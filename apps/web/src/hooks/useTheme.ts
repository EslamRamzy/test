'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Theme state (docs/architecture/06 §5): `data-theme` on `<html>`,
 * persisted in `localStorage`, defaulting to `prefers-color-scheme`. The
 * actual flash-avoidance is a separate blocking inline script in
 * `layout.tsx` that runs before first paint — this hook only needs to stay
 * in sync with whatever that script (or a previous toggle) already set,
 * never to set the attribute for the first time itself.
 */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function readSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// A 'use client' component's initial render still runs once on the server
// (to produce the HTML React hydrates against) — `document` genuinely does
// not exist there. `ThemeToggle` never displays this SSR-time value (it
// renders a neutral placeholder until mounted), but the hook itself must
// still not crash while producing it.
function readCurrentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'light' || attr === 'dark' ? attr : readSystemTheme();
}

export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void; toggle: () => void } {
  // Only ever read on the client (this hook is only ever called from a
  // 'use client' component whose caller renders a neutral placeholder
  // until mounted — see ThemeToggle.tsx) so there is nothing to reconcile
  // against a server-rendered value here.
  const [theme, setThemeState] = useState<Theme>(readCurrentTheme);

  useEffect(() => {
    // Stay in sync with the OS theme changing live, but ONLY while the
    // visitor has never made an explicit choice — an explicit choice must
    // never be silently overridden by the system switching underneath it.
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage unavailable (private mode) — treat as "no explicit choice."
    }
    if (stored === 'light' || stored === 'dark') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setThemeState(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable — the choice still applies for this page load.
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
}
