'use client';

import { useEffect, useState } from 'react';
import { MarkdownBody } from '@/lib/markdown/MarkdownBody';
import { renderMarkdown } from '@/lib/markdown/render';

/**
 * `<MarkdownEditor>` — "Split editor/preview, rendered through the same
 * sanitising pipeline as the public site" (doc07 §2, §7: "self-XSS is
 * still XSS when the victim is the only admin"). The preview renders
 * through `<MarkdownBody>` (`lib/markdown/MarkdownBody.tsx`), the one
 * component `dangerouslySetInnerHTML` is confined to
 * (`eslint.config.mjs`'s own rule) — this file never touches it directly.
 */
export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  rows?: number;
  label?: string;
}

const PREVIEW_DEBOUNCE_MS = 300;

export function MarkdownEditor({
  value,
  onChange,
  disabled = false,
  rows = 16,
  label = 'Content',
}: MarkdownEditorProps): React.JSX.Element {
  const [debounced, setDebounced] = useState(value);
  const [html, setHtml] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    renderMarkdown(debounced)
      .then((rendered) => {
        if (!cancelled) setHtml(rendered);
      })
      .catch(() => {
        // renderMarkdown never throws by its own contract, but a preview
        // rendering failure must never take the editor itself down with it.
        if (!cancelled) setHtml('');
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return (
    <div className="admin-markdown-editor">
      <div className="admin-markdown-editor__pane">
        <label className="admin-markdown-editor__label form-label" htmlFor="markdown-editor-source">
          {label}
        </label>
        <textarea
          id="markdown-editor-source"
          className="admin-markdown-editor__textarea form-control"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          rows={rows}
        />
      </div>
      <div className="admin-markdown-editor__pane">
        <span className="admin-markdown-editor__label form-label">Preview</span>
        <div className="admin-markdown-editor__preview">
          <MarkdownBody html={html} />
        </div>
      </div>
    </div>
  );
}
