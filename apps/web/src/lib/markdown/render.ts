import { defaultSchema } from 'rehype-sanitize';
import type { Options as SanitizeSchema } from 'rehype-sanitize';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import rehypePrettyCode from 'rehype-pretty-code';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

/**
 * Server-side markdown → sanitized HTML (docs/architecture/09 §2, T5:
 * "Markdown-only authoring, `rehype-sanitize` allow-list"). Syntax
 * highlighting runs here too (`rehype-pretty-code` + shiki) so zero
 * highlighter code ever reaches the browser (doc 06 §9).
 *
 * Two structural decisions carry the actual security guarantee, not just
 * the presence of `rehype-sanitize`:
 *
 * 1. `remark-rehype` is called WITHOUT `allowDangerousHtml: true`, and
 *    `rehype-raw` is never used. Literal HTML typed into markdown source
 *    (`<script>...`, `<span onclick=...>`) is therefore never parsed into
 *    real DOM nodes at all — it stays escaped text, unconditionally,
 *    regardless of what the sanitizer schema below allows or misses. This
 *    is the actual "Markdown-only authoring" control; the schema below is
 *    the second layer, not the first.
 * 2. Given (1), the only way a real `<span style="...">` node can exist in
 *    the tree at all is shiki's own highlighting output — there is no
 *    markdown syntax that produces one directly. That is what makes it
 *    safe to allow `style`/`className` specifically on `span`/`code`/`pre`
 *    below: it is not a general "allow inline styles" hole, because
 *    nothing else can reach that attribute. Verified directly in
 *    render.test.ts, not just reasoned about here.
 */

const SANITIZE_SCHEMA: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'figure', 'figcaption'],
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span ?? []), 'style', 'className', 'dataLine'],
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      'style',
      'dataLanguage',
      'dataLine',
      ['className', /^language-./],
    ],
    pre: [
      ...(defaultSchema.attributes?.pre ?? []),
      'style',
      'className',
      'tabIndex',
      'dataLanguage',
    ],
    figure: ['dataRehypePrettyCodeFigure'],
    a: [...(defaultSchema.attributes?.a ?? []), 'title'],
    img: [...(defaultSchema.attributes?.img ?? []), 'title', 'width', 'height', 'loading'],
  },
};

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype) // no `allowDangerousHtml` — see header comment, point 1
  .use(rehypePrettyCode, {
    theme: { light: 'github-light', dark: 'github-dark' },
    keepBackground: false, // the theme's page background wins, not the code block's own
  })
  .use(rehypeSanitize, SANITIZE_SCHEMA)
  .use(rehypeStringify);

/** Renders admin-authored markdown to sanitized, syntax-highlighted HTML. Never throws on malformed input — worst case is a plain, unhighlighted render. */
export async function renderMarkdown(markdown: string): Promise<string> {
  const file = await processor.process(markdown);
  return String(file);
}
