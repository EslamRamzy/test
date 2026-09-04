/**
 * Reading-time estimate for an article (doc07 §3: "computed reading time" —
 * `articleService.ts`'s own comment on why this is never client-supplied).
 *
 * 200 words per minute is the conventional estimate this kind of feature
 * uses everywhere (Medium's own published figure, among others) — there is
 * no project-specific number documented, so this is a deliberate, ordinary
 * choice, not a value inferred from anywhere in this codebase.
 *
 * Counts words in the raw markdown source, not the rendered/stripped text —
 * markdown syntax characters (`#`, `*`, backticks, link brackets) are a
 * small, roughly constant overhead per word that doesn't meaningfully skew
 * an estimate this coarse (rounded up to the whole minute); stripping
 * markdown first would need the same sanitising pipeline the renderer uses,
 * for a number nobody reads more precisely than "~4 min read".
 */

const WORDS_PER_MINUTE = 200;

export function computeReadingTimeMinutes(content: string): number {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}
