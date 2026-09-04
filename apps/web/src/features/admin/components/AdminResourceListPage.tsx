'use client';

import type { PaginationMeta } from '@portfolio/shared';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { ApiError } from '@/lib/api/ApiError';
import { ConfirmDialog } from './ConfirmDialog';
import { DataTable, type DataTableColumn } from './DataTable';
import { ResourceToolbar } from './ResourceToolbar';
import { useToast } from './ToastProvider';

/**
 * The List screen of doc07 §2's module pattern
 * (`/admin/{module}`: "search · status filter · sort · pagination · bulk
 * actions"), generic across every simple CRUD module (doc07 §3) so a new
 * one is a column array and a handful of props, not a bespoke page. The
 * three publish-workflow resources (Articles, Security Research, Projects)
 * have their own list pages instead — a `<StatusBadge>`/`<PublishControls>`
 * pair and readiness-gated actions are enough more machinery that folding
 * them into this component would make it harder to read for the 10
 * resources that don't need any of it.
 */
export interface AdminResourceListPageHooks<TRow> {
  useList: (
    params: Record<string, unknown>,
  ) => UseQueryResult<{ items: TRow[]; meta: PaginationMeta }>;
  useRemove: () => UseMutationResult<void, unknown, number>;
  /** Present only for a resource with a `displayOrder` column — see `reorderable` below. */
  useReorder?: () => UseMutationResult<void, unknown, Array<{ id: number; displayOrder: number }>>;
}

export interface AdminResourceListPageProps<TRow extends { id: number }> {
  /** Pass `''` when the surrounding page renders its own `<h1>` (e.g. Skills, which owns the heading itself so it can sit above a category selector this component has no slot for) — the header row (and its `titleExtra`) still renders as long as either is non-empty. */
  title: string;
  hooks: AdminResourceListPageHooks<TRow>;
  columns: Array<DataTableColumn<TRow>>;
  searchPlaceholder?: string;
  newHref: string;
  newLabel?: string;
  getEditHref: (row: TRow) => string;
  /** The row's own display name — used for the delete confirmation's typed-match text, the success toast, and each reorder button's `aria-label`. */
  getEntityLabel: (row: TRow) => string;
  resourceNameSingular: string;
  emptyMessage?: string;
  /** Merged into every `useList` call — a resource-specific filter (e.g. Skills' `categoryId`) that isn't part of the generic search/sort/page shape. */
  extraParams?: Record<string, unknown>;
  defaultSort?: string;
  defaultOrder?: 'asc' | 'desc';
  pageSize?: number;
  /**
   * Renders Up/Down move buttons ahead of Edit/Delete, backed by
   * `hooks.useReorder`. Disabled whenever a search filter narrows the
   * list — reordering by the CURRENT page's index only produces the right
   * `displayOrder` values when that page holds every row in the resource's
   * natural order, which a filtered result set does not (doc07 §3 lists
   * "reorder" as a per-resource feature but never as compatible with an
   * active filter, and every one of these lists is small enough — doc07
   * §3's own "tens of rows, never hundreds" — that a cleared search is a
   * trivial ask, not a real limitation).
   */
  reorderable?: boolean;
  /** Extra content next to the page title — e.g. Skills' "Manage Categories" link. */
  titleExtra?: React.ReactNode;
}

export function AdminResourceListPage<TRow extends { id: number }>({
  title,
  hooks,
  columns,
  searchPlaceholder = 'Search…',
  newHref,
  newLabel,
  getEditHref,
  getEntityLabel,
  resourceNameSingular,
  emptyMessage,
  extraParams = {},
  defaultSort,
  defaultOrder,
  pageSize = 20,
  reorderable = false,
  titleExtra,
}: AdminResourceListPageProps<TRow>): React.JSX.Element {
  const { show } = useToast();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<string | undefined>(defaultSort);
  const [order, setOrder] = useState<'asc' | 'desc' | undefined>(defaultOrder);
  const [deleteTarget, setDeleteTarget] = useState<TRow | null>(null);

  const listQuery = hooks.useList({
    page,
    pageSize,
    q: q || undefined,
    sort,
    order,
    ...extraParams,
  });
  const removeMutation = hooks.useRemove();
  const reorderMutation = hooks.useReorder?.();

  const rows = listQuery.data?.items ?? [];
  const canReorder = reorderable && Boolean(reorderMutation) && q === '';

  function handleSearchChange(value: string): void {
    setQ(value);
    setPage(1);
  }

  function handleSortChange(nextSort: string, nextOrder: 'asc' | 'desc'): void {
    setSort(nextSort);
    setOrder(nextOrder);
  }

  function handleDeleteConfirm(): void {
    if (!deleteTarget) return;
    const label = getEntityLabel(deleteTarget);
    removeMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        show({ message: `${label} deleted.`, variant: 'success' });
        setDeleteTarget(null);
      },
      onError: (error) => {
        show({
          message: error instanceof ApiError ? error.message : `Couldn’t delete ${label}.`,
          variant: 'danger',
          autohideMs: null,
        });
      },
    });
  }

  function handleMove(index: number, direction: -1 | 1): void {
    if (!reorderMutation) return;
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const reordered = [...rows];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved as TRow);
    reorderMutation.mutate(
      reordered.map((row, position) => ({ id: row.id, displayOrder: position })),
      {
        onError: () => {
          show({ message: 'Couldn’t save the new order.', variant: 'danger' });
        },
      },
    );
  }

  return (
    <div className="admin-resource-page">
      {(title || titleExtra) && (
        <div className="admin-resource-page__header">
          {title && <h1 className="h4 mb-0">{title}</h1>}
          {titleExtra}
        </div>
      )}

      <ResourceToolbar
        searchValue={q}
        onSearchChange={handleSearchChange}
        searchPlaceholder={searchPlaceholder}
        newHref={newHref}
        {...(newLabel ? { newLabel } : {})}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        loading={listQuery.isPending}
        {...(emptyMessage ? { emptyMessage } : {})}
        sort={sort}
        order={order}
        onSortChange={handleSortChange}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.meta.total ?? 0}
        onPageChange={setPage}
        rowActions={(row) => {
          const index = rows.indexOf(row);
          return (
            <div className="admin-resource-page__row-actions">
              {reorderable && (
                <>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => handleMove(index, -1)}
                    disabled={!canReorder || index === 0}
                    aria-label={`Move ${getEntityLabel(row)} up`}
                  >
                    <span className="bi bi-chevron-up" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => handleMove(index, 1)}
                    disabled={!canReorder || index === rows.length - 1}
                    aria-label={`Move ${getEntityLabel(row)} down`}
                  >
                    <span className="bi bi-chevron-down" aria-hidden="true" />
                  </button>
                </>
              )}
              <Link href={getEditHref(row)} className="btn btn-sm btn-outline-primary">
                Edit
              </Link>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => setDeleteTarget(row)}
              >
                Delete
              </button>
            </div>
          );
        }}
      />

      <ConfirmDialog
        show={deleteTarget !== null}
        title={`Delete this ${resourceNameSingular}?`}
        message={`This permanently deletes “${deleteTarget ? getEntityLabel(deleteTarget) : ''}”. This cannot be undone.`}
        requireTypedConfirmation={deleteTarget ? getEntityLabel(deleteTarget) : ''}
        confirming={removeMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
