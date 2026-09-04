/**
 * Slug generation for the "Duplicate" action (doc07 §3, listed for
 * Projects/Articles/Security Research alike) — the one place this platform
 * generates a slug automatically rather than requiring the admin to type
 * one: every create/update schema treats `slug` as admin-supplied (doc10
 * §3's "slug generation and collision handling" unit-test guidance applies
 * here, not to ordinary creates).
 *
 * `exists` is injected (an async slug -> boolean check) rather than this
 * module taking a repository dependency directly — keeps it pure and
 * trivially unit-testable with a stub, and reusable across the three
 * entities that duplicate without hand-wiring Prisma into each attempt.
 */
export async function generateDuplicateSlug(
  baseSlug: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const firstCandidate = `${baseSlug}-copy`;
  if (!(await exists(firstCandidate))) return firstCandidate;

  let attempt = 2;
  for (;;) {
    const candidate = `${baseSlug}-copy-${attempt}`;
    if (!(await exists(candidate))) return candidate;
    attempt += 1;
  }
}
