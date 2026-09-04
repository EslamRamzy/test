import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataTableColumn } from './DataTable';
import { AdminResourceListPage, type AdminResourceListPageHooks } from './AdminResourceListPage';
import { ToastProvider } from './ToastProvider';

interface Row {
  id: number;
  name: string;
}

const columns: Array<DataTableColumn<Row>> = [
  { key: 'name', label: 'Name', render: (r) => r.name },
];

function makeHooks(rows: Row[], overrides: Partial<AdminResourceListPageHooks<Row>> = {}) {
  const listSpy = vi.fn();
  const removeMutate = vi.fn((_id: number, opts?: { onSuccess?: () => void }) =>
    opts?.onSuccess?.(),
  );
  const reorderMutate = vi.fn();
  const hooks: AdminResourceListPageHooks<Row> = {
    useList: (params) => {
      listSpy(params);
      return {
        data: { items: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1 } },
        isPending: false,
      } as unknown as ReturnType<AdminResourceListPageHooks<Row>['useList']>;
    },
    useRemove: () =>
      ({ mutate: removeMutate, isPending: false }) as unknown as ReturnType<
        AdminResourceListPageHooks<Row>['useRemove']
      >,
    ...overrides,
  };
  return { hooks, listSpy, removeMutate, reorderMutate };
}

function renderPage(
  hooks: AdminResourceListPageHooks<Row>,
  extra: Partial<Parameters<typeof AdminResourceListPage<Row>>[0]> = {},
) {
  return render(
    <ToastProvider>
      <AdminResourceListPage
        title="Technologies"
        hooks={hooks}
        columns={columns}
        newHref="/admin/technologies/new"
        getEditHref={(row) => `/admin/technologies/${row.id}`}
        getEntityLabel={(row) => row.name}
        resourceNameSingular="technology"
        {...extra}
      />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AdminResourceListPage', () => {
  it('renders rows from useList', () => {
    const { hooks } = makeHooks([{ id: 1, name: 'React' }]);
    renderPage(hooks);
    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('debounced search updates the q param passed to useList and resets to page 1', async () => {
    const { hooks, listSpy } = makeHooks([{ id: 1, name: 'React' }]);
    renderPage(hooks);
    listSpy.mockClear();

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'rea' } });
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ page: 1, q: 'rea' }));
    });
  });

  it('opens a typed-confirmation dialog before deleting, and calls remove + shows a toast on confirm', async () => {
    const { hooks, removeMutate } = makeHooks([{ id: 1, name: 'React' }]);
    renderPage(hooks);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: 'React' } });
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);
    expect(removeMutate).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(await screen.findByText('React deleted.')).toBeInTheDocument();
  });

  it('statusFilter: renders the status dropdown and passes its value to useList, resetting to page 1', async () => {
    const { hooks, listSpy } = makeHooks([{ id: 1, name: 'React' }]);
    renderPage(hooks, { statusFilter: true });
    listSpy.mockClear();

    fireEvent.change(screen.getByLabelText('Filter by status'), {
      target: { value: 'PUBLISHED' },
    });

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, status: 'PUBLISHED' }),
      );
    });
  });

  it('omits the status dropdown when statusFilter is not set', () => {
    const { hooks } = makeHooks([{ id: 1, name: 'React' }]);
    renderPage(hooks);
    expect(screen.queryByLabelText('Filter by status')).not.toBeInTheDocument();
  });

  it('reorderable: move-down recomputes displayOrder over the full row set and calls reorder', () => {
    const reorderMutate = vi.fn();
    const { hooks } = makeHooks([
      { id: 1, name: 'React' },
      { id: 2, name: 'Vue' },
    ]);
    hooks.useReorder = () =>
      ({ mutate: reorderMutate, isPending: false }) as unknown as ReturnType<
        NonNullable<AdminResourceListPageHooks<Row>['useReorder']>
      >;
    renderPage(hooks, { reorderable: true });

    fireEvent.click(screen.getByRole('button', { name: 'Move React down' }));
    expect(reorderMutate).toHaveBeenCalledWith(
      [
        { id: 2, displayOrder: 0 },
        { id: 1, displayOrder: 1 },
      ],
      expect.anything(),
    );
  });

  it('disables reorder buttons while a search filter is active', async () => {
    const reorderMutate = vi.fn();
    const { hooks } = makeHooks([
      { id: 1, name: 'React' },
      { id: 2, name: 'Vue' },
    ]);
    hooks.useReorder = () =>
      ({ mutate: reorderMutate, isPending: false }) as unknown as ReturnType<
        NonNullable<AdminResourceListPageHooks<Row>['useReorder']>
      >;
    renderPage(hooks, { reorderable: true });

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'vue' } });
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Move React down' })).toBeDisabled();
    });
  });
});
