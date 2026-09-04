import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownEditor } from './MarkdownEditor';

describe('MarkdownEditor', () => {
  it('renders the textarea with the given value and calls onChange while typing', () => {
    const onChange = vi.fn();
    render(<MarkdownEditor value="Hello" onChange={onChange} />);

    const textarea = screen.getByLabelText('Content');
    expect(textarea).toHaveValue('Hello');

    fireEvent.change(textarea, { target: { value: 'Hello world' } });
    expect(onChange).toHaveBeenCalledWith('Hello world');
  });

  it('renders the sanitized preview through <MarkdownBody>, debounced', async () => {
    render(<MarkdownEditor value="# Heading" onChange={vi.fn()} />);

    await waitFor(
      () => {
        expect(document.querySelector('.admin-markdown-editor__preview h1')).toHaveTextContent(
          'Heading',
        );
      },
      { timeout: 2000 },
    );
  });

  it('disables the textarea when disabled is set', () => {
    render(<MarkdownEditor value="" onChange={vi.fn()} disabled />);
    expect(screen.getByLabelText('Content')).toBeDisabled();
  });

  it('uses a custom label when given', () => {
    render(<MarkdownEditor value="" onChange={vi.fn()} label="Case study body" />);
    expect(screen.getByLabelText('Case study body')).toBeInTheDocument();
  });
});
