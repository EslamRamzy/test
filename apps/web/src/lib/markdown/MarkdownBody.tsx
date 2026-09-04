/**
 * The one place `dangerouslySetInnerHTML` renders real HTML
 * (eslint.config.mjs's `no-restricted-syntax` confines it to this
 * directory) — every content page (projects/articles/security detail
 * pages) imports this instead of writing the div itself, so the
 * XSS-relevant surface stays exactly one component, not one per route.
 *
 * `html` must already be the output of `render.ts`'s `renderMarkdown()`
 * (sanitized via `rehype-sanitize`) — this component does no sanitizing of
 * its own, by design; see that file for why the safety guarantee lives
 * there and not here.
 */
export function MarkdownBody({
  html,
  className,
}: {
  html: string;
  className?: string | undefined;
}) {
  return (
    <div
      className={className ? `markdown-body ${className}` : 'markdown-body'}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
