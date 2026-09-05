import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaPicker } from './MediaPicker';
import { QueryProvider } from './QueryProvider';
import { ToastProvider } from './ToastProvider';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

const EXISTING_ITEM = {
  id: 7,
  filename: 'abc123-def456.png',
  originalName: 'existing.png',
  mimeType: 'image/png',
  sizeBytes: 2048,
  width: 400,
  height: 300,
  checksumSha256: 'x'.repeat(64),
  storagePath: 'abc123-def456.png',
  altText: 'An existing screenshot',
  kind: 'SCREENSHOT',
  uploadedBy: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderPicker(value: number | null, onChange: (id: number | null) => void) {
  return render(
    <QueryProvider>
      <ToastProvider>
        <MediaPicker value={value} onChange={onChange} kind="SCREENSHOT" label="cover image" />
      </ToastProvider>
    </QueryProvider>,
  );
}

describe('MediaPicker', () => {
  it('shows a placeholder and "Choose" button when no value is selected', () => {
    renderPicker(null, vi.fn());
    expect(screen.getByRole('button', { name: /Choose cover image/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/i })).not.toBeInTheDocument();
  });

  it('fetches and shows the selected item, and "Remove" clears the selection', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/v1/admin/media/7')) {
        return Promise.resolve(
          jsonResponse(200, { success: true, data: { media: EXISTING_ITEM, usage: [] } }),
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const onChange = vi.fn();
    renderPicker(7, onChange);

    expect(await screen.findByRole('button', { name: /Change cover image/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('opens the modal, lists existing media, and selecting one calls onChange and closes it', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/v1/admin/media?')) {
        return Promise.resolve(
          jsonResponse(200, {
            success: true,
            data: [EXISTING_ITEM],
            meta: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
          }),
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const onChange = vi.fn();
    renderPicker(null, onChange);

    fireEvent.click(screen.getByRole('button', { name: /Choose cover image/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const gridItem = await screen.findByRole('button', { name: EXISTING_ITEM.altText });
    fireEvent.click(gridItem);

    expect(onChange).toHaveBeenCalledWith(EXISTING_ITEM.id);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('filters the library by the kind dropdown', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/v1/admin/media?')) {
        return Promise.resolve(
          jsonResponse(200, {
            success: true,
            data: [],
            meta: { page: 1, pageSize: 12, total: 0, totalPages: 1 },
          }),
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPicker(null, vi.fn());
    fireEvent.click(screen.getByRole('button', { name: /Choose cover image/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('kind=SCREENSHOT'),
        expect.anything(),
      );
    });

    fireEvent.change(screen.getByLabelText('Filter by kind'), {
      target: { value: 'ARTICLE_COVER' },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('kind=ARTICLE_COVER'),
        expect.anything(),
      );
    });
  });

  it('choosing a file shows an alt-text prompt, and confirming uploads it and calls onChange', async () => {
    document.cookie = '__Secure-csrf=test-token; path=/; Secure; SameSite=Strict';
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes('/api/v1/admin/media?')) {
        return Promise.resolve(
          jsonResponse(200, {
            success: true,
            data: [],
            meta: { page: 1, pageSize: 12, total: 0, totalPages: 1 },
          }),
        );
      }
      if (url.endsWith('/api/v1/admin/media') && init?.method === 'POST') {
        expect(init.body).toBeInstanceOf(FormData);
        const formData = init.body as FormData;
        expect(formData.get('kind')).toBe('SCREENSHOT');
        expect(formData.get('altText')).toBe('A new screenshot');
        return Promise.resolve(
          jsonResponse(201, {
            success: true,
            data: { ...EXISTING_ITEM, id: 42, originalName: 'new.png' },
          }),
        );
      }
      throw new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const onChange = vi.fn();
    renderPicker(null, onChange);
    fireEvent.click(screen.getByRole('button', { name: /Choose cover image/i }));

    const file = new File(['fake-image-bytes'], 'new.png', { type: 'image/png' });
    const fileInput = screen.getByLabelText('Upload a file');
    fireEvent.change(fileInput, { target: { files: [file] } });

    const altTextInput = await screen.findByLabelText('Alt text');
    fireEvent.change(altTextInput, { target: { value: 'A new screenshot' } });
    fireEvent.click(screen.getByRole('button', { name: /Upload and use this file/i }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(42);
    });
  });

  it('has no detectable accessibility violations (docs/architecture/06 §10)', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/v1/admin/media?')) {
        return Promise.resolve(
          jsonResponse(200, {
            success: true,
            data: [EXISTING_ITEM],
            meta: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
          }),
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPicker(null, vi.fn());
    fireEvent.click(screen.getByRole('button', { name: /Choose cover image/i }));
    await screen.findByRole('button', { name: EXISTING_ITEM.altText });

    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  }, 10_000);
});
