'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Desktop-only custom cursor (design concept "Custom Cursor" — explicitly
 * scoped to desktop, never mobile, and never at the cost of performance or
 * accessibility). Three separate guards keep it out of the way whenever it
 * shouldn't run:
 *
 * 1. `(hover: hover) and (pointer: fine)` — true only for an actual mouse;
 *    false on touch, so this never mounts on mobile at all.
 * 2. `prefers-reduced-motion` — skipped the same way every other animation
 *    in this app is.
 * 3. The native cursor is only hidden (`cursor: none`, applied via a class
 *    on `<body>`) AFTER this component confirms both of the above and
 *    successfully mounts — a visitor with JS disabled, or on a device this
 *    intentionally excludes, always keeps their normal pointer.
 *
 * Position tracking is a single `mousemove` listener writing directly to
 * the DOM node's own `style.transform` — no React state per pixel, so a
 * cursor that moves every frame never triggers a re-render.
 */
export function CustomCursor(): React.JSX.Element | null {
  const [active, setActive] = useState(false);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!canHover || reducedMotion) return;

    setActive(true);
    document.body.classList.add('has-custom-cursor');

    const onMove = (event: MouseEvent) => {
      const dot = dotRef.current;
      if (dot) dot.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    };

    const onOver = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-cursor]');
      setLabel(target?.dataset.cursor ?? null);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseover', onOver, { passive: true });

    return () => {
      document.body.classList.remove('has-custom-cursor');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      ref={dotRef}
      className={`custom-cursor${label ? ' custom-cursor--label' : ''}`}
      aria-hidden="true"
    >
      {label && <span className="custom-cursor__text">{label}</span>}
    </div>
  );
}
