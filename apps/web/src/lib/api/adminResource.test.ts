import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminResourceClient, createPublishActions } from './adminResource';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

function setCsrfCookie(token: string): void {
  document.cookie = `__Secure-csrf=${token}; path=/; Secure; SameSite=Strict`;
}

beforeEach(() => {
  setCsrfCookie('csrf-token');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.cookie =
    '__Secure-csrf=; path=/; Secure; SameSite=Strict; expires=Thu, 01 Jan 1970 00:00:00 GMT';
});

interface Row {
  id: number;
  name: string;
}

describe('createAdminResourceClient', () => {
  it('list() builds a query string from non-empty params and returns items + meta', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    let requestedUrl = '';
    fetchMock.mockImplementation((input) => {
      requestedUrl = String(input);
      return Promise.resolve(
        jsonResponse(200, {
          success: true,
          data: [{ id: 1, name: 'Row' }],
          meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createAdminResourceClient<Row>('/api/v1/admin/things');
    const result = await client.list({ q: 'search term', page: 1, status: undefined });

    expect(requestedUrl).toContain('/api/v1/admin/things?');
    expect(requestedUrl).toContain('q=search+term');
    expect(requestedUrl).toContain('page=1');
    expect(requestedUrl).not.toContain('status');
    expect(result.items).toEqual([{ id: 1, name: 'Row' }]);
    expect(result.meta.total).toBe(1);
  });

  it('omits the query string entirely when every param is empty', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    let requestedUrl = '';
    fetchMock.mockImplementation((input) => {
      requestedUrl = String(input);
      return Promise.resolve(
        jsonResponse(200, {
          success: true,
          data: [],
          meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createAdminResourceClient<Row>('/api/v1/admin/things');
    await client.list({});
    expect(requestedUrl).toBe('http://localhost:4000/api/v1/admin/things');
  });

  it('read/create/update/remove hit the expected paths and methods, with CSRF on mutations', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const calls: Array<{ url: string; method: string; csrf: string | null }> = [];
    fetchMock.mockImplementation((input, init) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        csrf: headers.get('X-CSRF-Token'),
      });
      return Promise.resolve(jsonResponse(200, { success: true, data: { id: 1, name: 'Row' } }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createAdminResourceClient<Row>('/api/v1/admin/things');
    await client.read(1);
    await client.create({ name: 'New' });
    await client.update(1, { name: 'Updated' });
    await client.remove(1);

    expect(calls[0]).toMatchObject({ url: expect.stringContaining('/things/1'), method: 'GET' });
    expect(calls[1]).toMatchObject({
      url: expect.stringContaining('/things'),
      method: 'POST',
      csrf: 'csrf-token',
    });
    expect(calls[2]).toMatchObject({
      url: expect.stringContaining('/things/1'),
      method: 'PATCH',
      csrf: 'csrf-token',
    });
    expect(calls[3]).toMatchObject({
      url: expect.stringContaining('/things/1'),
      method: 'DELETE',
      csrf: 'csrf-token',
    });
  });

  it('has no reorder function unless { reorder: true } is passed', () => {
    const withoutReorder = createAdminResourceClient<Row>('/api/v1/admin/things');
    expect(withoutReorder.reorder).toBeUndefined();

    const withReorder = createAdminResourceClient<Row>('/api/v1/admin/things', { reorder: true });
    expect(withReorder.reorder).toBeInstanceOf(Function);
  });

  it('reorder() PATCHes /reorder with the items array as the body', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    let body: unknown;
    let url = '';
    fetchMock.mockImplementation((input, init) => {
      url = String(input);
      body = init?.body ? JSON.parse(init.body as string) : undefined;
      return Promise.resolve(jsonResponse(200, { success: true, data: { reordered: true } }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createAdminResourceClient<Row>('/api/v1/admin/things', { reorder: true });
    await client.reorder?.([{ id: 1, displayOrder: 2 }]);

    expect(url).toContain('/things/reorder');
    expect(body).toEqual([{ id: 1, displayOrder: 2 }]);
  });
});

describe('createPublishActions', () => {
  it('each action POSTs to {basePath}/{id}/{action}', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const urls: string[] = [];
    fetchMock.mockImplementation((input) => {
      urls.push(String(input));
      return Promise.resolve(
        jsonResponse(200, { success: true, data: { id: 1, status: 'DRAFT' } }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const actions = createPublishActions<Row & { status: string }>('/api/v1/admin/articles');
    await actions.publish(1);
    await actions.unpublish(1);
    await actions.archive(1);
    await actions.duplicate(1);

    expect(urls[0]).toContain('/articles/1/publish');
    expect(urls[1]).toContain('/articles/1/unpublish');
    expect(urls[2]).toContain('/articles/1/archive');
    expect(urls[3]).toContain('/articles/1/duplicate');
  });
});
