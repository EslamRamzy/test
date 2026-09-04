import { afterEach, describe, expect, it, vi } from 'vitest';
import { revalidateTags } from './revalidate.js';

describe('revalidateTags', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true without making a request when tags is empty', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await revalidateTags([]);

    expect(result).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs the tags to {PUBLIC_SITE_URL}/api/revalidate with the shared secret header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await revalidateTags(['projects', 'project:my-app']);

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://local.eslamramzy.dev/api/revalidate');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'X-Revalidate-Secret': expect.any(String) });
    expect(JSON.parse(init.body as string)).toEqual({ tags: ['projects', 'project:my-app'] });
  });

  it('returns false, and never throws, when the web app responds non-2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await revalidateTags(['projects']);

    expect(result).toBe(false);
  });

  it('returns false, and never throws, when the request itself fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(revalidateTags(['projects'])).resolves.toBe(false);
  });
});
