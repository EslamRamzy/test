'use client';

import type { ReactNode } from 'react';
import { useReveal } from '@/hooks/useReveal';

interface RevealProps {
  children: ReactNode;
  /** Extra classes alongside `.reveal` (e.g. layout classes the caller needs on the same element). */
  className?: string | undefined;
}

/**
 * Client-only wrapper so a plain Server Component section (the homepage
 * sections that use this) can still get the one-shot IntersectionObserver
 * entrance reveal (docs/architecture/06 §5) without itself becoming a
 * client component — only this thin wrapper needs the browser APIs;
 * `children` stays server-rendered.
 */
export function Reveal({ children, className }: RevealProps) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={className ? `reveal ${className}` : 'reveal'}>
      {children}
    </div>
  );
}
