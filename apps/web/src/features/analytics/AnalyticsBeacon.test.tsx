import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsBeacon } from './AnalyticsBeacon';

const { recordAnalyticsViewMock, usePathnameMock } = vi.hoisted(() => ({
  recordAnalyticsViewMock: vi.fn(),
  usePathnameMock: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({ recordAnalyticsView: recordAnalyticsViewMock }));
vi.mock('next/navigation', () => ({ usePathname: usePathnameMock }));

/**
 * `document.referrer` is a real, read-only-in-practice DOM property — not
 * something `vi.stubGlobal` can override without replacing the whole
 * `document` object (which breaks Testing Library's own `render()`, since it
 * needs the REAL `document.body` to attach to). `Object.defineProperty`
 * shadows just this one property on the real document instead.
 */
function stubReferrer(value: string): void {
  Object.defineProperty(document, 'referrer', { value, configurable: true });
}

afterEach(() => {
  recordAnalyticsViewMock.mockReset();
  usePathnameMock.mockReset();
  stubReferrer('');
});

describe('AnalyticsBeacon', () => {
  it('fires once on mount with the current path and entity info', () => {
    usePathnameMock.mockReturnValue('/projects/portfolio-platform');
    recordAnalyticsViewMock.mockResolvedValue(undefined);

    render(<AnalyticsBeacon entityType="PROJECT" entityId={1} />);

    expect(recordAnalyticsViewMock).toHaveBeenCalledTimes(1);
    expect(recordAnalyticsViewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/projects/portfolio-platform',
        entityType: 'PROJECT',
        entityId: 1,
      }),
    );
  });

  it('omits entityId for a plain page (doc09 §10 — PAGE entityType, no numeric id)', () => {
    usePathnameMock.mockReturnValue('/about');
    recordAnalyticsViewMock.mockResolvedValue(undefined);

    render(<AnalyticsBeacon entityType="PAGE" />);

    expect(recordAnalyticsViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/about', entityType: 'PAGE', entityId: undefined }),
    );
  });

  it('fires again when the path changes (a real client-side navigation)', () => {
    usePathnameMock.mockReturnValue('/articles');
    recordAnalyticsViewMock.mockResolvedValue(undefined);

    const { rerender } = render(<AnalyticsBeacon entityType="PAGE" />);
    expect(recordAnalyticsViewMock).toHaveBeenCalledTimes(1);

    usePathnameMock.mockReturnValue('/articles/building-a-secure-contact-form');
    rerender(<AnalyticsBeacon entityType="ARTICLE" entityId={2} />);

    expect(recordAnalyticsViewMock).toHaveBeenCalledTimes(2);
    expect(recordAnalyticsViewMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        path: '/articles/building-a-secure-contact-form',
        entityType: 'ARTICLE',
        entityId: 2,
      }),
    );
  });

  it('does not fire again on a re-render at the same path (no duplicate beacon per page)', () => {
    usePathnameMock.mockReturnValue('/contact');
    recordAnalyticsViewMock.mockResolvedValue(undefined);

    const { rerender } = render(<AnalyticsBeacon entityType="PAGE" />);
    rerender(<AnalyticsBeacon entityType="PAGE" />);

    expect(recordAnalyticsViewMock).toHaveBeenCalledTimes(1);
  });

  it('extracts only the hostname from an external document.referrer (never the full URL)', () => {
    usePathnameMock.mockReturnValue('/');
    recordAnalyticsViewMock.mockResolvedValue(undefined);
    stubReferrer('https://www.google.com/search?q=eslam+ramzy+portfolio');

    render(<AnalyticsBeacon entityType="PAGE" />);

    expect(recordAnalyticsViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ referrerHost: 'www.google.com' }),
    );
  });

  it("omits referrerHost when the referrer is this site's own origin (an internal navigation, not a traffic source)", () => {
    usePathnameMock.mockReturnValue('/');
    recordAnalyticsViewMock.mockResolvedValue(undefined);
    stubReferrer(`${window.location.origin}/about`);

    render(<AnalyticsBeacon entityType="PAGE" />);

    expect(recordAnalyticsViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ referrerHost: undefined }),
    );
  });

  it('omits referrerHost when there is no referrer at all (a direct visit)', () => {
    usePathnameMock.mockReturnValue('/');
    recordAnalyticsViewMock.mockResolvedValue(undefined);
    stubReferrer('');

    render(<AnalyticsBeacon entityType="PAGE" />);

    expect(recordAnalyticsViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ referrerHost: undefined }),
    );
  });

  it('never throws when the beacon call rejects (fire-and-forget, doc03 §3)', async () => {
    usePathnameMock.mockReturnValue('/');
    recordAnalyticsViewMock.mockRejectedValue(new Error('network error'));

    expect(() => render(<AnalyticsBeacon entityType="PAGE" />)).not.toThrow();
    // Let the rejected promise's .catch() run before the test ends, so an
    // unhandled-rejection warning can't leak into a LATER test's output.
    await Promise.resolve().then().then();
  });

  it('renders nothing (no DOM footprint of its own)', () => {
    usePathnameMock.mockReturnValue('/');
    recordAnalyticsViewMock.mockResolvedValue(undefined);

    const { container } = render(<AnalyticsBeacon entityType="PAGE" />);
    expect(container).toBeEmptyDOMElement();
  });
});
