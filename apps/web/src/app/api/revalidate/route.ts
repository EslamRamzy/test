import { timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * On-demand revalidation endpoint (docs/architecture/01 §4.2, 06 line 53).
 * The API's `apps/api/src/lib/revalidate.ts` calls this, shared-secret
 * protected, right after an admin mutation's own transaction commits:
 * `POST /api/revalidate { tags: string[] }`, header `X-Revalidate-Secret`.
 *
 * Never returns anything more specific than "invalid" for a bad secret —
 * no distinction between "missing" and "wrong" in the response, so this
 * endpoint doesn't help an attacker narrow down the secret.
 */

// Read inside the function, not hoisted to a module-level constant — this
// module is imported once per process, and reading it fresh on every
// request is what lets a test set `process.env.REVALIDATE_SECRET` without
// needing `vi.resetModules()` to see it take effect.
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env['REVALIDATE_SECRET'];
  const provided = request.headers.get('x-revalidate-secret');
  if (!secret || !provided) return false;

  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  // timingSafeEqual throws on a length mismatch rather than returning
  // false (same guard as apps/api/src/lib/csrf.ts's own comparison).
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Invalid or missing revalidation secret' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const tags = (body as { tags?: unknown } | null)?.tags;
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string') || tags.length === 0) {
    return NextResponse.json({ error: '"tags" must be a non-empty string array' }, { status: 400 });
  }

  // Next 16 (16.3.4, the installed version — confirmed by reading
  // `next/dist/.../spec-extension/revalidate.js` directly) made the second
  // argument to `revalidateTag` load-bearing: calling it with one argument
  // still works, but only sets a deprecation warning and — per that same
  // source — a `profile` whose `expire` isn't exactly `0` skips marking the
  // path as revalidated. `{ expire: 0 }` is what reproduces the classic,
  // single-argument "invalidate this tag right now" semantics the
  // architecture docs (01 §4.2, 06 line 53) were written against, with no
  // deprecation warning.
  for (const tag of tags as string[]) revalidateTag(tag, { expire: 0 });

  return NextResponse.json({ revalidated: true, tags });
}
