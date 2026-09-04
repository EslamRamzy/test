'use client';

import { useEffect, useRef } from 'react';

/**
 * One-shot entrance reveal (docs/architecture/06 §5: "Entrance animations
 * are one-shot IntersectionObserver reveals, never looping"). Returns a ref
 * to attach to the element carrying the `.reveal` class (see
 * `styles/globals.scss`) — once it scrolls into view, `.is-visible` is
 * added and the observer disconnects, so it never re-fires.
 *
 * Skips entirely when `IntersectionObserver` is unavailable (very old
 * browsers) or the user has `prefers-reduced-motion` set — in both cases
 * `.is-visible` is added immediately so content isn't stuck invisible.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion) {
      el.classList.add('is-visible');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add('is-visible');
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return ref;
}
