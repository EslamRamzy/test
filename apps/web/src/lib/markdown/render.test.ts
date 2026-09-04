import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './render';

describe('renderMarkdown', () => {
  it('renders headings, emphasis, and lists', async () => {
    const html = await renderMarkdown(
      '# Title\n\nSome **bold** and *italic* text.\n\n- one\n- two',
    );
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<li>one</li>');
  });

  it('renders a safe https link', async () => {
    const html = await renderMarkdown('[click me](https://example.com/page)');
    expect(html).toContain('href="https://example.com/page"');
  });

  it('strips a javascript: URL from a link (protocol allow-list)', async () => {
    const html = await renderMarkdown('[click me](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('href=');
  });

  it('strips a data: URL from an image src', async () => {
    const html = await renderMarkdown('![alt](data:text/html;base64,PHNjcmlwdD4=)');
    expect(html).not.toContain('data:text/html');
  });

  it('never parses a literal <script> tag typed into markdown source into a real element', async () => {
    const html = await renderMarkdown('Hello <script>alert(document.cookie)</script> world');
    // The whole point of NOT enabling allowDangerousHtml: this stays escaped
    // text, not a real (even sanitizer-stripped) element — never a `<script`
    // tag reaching the output at all, escaped or otherwise executable.
    expect(html).not.toMatch(/<script[\s>]/);
  });

  it('never parses a literal onclick handler typed into markdown source into a real attribute', async () => {
    const html = await renderMarkdown('<div onclick="alert(1)">click</div>');
    expect(html).not.toContain('onclick');
  });

  it('renders a fenced code block with real syntax-highlighting styles (shiki ran)', async () => {
    const html = await renderMarkdown('```ts\nconst x: number = 1;\n```');
    expect(html).toContain('<pre');
    expect(html).toContain('<code');
    // Dual light/dark theme mode (render.ts's `theme: {light, dark}` option)
    // makes shiki emit BOTH colors as CSS custom properties per token,
    // rather than a single inline `color:` — `styles/_markdown.scss`
    // resolves `--shiki-light`/`--shiki-dark` into the real `color` based
    // on the site's own `[data-theme]` attribute. Shiki's own output is
    // what legitimately produces a `style` attribute in this pipeline at
    // all (see render.ts's header comment) — prove it actually ran, not
    // just that the schema would allow it to.
    expect(html).toMatch(/style="--shiki-light:#[0-9A-Fa-f]+;--shiki-dark:#[0-9A-Fa-f]+"/);
  });

  it('a literal <span style="..."> typed into markdown source is NOT preserved with its style', async () => {
    const html = await renderMarkdown(
      'Text <span style="background:url(javascript:alert(1))">x</span> more',
    );
    // Proves the security property render.ts's header comment relies on:
    // the only way a real, styled `span` reaches the output is shiki's own
    // highlighting, never literal HTML typed by the content author.
    expect(html).not.toContain('background:url');
  });

  it('renders a GFM table', async () => {
    const html = await renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('<table>');
    expect(html).toContain('<td>1</td>');
  });

  it('renders a GFM task list', async () => {
    const html = await renderMarkdown('- [x] done\n- [ ] not done');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
  });

  it('renders a blockquote', async () => {
    const html = await renderMarkdown('> A quote');
    expect(html).toContain('<blockquote>');
  });

  it('does not throw on empty input', async () => {
    await expect(renderMarkdown('')).resolves.toBe('');
  });
});
