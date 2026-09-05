'use client';

import type { SearchResultDto, SocialLinkDto } from '@portfolio/shared';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { searchContent } from '@/lib/api/client';
import { useTheme } from '@/hooks/useTheme';

/**
 * The command palette's dialog content (docs/architecture/06 §7/§39). Always
 * the DYNAMICALLY-IMPORTED half of the feature — `CommandPaletteLauncher.tsx`
 * is the tiny always-mounted piece that decides WHEN this ever gets loaded
 * at all. `<Modal>` (react-bootstrap, same primitive `ConfirmDialog` already
 * uses) supplies `role="dialog"`/`aria-modal="true"`, the focus trap, `Esc`
 * closing, and focus restored to the trigger on close — all "for free," so
 * everything built here is the parts that aren't: the flat, keyboard-
 * navigable command list and the debounced live search.
 */

export interface CommandPaletteProps {
  show: boolean;
  onClose: () => void;
  socialLinks: SocialLinkDto[];
}

interface PaletteItem {
  key: string;
  icon: string;
  label: string;
  sublabel?: string;
  kind: 'nav' | 'external' | 'theme' | 'result';
  href?: string | undefined;
  externalUrl?: string;
  onActivate?: () => void;
}

interface NavAction {
  label: string;
  href: string;
  icon: string;
}

/** Exactly doc06 §39's own list, in its own order — a superset of `Header`'s
 * visible nav (which reaches Contact via the separate "Let's Talk" CTA, not
 * a nav link) because the palette is the one place every one of these is a
 * first-class, equally-weighted destination. */
const NAV_ACTIONS: NavAction[] = [
  { label: 'About', href: '/about', icon: 'bi-person' },
  { label: 'Projects', href: '/projects', icon: 'bi-kanban' },
  { label: 'Articles', href: '/articles', icon: 'bi-file-text' },
  { label: 'Security', href: '/security', icon: 'bi-shield-lock' },
  { label: 'Certifications', href: '/certifications', icon: 'bi-patch-check' },
  { label: 'Experience', href: '/experience', icon: 'bi-briefcase' },
  { label: 'Contact', href: '/contact', icon: 'bi-envelope' },
];

const RESULT_GROUP_ORDER: SearchResultDto['entityType'][] = [
  'PROJECT',
  'ARTICLE',
  'RESEARCH',
  'TECHNOLOGY',
];
const RESULT_GROUP_LABEL: Record<SearchResultDto['entityType'], string> = {
  PROJECT: 'Projects',
  ARTICLE: 'Articles',
  RESEARCH: 'Security Research',
  TECHNOLOGY: 'Technologies',
};
const RESULT_ICON: Record<SearchResultDto['entityType'], string> = {
  PROJECT: 'bi-kanban',
  ARTICLE: 'bi-file-text',
  RESEARCH: 'bi-shield-lock',
  TECHNOLOGY: 'bi-cpu',
};
/** Technologies have no dedicated detail page (same map `/search`'s own page uses) — that result renders, but isn't a link. */
const RESULT_ENTITY_PATH: Record<SearchResultDto['entityType'], string | null> = {
  PROJECT: '/projects',
  ARTICLE: '/articles',
  RESEARCH: '/security',
  TECHNOLOGY: null,
};

const DEBOUNCE_MS = 250;
const SEARCH_MIN_LENGTH = 2;
const SEARCH_LIMIT = 8;

export function CommandPalette({
  show,
  onClose,
  socialLinks,
}: CommandPaletteProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResultDto[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const { theme, toggle } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

  // A fresh session every time it opens — a query or selection left over
  // from the last time this was open must never carry into the next.
  useEffect(() => {
    if (show) {
      setQuery('');
      setDebouncedQuery('');
      setResults([]);
      setActiveIndex(0);
    }
  }, [show]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.length < SEARCH_MIN_LENGTH) {
      setResults([]);
      return;
    }
    let cancelled = false;
    searchContent(debouncedQuery, SEARCH_LIMIT)
      .then((data) => {
        if (!cancelled) setResults(data);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const normalizedQuery = query.trim().toLowerCase();

  const navItems: PaletteItem[] = NAV_ACTIONS.filter(
    (action) => !normalizedQuery || action.label.toLowerCase().includes(normalizedQuery),
  ).map((action) => ({
    key: `nav-${action.href}`,
    icon: action.icon,
    label: action.label,
    kind: 'nav',
    href: action.href,
  }));

  const externalItems: PaletteItem[] = socialLinks
    .map((link) => ({ link, label: link.label ?? link.platform }))
    .filter(({ label }) => !normalizedQuery || label.toLowerCase().includes(normalizedQuery))
    .map(({ link, label }) => ({
      key: `external-${String(link.id)}`,
      icon: link.icon ?? 'bi bi-link-45deg',
      label,
      kind: 'external' as const,
      externalUrl: link.url,
    }));

  const themeLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  const themeItems: PaletteItem[] =
    !normalizedQuery || themeLabel.toLowerCase().includes(normalizedQuery)
      ? [
          {
            key: 'theme-toggle',
            icon: theme === 'dark' ? 'bi-sun' : 'bi-moon-stars',
            label: themeLabel,
            kind: 'theme',
            onActivate: toggle,
          },
        ]
      : [];

  const resultSections = RESULT_GROUP_ORDER.map((entityType) => ({
    label: RESULT_GROUP_LABEL[entityType],
    items: results
      .filter((result) => result.entityType === entityType)
      .map((result): PaletteItem => ({
        key: `result-${result.entityType}-${String(result.entityId)}`,
        icon: RESULT_ICON[result.entityType],
        label: result.title,
        sublabel: result.snippet,
        kind: 'result',
        href: RESULT_ENTITY_PATH[result.entityType]
          ? `${RESULT_ENTITY_PATH[result.entityType]}/${result.slug}`
          : undefined,
      })),
  })).filter((section) => section.items.length > 0);

  const sections = [
    ...(navItems.length ? [{ label: 'Navigate', items: navItems }] : []),
    ...(externalItems.length || themeItems.length
      ? [{ label: 'More', items: [...externalItems, ...themeItems] }]
      : []),
    ...resultSections,
  ];

  // One running counter across every section — index N always refers to the
  // same command regardless of which group it renders in, so arrow keys can
  // treat the whole palette as a single flat list.
  let runningIndex = 0;
  const indexedSections = sections.map((section) => ({
    label: section.label,
    items: section.items.map((item) => ({ ...item, index: runningIndex++ })),
  }));
  const totalItems = runningIndex;

  useEffect(() => {
    itemRefs.current.length = totalItems;
    setActiveIndex((current) => Math.min(current, Math.max(totalItems - 1, 0)));
  }, [totalItems]);

  function setItemRef(index: number) {
    return (el: HTMLElement | null) => {
      itemRefs.current[index] = el;
    };
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (totalItems === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % totalItems);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + totalItems) % totalItems);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      itemRefs.current[activeIndex]?.click();
    }
  }

  function renderItem(item: PaletteItem & { index: number }): React.JSX.Element {
    const isActive = item.index === activeIndex;
    const className = `command-palette__item${isActive ? ' command-palette__item--active' : ''}`;
    const content = (
      <>
        <span className={`bi ${item.icon}`} aria-hidden="true" />
        <span className="command-palette__item-text">
          <span className="command-palette__item-label">{item.label}</span>
          {item.sublabel && <span className="command-palette__item-sublabel">{item.sublabel}</span>}
        </span>
      </>
    );

    if (item.kind === 'theme') {
      return (
        <button
          type="button"
          key={item.key}
          id={`command-item-${String(item.index)}`}
          ref={setItemRef(item.index)}
          role="option"
          aria-selected={isActive}
          className={className}
          onMouseEnter={() => setActiveIndex(item.index)}
          onClick={() => {
            item.onActivate?.();
            onClose();
          }}
        >
          {content}
        </button>
      );
    }

    if (item.kind === 'external') {
      return (
        <a
          key={item.key}
          id={`command-item-${String(item.index)}`}
          ref={setItemRef(item.index)}
          role="option"
          aria-selected={isActive}
          className={className}
          href={item.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={() => setActiveIndex(item.index)}
          onClick={onClose}
        >
          {content}
        </a>
      );
    }

    if (!item.href) {
      // A TECHNOLOGY result — indexed and shown for completeness, but there
      // is no detail page to send it to (same as `/search`'s own page).
      return (
        <span
          key={item.key}
          id={`command-item-${String(item.index)}`}
          ref={setItemRef(item.index) as React.Ref<HTMLSpanElement>}
          role="option"
          aria-selected={isActive}
          aria-disabled="true"
          className={`${className} command-palette__item--disabled`}
        >
          {content}
        </span>
      );
    }

    return (
      <Link
        key={item.key}
        href={item.href}
        id={`command-item-${String(item.index)}`}
        ref={setItemRef(item.index) as React.Ref<HTMLAnchorElement>}
        role="option"
        aria-selected={isActive}
        className={className}
        onMouseEnter={() => setActiveIndex(item.index)}
        onClick={onClose}
      >
        {content}
      </Link>
    );
  }

  const announcedCount =
    debouncedQuery.length >= SEARCH_MIN_LENGTH
      ? `${String(results.length)} result${results.length === 1 ? '' : 's'}`
      : '';

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      className="command-palette"
      onEntered={() => inputRef.current?.focus()}
    >
      <div className="command-palette__search">
        <span className="bi bi-search command-palette__search-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          className="command-palette__input"
          placeholder="Search or jump to…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-list"
          aria-activedescendant={totalItems > 0 ? `command-item-${String(activeIndex)}` : undefined}
          aria-label="Search or jump to a page"
          autoComplete="off"
        />
        <kbd className="command-palette__esc">Esc</kbd>
      </div>

      <div id="command-palette-list" className="command-palette__list" role="listbox">
        {indexedSections.map((section) => (
          <div className="command-palette__group" key={section.label}>
            <p className="command-palette__group-label">{section.label}</p>
            {section.items.map((item) => renderItem(item))}
          </div>
        ))}
        {totalItems === 0 && (
          <p className="command-palette__empty">No matches for &ldquo;{query}&rdquo;.</p>
        )}
      </div>

      <div className="visually-hidden" aria-live="polite">
        {announcedCount}
      </div>
    </Modal>
  );
}
