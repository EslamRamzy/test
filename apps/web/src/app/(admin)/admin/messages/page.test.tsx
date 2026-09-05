import type { ContactMessageAdminRow } from '@portfolio/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryProvider } from '@/features/admin/components/QueryProvider';
import { ToastProvider } from '@/features/admin/components/ToastProvider';
import MessagesInboxPage from './page';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

const UNREAD_MESSAGE: ContactMessageAdminRow = {
  id: 1,
  name: 'Jane Visitor',
  email: 'jane@example.com',
  subject: 'Hello there',
  message: 'This is the message body.',
  status: 'UNREAD',
  ipHash: 'hash1',
  userAgent: 'UA',
  spamScore: 0,
  readAt: null,
  createdAt: '2026-01-01T10:00:00.000Z',
};

const READ_MESSAGE: ContactMessageAdminRow = {
  id: 2,
  name: 'Bob Reader',
  email: 'bob@example.com',
  subject: null,
  message: 'Already read message.',
  status: 'READ',
  ipHash: null,
  userAgent: null,
  spamScore: 0,
  readAt: '2026-01-02T10:00:00.000Z',
  createdAt: '2026-01-02T09:00:00.000Z',
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderInbox() {
  return render(
    <QueryProvider>
      <ToastProvider>
        <MessagesInboxPage />
      </ToastProvider>
    </QueryProvider>,
  );
}

/** Every mutation call here needs a CSRF cookie already on hand — same as `MediaPicker.test.tsx`. */
function stubCsrfCookie(): void {
  document.cookie = '__Secure-csrf=test-token; path=/; Secure; SameSite=Strict';
}

describe('MessagesInboxPage', () => {
  it('shows the empty state when there are no messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(200, {
          success: true,
          data: [],
          meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
        }),
      ),
    );

    renderInbox();
    expect(await screen.findByText('No messages found.')).toBeInTheDocument();
    expect(screen.getByText('Select a message to read it.')).toBeInTheDocument();
  });

  it('lists messages and marks unread ones, and selecting an unread one opens it and auto-marks it read', async () => {
    stubCsrfCookie();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes('/api/v1/admin/messages?')) {
        return Promise.resolve(
          jsonResponse(200, {
            success: true,
            data: [UNREAD_MESSAGE, READ_MESSAGE],
            meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
          }),
        );
      }
      if (url.endsWith(`/api/v1/admin/messages/${String(UNREAD_MESSAGE.id)}/status`)) {
        expect(init?.method).toBe('PATCH');
        expect(JSON.parse(String(init?.body)) as unknown).toEqual({ status: 'READ' });
        return Promise.resolve(
          jsonResponse(200, {
            success: true,
            data: { ...UNREAD_MESSAGE, status: 'READ', readAt: '2026-01-03T00:00:00.000Z' },
          }),
        );
      }
      throw new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderInbox();

    // Scoped to each row, not `screen.findAllByText` — the status-filter
    // dropdown's own "Unread" option would otherwise be an extra, unrelated
    // match for the same text and could resolve the wait before the list
    // itself has actually loaded.
    const janeRow = await screen.findByRole('button', { name: /Jane Visitor/ });
    const bobRow = screen.getByRole('button', { name: /Bob Reader/ });
    expect(within(janeRow).getByText('Unread')).toBeInTheDocument();
    expect(within(bobRow).queryByText('Unread')).not.toBeInTheDocument();

    fireEvent.click(janeRow);

    // The detail pane opens over the selected (still-UNREAD-at-click-time) row.
    expect(await screen.findByRole('heading', { name: 'Hello there' })).toBeInTheDocument();
    expect(screen.getByText(/Jane Visitor.*jane@example\.com/)).toBeInTheDocument();

    // The auto-mark-read PATCH the effect fires above resolves and flips the
    // pane's own action to "Mark unread" (only shown for a READ message).
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mark unread' })).toBeInTheDocument();
    });
  });

  it('filters by status, sending it as a query param', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/v1/admin/messages?')) {
        return Promise.resolve(
          jsonResponse(200, {
            success: true,
            data: [],
            meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
          }),
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderInbox();
    await screen.findByText('No messages found.');

    fireEvent.change(screen.getByLabelText('Filter by status'), {
      target: { value: 'ARCHIVED' },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('status=ARCHIVED'),
        expect.anything(),
      );
    });
  });

  it('archives an already-read message from the detail pane', async () => {
    stubCsrfCookie();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes('/api/v1/admin/messages?')) {
        return Promise.resolve(
          jsonResponse(200, {
            success: true,
            data: [READ_MESSAGE],
            meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
          }),
        );
      }
      if (url.endsWith(`/api/v1/admin/messages/${String(READ_MESSAGE.id)}/status`)) {
        expect(JSON.parse(String(init?.body)) as unknown).toEqual({ status: 'ARCHIVED' });
        return Promise.resolve(
          jsonResponse(200, { success: true, data: { ...READ_MESSAGE, status: 'ARCHIVED' } }),
        );
      }
      throw new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderInbox();
    fireEvent.click(await screen.findByRole('button', { name: /Bob Reader/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Archive' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/messages/${String(READ_MESSAGE.id)}/status`),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('deletes a message only after the sender email is typed into the confirmation, then closes the pane', async () => {
    stubCsrfCookie();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes('/api/v1/admin/messages?')) {
        return Promise.resolve(
          jsonResponse(200, {
            success: true,
            data: [READ_MESSAGE],
            meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
          }),
        );
      }
      if (
        url.endsWith(`/api/v1/admin/messages/${String(READ_MESSAGE.id)}`) &&
        init?.method === 'DELETE'
      ) {
        return Promise.resolve(jsonResponse(200, { success: true, data: { deleted: true } }));
      }
      throw new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderInbox();
    fireEvent.click(await screen.findByRole('button', { name: /Bob Reader/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    const dialog = screen.getByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Confirm' });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: READ_MESSAGE.email } });
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText('Select a message to read it.')).toBeInTheDocument();
    });
  });

  it('builds the mailto reply link from the sender email and subject', async () => {
    stubCsrfCookie();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes('/api/v1/admin/messages?')) {
        return Promise.resolve(
          jsonResponse(200, {
            success: true,
            data: [READ_MESSAGE],
            meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
          }),
        );
      }
      // READ_MESSAGE is already READ, so no auto-mark-read PATCH is expected —
      // any status PATCH here would be a bug in that guard.
      throw new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderInbox();
    fireEvent.click(await screen.findByRole('button', { name: /Bob Reader/ }));

    const replyLink = await screen.findByRole('link', { name: /Reply by email/ });
    expect(replyLink).toHaveAttribute(
      'href',
      `mailto:${READ_MESSAGE.email}?subject=${encodeURIComponent('Re: your message')}`,
    );
  });
});
