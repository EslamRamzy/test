'use client';

import type { SocialLinkDto } from '@portfolio/shared';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

/**
 * `docs/architecture/06 §7`: "one client island... code-split with
 * `next/dynamic({ ssr: false })` so it costs nothing on first paint." The
 * split has to happen at the ELEMENT level, not just the `show` prop: the
 * dynamic import fires the first time React actually renders
 * `<CommandPalette>`, so `everOpened` gates rendering the element at all —
 * this launcher stays a plain `keydown` listener (no palette code, no
 * `react-bootstrap` `Modal`) until the very first `⌘K`/`Ctrl+K`. After that
 * first press the element stays mounted and `show` just toggles its
 * visibility, the same way every other modal in this codebase works.
 */
const CommandPalette = dynamic(
  () => import('./CommandPalette').then((module) => module.CommandPalette),
  { ssr: false },
);

export function CommandPaletteLauncher({
  socialLinks,
}: {
  socialLinks: SocialLinkDto[];
}): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isShortcut) return;
      event.preventDefault();
      setEverOpened(true);
      setOpen((current) => !current);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!everOpened) return null;

  return <CommandPalette show={open} onClose={() => setOpen(false)} socialLinks={socialLinks} />;
}
