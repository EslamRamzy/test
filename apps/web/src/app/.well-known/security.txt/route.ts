import { getProfile } from '@/lib/api/endpoints';
import { getPublicSiteUrl } from '@/lib/config';

/**
 * `security.txt` (RFC 9116), served at the path the RFC itself specifies —
 * `/.well-known/security.txt` — flagged as a known, trivial gap in
 * docs/architecture/09 §13 ("deliberately out of scope for v1" only in the
 * sense of not being built yet, not that it was ever meant to stay missing).
 *
 * `Contact` prefers the profile's own `publicEmail` when an admin has set
 * one, falling back to the public contact FORM's URL — the RFC's `Contact`
 * field accepts a URI, and this site's own contact form is exactly that: a
 * real channel to reach the same person, with no email address to leak or
 * go stale if one was never configured.
 */
export async function GET(): Promise<Response> {
  const siteUrl = getPublicSiteUrl();
  const profile = await getProfile().catch(() => null);
  const contact = profile?.publicEmail ? `mailto:${profile.publicEmail}` : `${siteUrl}/contact`;

  // RFC 9116 requires `Expires`; this is a personal portfolio with no
  // automated rotation for it, so it's a plain, generously-future constant —
  // bump it whenever this file is next touched, same as any other static
  // compliance date.
  const body = [
    `Contact: ${contact}`,
    'Expires: 2027-12-31T23:59:59.000Z',
    `Canonical: ${siteUrl}/.well-known/security.txt`,
    'Preferred-Languages: en',
  ].join('\n');

  return new Response(`${body}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
