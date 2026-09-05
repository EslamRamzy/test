import type { SearchResultDto, SocialLinkDto } from '@portfolio/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';

/**
 * `vi.advanceTimersByTimeAsync` fires the debounce's `setTimeout` callback,
 * but that callback's own `setState` (and the further `searchContent(...)
 * .then(...)` chain it triggers) happens OUTSIDE any `act()` scope unless
 * this wraps it — without this, the assertion right after can run against a
 * DOM snapshot from before React ever flushed either update.
 */
async function advanceDebounce(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const { searchContentMock } = vi.hoisted(() => ({ searchContentMock: vi.fn() }));

vi.mock('@/lib/api/client', () => ({ searchContent: searchContentMock }));

const SOCIAL_LINKS: SocialLinkDto[] = [
  { id: 1, platform: 'GITHUB', label: 'GitHub', url: 'https://github.com/eslamramzy', icon: null },
  {
    id: 2,
    platform: 'LINKEDIN',
    label: 'LinkedIn',
    url: 'https://linkedin.com/in/eslamramzy',
    icon: null,
  },
];

const SEARCH_RESULTS: SearchResultDto[] = [
  {
    entityType: 'PROJECT',
    entityId: 1,
    slug: 'portfolio-platform',
    title: 'Portfolio Platform',
    snippet: 'A personal portfolio platform…',
  },
  {
    entityType: 'ARTICLE',
    entityId: 2,
    slug: 'building-a-secure-contact-form',
    title: 'Building a Secure Contact Form',
    snippet: 'Rate limiting, honeypots…',
  },
];

/**
 * `useTheme()` falls back to `window.matchMedia` whenever `<html>` carries no
 * `data-theme` yet (exactly the state a fresh test render starts from) —
 * jsdom has no real implementation of it, so every test here needs a stub in
 * place before the very first render or the component throws immediately.
 */
beforeEach(() => {
  // Scoped to exactly the debounce's own `setTimeout`/`clearTimeout` — faking
  // every timer-ish global (vitest's default) also fakes the mechanisms
  // React's own scheduler uses to flush effects between renders, which stalls
  // the search-results chain (a state update from the fake timer, then a
  // real promise resolving, then a second state update) indefinitely.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  document.documentElement.removeAttribute('data-theme');
  searchContentMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderPalette(onClose = vi.fn()) {
  render(<CommandPalette show onClose={onClose} socialLinks={SOCIAL_LINKS} />);
  return { onClose, input: screen.getByRole('combobox', { name: /search or jump to/i }) };
}

describe('CommandPalette', () => {
  it('is a proper dialog, and shows every static action with no query typed', () => {
    renderPalette();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    for (const label of [
      'About',
      'Projects',
      'Articles',
      'Security',
      'Certifications',
      'Experience',
      'Contact',
    ]) {
      expect(screen.getByRole('option', { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(screen.getByRole('option', { name: /GitHub/ })).toHaveAttribute(
      'href',
      'https://github.com/eslamramzy',
    );
    expect(screen.getByRole('option', { name: /LinkedIn/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Switch to dark theme/ })).toBeInTheDocument();
  });

  it('typing narrows the static actions to those matching the label', () => {
    const { input } = renderPalette();
    fireEvent.change(input, { target: { value: 'secur' } });

    expect(screen.getByRole('option', { name: /Security/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^About/ })).not.toBeInTheDocument();
  });

  it('debounces the live search 250ms and renders results grouped by entity type', async () => {
    searchContentMock.mockResolvedValue(SEARCH_RESULTS);
    const { input } = renderPalette();

    fireEvent.change(input, { target: { value: 'platform' } });
    expect(searchContentMock).not.toHaveBeenCalled();

    await advanceDebounce(250);

    expect(searchContentMock).toHaveBeenCalledWith('platform', 8);
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Articles')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Portfolio Platform/ })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: /Building a Secure Contact Form/ }),
    ).toBeInTheDocument();
  });

  it('never searches below the 2-character minimum, even after the debounce elapses', async () => {
    const { input } = renderPalette();
    fireEvent.change(input, { target: { value: 'a' } });
    await advanceDebounce(250);
    expect(searchContentMock).not.toHaveBeenCalled();
  });

  it('announces the result count once results settle', async () => {
    searchContentMock.mockResolvedValue([SEARCH_RESULTS[0]]);
    const { input } = renderPalette();
    fireEvent.change(input, { target: { value: 'platform' } });
    await advanceDebounce(250);

    expect(screen.getByText('1 result')).toBeInTheDocument();
  });

  it('ArrowUp wraps to the last item, and Enter activates it (the theme toggle)', () => {
    const { onClose, input } = renderPalette();

    // 7 nav actions + 2 social links puts the theme toggle at the final
    // index — ArrowUp from the default (first item selected) wraps there in
    // one press, exactly the same as it would for a mouse-driven "last item".
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    const themeOption = screen.getByRole('option', { name: /Switch to dark theme/ });
    expect(themeOption).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('ArrowDown moves forward from the first item', () => {
    renderPalette();
    const first = screen.getByRole('option', { name: /^About/ });
    const second = screen.getByRole('option', { name: /^Projects/ });
    expect(first).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(first).toHaveAttribute('aria-selected', 'false');
  });

  it('has no detectable accessibility violations (docs/architecture/06 §10)', async () => {
    // axe-core's own `run()` chunks its work via real `setTimeout` calls
    // internally — left faked (this file's own `beforeEach` scopes fake
    // timers to exactly `setTimeout`/`clearTimeout` for the debounce
    // tests), axe's promise never resolves at all. Nothing else in this
    // test needs fake timers, so switching back to real ones here is safe.
    vi.useRealTimers();
    renderPalette();
    // `react-bootstrap`'s `Modal` portals into `document.body`, not the
    // render container `screen` queries default to — scanning `body` is
    // what actually reaches the portaled dialog content.
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  }, 10_000); // axe's own DOM analysis is slow enough in jsdom to need more than the 5s default
});
