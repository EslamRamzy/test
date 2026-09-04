'use client';

import type { ReactNode } from 'react';
import { useReveal } from '@/hooks/useReveal';

export type RevealVariant = 'up' | 'in' | 'scale' | 'left' | 'right' | 'stagger';

interface RevealProps {
  children: ReactNode;
  /** Which named entrance animation (styles/globals.scss's Motion System) — defaults to `'up'`, the original fade-up. */
  variant?: RevealVariant | undefined;
  /** Extra classes alongside the reveal class (e.g. layout classes the caller needs on the same element). */
  className?: string | undefined;
}

const VARIANT_CLASS: Record<RevealVariant, string> = {
  up: 'reveal-up',
  in: 'reveal-in',
  scale: 'reveal-scale',
  left: 'reveal-left',
  right: 'reveal-right',
  stagger: 'reveal-stagger',
};

/**
 * Client-only wrapper so a plain Server Component section (the homepage
 * sections that use this) can still get the one-shot IntersectionObserver
 * entrance reveal (docs/architecture/06 §5, design concept §Motion System)
 * without itself becoming a client component — only this thin wrapper
 * needs the browser APIs; `children` stays server-rendered.
 *
 * `variant="stagger"` reveals the CONTAINER's `is-visible` state; each
 * direct child animates on its own delay via the `--i` custom property the
 * caller sets on it (`style={{ '--i': index }}`) — this component doesn't
 * know the list, so it can't set that itself.
 */
export function Reveal({ children, variant = 'up', className }: RevealProps) {
  const ref = useReveal<HTMLDivElement>();
  const variantClass = VARIANT_CLASS[variant];
  return (
    <div ref={ref} className={className ? `${variantClass} ${className}` : variantClass}>
      {children}
    </div>
  );
}
