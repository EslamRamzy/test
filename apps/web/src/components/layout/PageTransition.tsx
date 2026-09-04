'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Light fade + small vertical move on every route change (design concept
 * "Page Transitions") — `key={pathname}` is what makes this work: React
 * unmounts and remounts the wrapper on a new route, and a freshly-mounted
 * element always restarts its CSS `animation` from the top, no JS
 * animation library or transition-group needed. `.page-transition`'s own
 * `prefers-reduced-motion` guard (styles/_components.scss) covers this the
 * same way as every other animation in the app.
 */
export function PageTransition({ children }: { children: ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-transition">
      {children}
    </div>
  );
}
