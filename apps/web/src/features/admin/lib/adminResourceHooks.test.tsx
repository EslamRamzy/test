import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AdminResourceClient } from '@/lib/api/adminResource';
import { createAdminResourceHooks } from './adminResourceHooks';

interface Row {
  id: number;
  name: string;
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function makeClient(
  overrides: Partial<
    AdminResourceClient<Row, Partial<Row>, Partial<Row>, Record<string, unknown>>
  > = {},
) {
  return {
    list: vi.fn().mockResolvedValue({
      items: [{ id: 1, name: 'Row' }],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    }),
    read: vi.fn().mockResolvedValue({ id: 1, name: 'Row' }),
    create: vi.fn().mockResolvedValue({ id: 2, name: 'New' }),
    update: vi.fn().mockResolvedValue({ id: 1, name: 'Updated' }),
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as AdminResourceClient<Row, Partial<Row>, Partial<Row>, Record<string, unknown>>;
}

describe('createAdminResourceHooks', () => {
  it('useList calls client.list with the given params', async () => {
    const client = makeClient();
    const hooks = createAdminResourceHooks(client, 'things');
    const queryClient = new QueryClient();
    const { result } = renderHook(() => hooks.useList({ page: 1 }), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.list).toHaveBeenCalledWith({ page: 1 });
    expect(result.current.data?.items).toEqual([{ id: 1, name: 'Row' }]);
  });

  it('useItem is disabled until an id is given', async () => {
    const client = makeClient();
    const hooks = createAdminResourceHooks(client, 'things');
    const queryClient = new QueryClient();
    const { result, rerender } = renderHook(
      ({ id }: { id: number | undefined }) => hooks.useItem(id),
      {
        wrapper: wrapper(queryClient),
        initialProps: { id: undefined as number | undefined },
      },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(client.read).not.toHaveBeenCalled();

    rerender({ id: 1 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.read).toHaveBeenCalledWith(1);
  });

  it('useCreate invalidates the list query on success', async () => {
    const client = makeClient();
    const hooks = createAdminResourceHooks(client, 'things');
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => hooks.useCreate(), { wrapper: wrapper(queryClient) });

    result.current.mutate({ name: 'New' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.create).toHaveBeenCalledWith({ name: 'New' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['things', 'list'] });
  });

  it('useUpdate invalidates both the list and the one item query on success', async () => {
    const client = makeClient();
    const hooks = createAdminResourceHooks(client, 'things');
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => hooks.useUpdate(), { wrapper: wrapper(queryClient) });

    result.current.mutate({ id: 1, data: { name: 'Updated' } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.update).toHaveBeenCalledWith(1, { name: 'Updated' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['things', 'list'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['things', 'item', 1] });
  });

  it('useRemove invalidates the list query on success', async () => {
    const client = makeClient();
    const hooks = createAdminResourceHooks(client, 'things');
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => hooks.useRemove(), { wrapper: wrapper(queryClient) });

    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.remove).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['things', 'list'] });
  });

  it('has no useReorder unless the client itself has a reorder function', () => {
    const withoutReorder = createAdminResourceHooks(makeClient(), 'things');
    expect(withoutReorder.useReorder).toBeUndefined();

    const withReorder = createAdminResourceHooks(
      makeClient({ reorder: vi.fn().mockResolvedValue(undefined) }),
      'things',
    );
    expect(withReorder.useReorder).toBeInstanceOf(Function);
  });

  it('useReorder calls client.reorder and invalidates the list query', async () => {
    const reorder = vi.fn().mockResolvedValue(undefined);
    const client = makeClient({ reorder });
    const hooks = createAdminResourceHooks(client, 'things');
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => hooks.useReorder?.(), { wrapper: wrapper(queryClient) });

    result.current?.mutate([{ id: 1, displayOrder: 2 }]);
    await waitFor(() => expect(result.current?.isSuccess).toBe(true));
    expect(reorder).toHaveBeenCalledWith([{ id: 1, displayOrder: 2 }]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['things', 'list'] });
  });
});
