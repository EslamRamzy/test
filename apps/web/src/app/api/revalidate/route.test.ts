import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const revalidateTagMock = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidateTag: revalidateTagMock }));

// Imported after the mock is registered (vi.mock is hoisted above this
// import anyway, but this ordering keeps the file readable top-to-bottom).
const { POST } = await import('./route');

const SECRET = 'a-genuinely-random-secret-value-not-a-placeholder';

function request(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('https://api.local.eslamramzy.dev/api/revalidate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    process.env['REVALIDATE_SECRET'] = SECRET;
  });

  afterEach(() => {
    revalidateTagMock.mockClear();
    delete process.env['REVALIDATE_SECRET'];
  });

  it('rejects a request with no secret header', async () => {
    const res = await POST(request({ tags: ['projects'] }));
    expect(res.status).toBe(401);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it('rejects a request with the wrong secret', async () => {
    const res = await POST(request({ tags: ['projects'] }, { 'x-revalidate-secret': 'wrong' }));
    expect(res.status).toBe(401);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it('rejects when the server has no REVALIDATE_SECRET configured', async () => {
    delete process.env['REVALIDATE_SECRET'];
    const res = await POST(request({ tags: ['projects'] }, { 'x-revalidate-secret': SECRET }));
    expect(res.status).toBe(401);
  });

  it('rejects a non-array tags body', async () => {
    const res = await POST(request({ tags: 'projects' }, { 'x-revalidate-secret': SECRET }));
    expect(res.status).toBe(400);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it('rejects an empty tags array', async () => {
    const res = await POST(request({ tags: [] }, { 'x-revalidate-secret': SECRET }));
    expect(res.status).toBe(400);
  });

  it('calls revalidateTag once per tag and returns them, given a valid secret', async () => {
    const res = await POST(
      request({ tags: ['projects', 'project:my-app'] }, { 'x-revalidate-secret': SECRET }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { revalidated: boolean; tags: string[] };
    expect(body).toEqual({ revalidated: true, tags: ['projects', 'project:my-app'] });
    expect(revalidateTagMock).toHaveBeenCalledTimes(2);
    expect(revalidateTagMock).toHaveBeenCalledWith('projects', { expire: 0 });
    expect(revalidateTagMock).toHaveBeenCalledWith('project:my-app', { expire: 0 });
  });
});
