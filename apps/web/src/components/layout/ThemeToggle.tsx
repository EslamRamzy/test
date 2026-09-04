'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';

/**
 * The theme value itself is only known once mounted on the client (see
 * `useTheme.ts`) — rendering a neutral, icon-less placeholder until then
 * keeps the server-rendered and first-client-rendered markup identical, so
 * there is no hydration mismatch to suppress.
 */
export function ThemeToggle(): React.JSX.Element {
  const [mounted, setMounted] = useState(false);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        aria-label="Toggle theme"
        disabled
      >
        <span className="bi bi-circle-half" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-secondary"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <span className={theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars'} aria-hidden="true" />
    </button>
  );
}
