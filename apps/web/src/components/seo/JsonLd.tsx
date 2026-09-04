/**
 * Renders a `<script type="application/ld+json">` WITHOUT
 * `dangerouslySetInnerHTML` — restricted repo-wide to
 * `lib/markdown/render.ts`'s sanitized-HTML output (eslint.config.mjs), and
 * structured data was never HTML to begin with.
 *
 * `JSON.stringify` output can't contain a raw `<` unless a string field's
 * *value* does (schema.org data here is server-built from validated API
 * fields, not arbitrary user HTML) — but escaping it to `<` closes
 * off a `</script>`-breakout either way, and lets this render as an
 * ordinary JSX text child instead of raw HTML.
 */
export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json">{json}</script>;
}
