import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryProvider } from './QueryProvider';
import { TagInput, type TagOption } from './TagInput';
import { ToastProvider } from './ToastProvider';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderTagInput(value: TagOption[], onChange: (tags: TagOption[]) => void) {
  return render(
    <QueryProvider>
      <ToastProvider>
        <TagInput value={value} onChange={onChange} />
      </ToastProvider>
    </QueryProvider>,
  );
}

describe('TagInput', () => {
  it('renders selected tags as removable pills, and removing one calls onChange without it', () => {
    const onChange = vi.fn();
    renderTagInput(
      [
        { id: 1, name: 'XSS', slug: 'xss' },
        { id: 2, name: 'CSRF', slug: 'csrf' },
      ],
      onChange,
    );

    expect(screen.getByText('XSS')).toBeInTheDocument();
    expect(screen.getByText('CSRF')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove tag XSS' }));
    expect(onChange).toHaveBeenCalledWith([{ id: 2, name: 'CSRF', slug: 'csrf' }]);
  });

  it('typing shows matching suggestions from the admin tags search, excluding already-selected tags', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/v1/admin/tags')) {
        return Promise.resolve(
          jsonResponse(200, {
            success: true,
            data: [
              { id: 1, name: 'IDOR', slug: 'idor' },
              { id: 2, name: 'IDOR Testing', slug: 'idor-testing' },
            ],
            meta: { page: 1, pageSize: 10, total: 2, totalPages: 1 },
          }),
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const onChange = vi.fn();
    renderTagInput([{ id: 1, name: 'IDOR', slug: 'idor' }], onChange);

    fireEvent.change(screen.getByLabelText('Add a tag'), { target: { value: 'idor' } });

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'IDOR Testing' })).toBeInTheDocument();
    });
    // Already-selected IDOR must not appear twice in the suggestion list.
    expect(screen.queryByRole('option', { name: 'IDOR' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: 'IDOR Testing' }));
    expect(onChange).toHaveBeenCalledWith([
      { id: 1, name: 'IDOR', slug: 'idor' },
      { id: 2, name: 'IDOR Testing', slug: 'idor-testing' },
    ]);
  });

  it('pressing Enter with no matching tag creates a new one via POST, with a derived slug', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes('/api/v1/admin/tags') && (!init || init.method === undefined)) {
        return Promise.resolve(
          jsonResponse(200, {
            success: true,
            data: [],
            meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
          }),
        );
      }
      if (url.endsWith('/api/v1/admin/tags') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string) as { name: string; slug: string };
        expect(body).toEqual({ name: 'New Tag', slug: 'new-tag' });
        return Promise.resolve(
          jsonResponse(201, { success: true, data: { id: 99, name: 'New Tag', slug: 'new-tag' } }),
        );
      }
      throw new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    document.cookie = '__Secure-csrf=test-token; path=/; Secure; SameSite=Strict';

    const onChange = vi.fn();
    renderTagInput([], onChange);

    const input = screen.getByLabelText('Add a tag');
    fireEvent.change(input, { target: { value: 'New Tag' } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([{ id: 99, name: 'New Tag', slug: 'new-tag' }]);
    });
  });
});
